-- 0009 · Expediente conversacional (#78), alta de clientes desde /admin (#79) y documentos compartidos (#80).
-- Reutiliza el modelo existente: el «asunto» es una fila de portal.solicitudes (con su expediente si está
-- aceptado). Notas, mensajes, documentos, tareas de agenda y eventos siguen ligados a solicitud_id.

-- ── Ficha del cliente: datos de contacto y de facturación ─────────────────────────────
alter table portal.perfiles
  add column nif text check (nif ~ '^[A-Z0-9]{8,12}$'),
  add column direccion text check (length(direccion) <= 200),
  add column codigo_postal text check (codigo_postal ~ '^[0-9A-Z -]{3,10}$'),
  add column localidad text check (length(localidad) <= 120),
  add column provincia text check (length(provincia) <= 120),
  add column pais text not null default 'ES' check (pais ~ '^[A-Z]{2}$'),
  add column creado_por uuid references portal.personal(user_id);
-- Un cliente dado de alta por el despacho acepta la información de privacidad al activar su cuenta.
alter table portal.perfiles alter column version_privacidad drop not null, alter column acepta_privacidad_at drop not null;
create policy editar_despacho on portal.perfiles for update to portal_app using (portal.es_personal()) with check (portal.es_personal());

-- Alta de un cliente por el personal: cuenta sin contraseña + ficha. No sirve para dar de alta personal.
create function portal.crear_cliente(p_email text, p_nombre text, p_tipo portal.tipo_cliente, p_empresa text, p_telefono text, p_nif text)
returns uuid language plpgsql security definer set search_path = portal, pg_temp as $$
declare u uuid; correo text := lower(btrim(p_email));
begin
  if not portal.es_personal() then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if correo !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Correo no válido'; end if;
  if exists (select 1 from identidad."user" where email = correo) then raise exception 'Ya existe una cuenta con ese correo' using errcode = '23505'; end if;
  insert into identidad."user" (name, email, "emailVerified") values (btrim(p_nombre), correo, false) returning id into u;
  insert into portal.perfiles (user_id, tipo, nombre, empresa, telefono, nif, creado_por)
    values (u, p_tipo, btrim(p_nombre), nullif(btrim(p_empresa), ''), nullif(btrim(p_telefono), ''), nullif(upper(btrim(p_nif)), ''), portal.uid());
  perform portal.registrar_evento(null, 'cliente_creado', jsonb_build_object('cliente', u), false);
  return u;
end $$;

-- Invitación de activación para un CLIENTE (las del personal siguen por procedimiento administrativo).
create function portal.invitar_cliente(p_user uuid, p_sha text) returns timestamptz language plpgsql security definer
set search_path = portal, pg_temp as $$
declare caduca timestamptz := now() + interval '7 days';
begin
  if not portal.es_personal() then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if exists (select 1 from portal.personal where user_id = p_user) then raise exception 'Solo para clientes' using errcode = '42501'; end if;
  if not exists (select 1 from portal.perfiles where user_id = p_user) then raise exception 'Cliente inexistente'; end if;
  -- Una invitación nueva anula las anteriores pendientes.
  update portal.invitaciones set usada_at = now() where user_id = p_user and usada_at is null;
  insert into portal.invitaciones (user_id, token_sha256, expira_at) values (p_user, p_sha, caduca);
  perform portal.registrar_evento(null, 'invitacion_cliente', jsonb_build_object('cliente', p_user, 'caduca', caduca), false);
  return caduca;
end $$;

-- Tipo de invitación (para la página de activación): personal del despacho o cliente.
create function portal.invitacion_tipo(p_sha text) returns text language sql stable security definer
set search_path = portal, pg_temp as $$
  select case when exists (select 1 from portal.personal p where p.user_id = i.user_id) then 'personal' else 'cliente' end
    from portal.invitaciones i where i.token_sha256 = p_sha and i.usada_at is null and i.expira_at > now()
$$;

-- Tras activar la cuenta con la invitación, el cliente acepta la información de privacidad.
create function portal.aceptar_privacidad(p_user uuid, p_version text) returns void language plpgsql security definer
set search_path = portal, pg_temp as $$
begin
  -- Solo justo después de canjear una invitación de ese usuario.
  if not exists (select 1 from portal.invitaciones where user_id = p_user and usada_at > now() - interval '10 minutes') then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  update portal.perfiles set version_privacidad = p_version, acepta_privacidad_at = now()
   where user_id = p_user and version_privacidad is null;
end $$;

-- Los avisos al cliente solo se envían si ya ha activado su cuenta (tiene contraseña).
create or replace function portal.avisar_cliente(sid uuid) returns void language plpgsql security definer
set search_path = portal, pg_temp as $$
declare c uuid;
begin
  select cliente_id into c from portal.solicitudes where id = sid and estado <> 'borrador';
  if c is not null and exists (select 1 from identidad.account a where a."userId" = c and a.password is not null) then
    perform portal.encolar_aviso(c, 'cliente', 'novedades', sid, interval '2 minutes');
  end if;
end $$;

-- Abre directamente un expediente (sin solicitud previa del cliente): crea el asunto ya aceptado.
create function portal.abrir_expediente(p_cliente uuid, p_titulo text, p_tipo text, p_responsable uuid) returns uuid
language plpgsql security definer set search_path = portal, pg_temp as $$
declare sid uuid;
begin
  if not portal.es_personal() then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if not exists (select 1 from portal.perfiles where user_id = p_cliente) then raise exception 'Cliente inexistente'; end if;
  if p_tipo is not null and not exists (select 1 from portal.tipos_asunto where id = p_tipo) then raise exception 'Tipo de asunto no válido'; end if;
  insert into portal.solicitudes (cliente_id, tipo_asunto_id, estado, descripcion, conflictos_revisados_at, responsable_id)
    values (p_cliente, p_tipo, 'en_revision', 'Expediente abierto por el despacho: ' || btrim(p_titulo), now(), coalesce(p_responsable, portal.uid()))
    returning id into sid;
  perform portal.convertir_en_expediente(sid, btrim(p_titulo), coalesce(p_responsable, portal.uid()));
  return sid;
end $$;

-- ── Documentos sin requisito, carpetas y visibilidad ──────────────────────────────────
-- Lo que sube el despacho es PRIVADO hasta que se comparte expresamente; lo que sube el cliente lo ve él.
alter table portal.documentos alter column requisito_id drop not null;
alter table portal.documentos
  add column visible_cliente boolean not null default true,
  add column carpeta text check (length(carpeta) between 2 and 80),
  add column origen text not null default 'archivo' check (origen in ('archivo', 'portapapeles', 'foto')),
  add column compartido_por uuid references portal.personal(user_id),
  add column compartido_at timestamptz;
alter table portal.documentos drop constraint documentos_mime_check, add constraint documentos_mime_check check (mime in
  ('application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
   'application/vnd.openxmlformats-officedocument.wordprocessingml.document'));
drop policy leer on portal.documentos;
create policy leer on portal.documentos for select to portal_app
  using (portal.es_personal() or (visible_cliente and portal.puede_ver_solicitud(solicitud_id)));
grant update (visible_cliente, carpeta) on portal.documentos to portal_app;

create or replace function portal.t_documento_antes() returns trigger language plpgsql security definer
set search_path = portal, pg_temp as $$
declare req_id uuid; req_estado portal.estado_requisito; req_multiple boolean; s record; staff boolean := portal.es_personal(); recientes int;
begin
  if tg_op = 'UPDATE' then
    if (new.requisito_id, new.solicitud_id, new.cliente_id, new.version, new.sustituye_a, new.storage_key, new.nombre_original,
        new.mime, new.tamano, new.sha256, new.subido_por, new.subido_at, new.origen)
       is distinct from
       (old.requisito_id, old.solicitud_id, old.cliente_id, old.version, old.sustituye_a, old.storage_key, old.nombre_original,
        old.mime, old.tamano, old.sha256, old.subido_por, old.subido_at, old.origen) then
      raise exception 'Un documento aportado no se modifica: se aporta una nueva versión' using errcode = '42501';
    end if;
    if new.estado is distinct from old.estado then new.revisado_por := portal.uid(); new.revisado_at := now(); end if;
    if new.visible_cliente and not old.visible_cliente then new.compartido_por := portal.uid(); new.compartido_at := now(); end if;
    if not new.visible_cliente and old.visible_cliente and old.subido_por = old.cliente_id then
      raise exception 'Un documento aportado por el cliente siempre es visible para él' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.requisito_id is not null then
    select q.id, q.solicitud_id, q.estado, q.multiple into req_id, new.solicitud_id, req_estado, req_multiple
      from portal.requisitos q where q.id = new.requisito_id;
    if req_id is null then raise exception 'Requisito inexistente' using errcode = '42501'; end if;
  end if;
  select id, cliente_id, estado into s from portal.solicitudes where id = new.solicitud_id;
  if not found then raise exception 'Asunto inexistente' using errcode = '42501'; end if;
  if not (staff or portal.puede_aportar(s.id)) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if s.estado in ('no_aceptada', 'archivada', 'borrador') then raise exception 'La solicitud no admite documentos' using errcode = '42501'; end if;
  if not staff and req_id is not null and req_estado in ('validado', 'no_aplicable') then
    raise exception 'Este documento ya está validado o no es necesario' using errcode = '42501';
  end if;
  if not staff then
    select count(*) into recientes from portal.documentos where subido_por = portal.uid() and subido_at > now() - interval '1 hour';
    if recientes >= 60 then raise exception 'Has alcanzado el límite de subidas por hora' using errcode = '54000'; end if;
  end if;

  new.cliente_id := s.cliente_id;
  new.subido_por := portal.uid();
  new.subido_at := now();
  new.estado := case when staff then 'valido' else 'pendiente' end;
  new.motivo := null; new.revisado_por := null; new.revisado_at := null;
  new.analisis := 'no_analizado';
  new.visible_cliente := not staff;          -- el despacho comparte después, de forma expresa
  new.compartido_por := null; new.compartido_at := null;
  if req_id is not null then
    new.carpeta := null;                     -- la carpeta la da el requisito
    select coalesce(max(version), 0) + 1 into new.version from portal.documentos where requisito_id = req_id;
    if not req_multiple then
      select id into new.sustituye_a from portal.documentos where requisito_id = req_id order by version desc limit 1;
    else
      new.sustituye_a := null;
    end if;
  else
    new.carpeta := coalesce(nullif(btrim(new.carpeta), ''), case when staff then 'Documentación del despacho' else 'Aportado por el cliente' end);
    select coalesce(max(version), 0) + 1 into new.version from portal.documentos
     where solicitud_id = s.id and requisito_id is null and nombre_original = new.nombre_original;
    select id into new.sustituye_a from portal.documentos
     where solicitud_id = s.id and requisito_id is null and nombre_original = new.nombre_original order by version desc limit 1;
  end if;
  if new.storage_key <> (s.id::text || '/' || new.id::text) then
    raise exception 'Ruta de almacenamiento no válida' using errcode = '42501';
  end if;
  return new;
end $$;

create or replace function portal.t_documento_despues() returns trigger language plpgsql security definer
set search_path = portal, pg_temp as $$
declare tit text;
begin
  select titulo into tit from portal.requisitos where id = new.requisito_id;
  if tg_op = 'INSERT' then
    if new.requisito_id is not null then
      update portal.requisitos set estado = 'recibido' where id = new.requisito_id and estado in ('pendiente', 'subsanacion', 'en_revision');
    end if;
    perform portal.registrar_evento(new.solicitud_id, 'documento_aportado',
      jsonb_build_object('documento', new.id, 'requisito', new.requisito_id, 'titulo', coalesce(tit, new.carpeta), 'version', new.version,
        'archivo', new.nombre_original), new.visible_cliente);
    if not portal.es_personal() then perform portal.avisar_despacho(new.solicitud_id); end if;
  else
    if new.estado is distinct from old.estado then
      perform portal.registrar_evento(new.solicitud_id, 'documento_revisado',
        jsonb_build_object('documento', new.id, 'requisito', new.requisito_id, 'titulo', coalesce(tit, new.carpeta), 'version', new.version, 'a', new.estado, 'motivo', new.motivo),
        new.visible_cliente);
    end if;
    if new.visible_cliente and not old.visible_cliente then
      perform portal.registrar_evento(new.solicitud_id, 'documento_compartido',
        jsonb_build_object('documento', new.id, 'archivo', new.nombre_original, 'carpeta', coalesce(tit, new.carpeta)), true);
      perform portal.avisar_cliente(new.solicitud_id);
    end if;
  end if;
  return null;
end $$;

-- ── Notas internas: origen del contenido ──────────────────────────────────────────────
alter table portal.notas_internas
  add column fuente text not null default 'nota' check (fuente in ('nota', 'texto_aportado', 'llamada', 'reunion'));

-- ── Expedientes recientes por profesional (barra lateral) ─────────────────────────────
create table portal.recientes (
  user_id uuid not null references identidad."user"(id) on delete cascade,
  solicitud_id uuid not null references portal.solicitudes(id) on delete cascade,
  visto_at timestamptz not null default now(),
  primary key (user_id, solicitud_id)
);
alter table portal.recientes enable row level security;
create policy propios on portal.recientes for all to portal_app
  using (user_id = portal.uid() and portal.es_personal()) with check (user_id = portal.uid() and portal.es_personal() and portal.puede_ver_solicitud(solicitud_id));
grant select, insert, update on portal.recientes to portal_app;

grant execute on function portal.crear_cliente(text, text, portal.tipo_cliente, text, text, text), portal.invitar_cliente(uuid, text),
  portal.aceptar_privacidad(uuid, text), portal.invitacion_tipo(text), portal.abrir_expediente(uuid, text, text, uuid) to portal_app;
revoke execute on all functions in schema portal from public;
