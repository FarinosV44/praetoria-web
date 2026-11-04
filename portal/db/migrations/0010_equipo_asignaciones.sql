-- 0010 · Equipo del despacho y asignaciones por expediente (#81).
-- Hasta ahora todo el personal activo veía todos los asuntos. Desde aquí:
--   · «administrador» (superadministrador) ve y gestiona todo, incluido el equipo;
--   · el resto del personal solo ve los asuntos de los que es responsable o en los que está asignado,
--     y los clientes de esos asuntos (o los que ha dado de alta él mismo); abogados y apoyo ven además la
--     bandeja común de solicitudes nuevas sin responsable, para repartirlas;
--   · «lectura» consulta lo asignado pero no escribe; «facturacion» queda preparado para #53.
-- Se aplica en RLS, de modo que UI, API, búsqueda, descargas y exportaciones quedan cubiertas a la vez.

alter type portal.rol_personal add value if not exists 'facturacion';
alter type portal.rol_personal add value if not exists 'lectura';

-- ── Comprobaciones de identidad del personal ──────────────────────────────────────────
create function portal.rol_actual() returns text language sql stable security definer
set search_path = portal, pg_temp as $$
  select p.rol::text from portal.personal p where p.user_id = portal.uid() and p.activo
$$;
create function portal.es_global() returns boolean language sql stable security definer
set search_path = portal, pg_temp as $$
  select coalesce(portal.rol_actual() = 'administrador', false)
$$;

create table portal.asignaciones (
  solicitud_id uuid not null references portal.solicitudes(id) on delete cascade,
  user_id uuid not null references portal.personal(user_id),
  papel text not null default 'colaborador' check (papel in ('colaborador', 'suplente')),
  asignado_por uuid not null references portal.personal(user_id),
  asignado_at timestamptz not null default now(),
  primary key (solicitud_id, user_id)
);
create index asignaciones_usuario on portal.asignaciones (user_id);
alter table portal.asignaciones enable row level security;   -- escritura solo por funciones

-- ¿Puede ese profesional ver el asunto? (para validar responsables y tareas de otra persona)
create function portal.ve_asunto(p_user uuid, sid uuid) returns boolean language sql stable security definer
set search_path = portal, pg_temp as $$
  select exists (select 1 from portal.personal p where p.user_id = p_user and p.activo and (
      p.rol = 'administrador'
      or exists (select 1 from portal.solicitudes s where s.id = sid and s.responsable_id = p_user)
      -- Bandeja común: las solicitudes nuevas aún sin responsable las ven abogados y apoyo para repartirlas.
      or (p.rol in ('abogado', 'apoyo') and exists (select 1 from portal.solicitudes s
            where s.id = sid and s.responsable_id is null and s.estado in ('enviada', 'en_revision')))
      or exists (select 1 from portal.asignaciones a where a.solicitud_id = sid and a.user_id = p_user)))
$$;
create function portal.personal_ve(sid uuid) returns boolean language sql stable security definer
set search_path = portal, pg_temp as $$
  select portal.uid() is not null and portal.ve_asunto(portal.uid(), sid)
$$;
create function portal.personal_escribe(sid uuid) returns boolean language sql stable security definer
set search_path = portal, pg_temp as $$
  select portal.personal_ve(sid) and portal.rol_actual() <> 'lectura'
$$;
create function portal.personal_ve_cliente(cid uuid) returns boolean language sql stable security definer
set search_path = portal, pg_temp as $$
  select portal.es_global() or (portal.es_personal() and (
      exists (select 1 from portal.perfiles f where f.user_id = cid and f.creado_por = portal.uid())
      or exists (select 1 from portal.solicitudes s where s.cliente_id = cid and portal.ve_asunto(portal.uid(), s.id))))
$$;

create policy leer on portal.asignaciones for select to portal_app using (portal.personal_ve(solicitud_id));
grant select on portal.asignaciones to portal_app;

-- El acceso del personal a un asunto pasa a depender de la asignación.
create or replace function portal.puede_ver_solicitud(sid uuid) returns boolean language sql stable security definer
set search_path = portal, pg_temp as $$
  select portal.personal_ve(sid)
      or exists (select 1 from portal.solicitudes s where s.id = sid and s.cliente_id = portal.uid())
      or exists (select 1 from portal.accesos a where a.solicitud_id = sid and a.user_id = portal.uid() and a.revocado_at is null)
$$;

-- ── Políticas: de «cualquier personal» a «personal con el asunto asignado» ───────────
drop policy crear on portal.documentos;
create policy crear on portal.documentos for insert to portal_app with check (portal.puede_aportar(solicitud_id) or portal.personal_escribe(solicitud_id));
drop policy leer on portal.documentos;
create policy leer on portal.documentos for select to portal_app
  using (portal.personal_ve(solicitud_id) or (visible_cliente and portal.puede_ver_solicitud(solicitud_id)));
drop policy revisar on portal.documentos;
create policy revisar on portal.documentos for update to portal_app using (portal.personal_escribe(solicitud_id)) with check (portal.personal_escribe(solicitud_id));

drop policy leer on portal.eventos;
create policy leer on portal.eventos for select to portal_app using (
  case when solicitud_id is null then portal.es_global() or (portal.es_personal() and actor_id = portal.uid())
       else portal.personal_ve(solicitud_id) or (visible_cliente and portal.puede_ver_solicitud(solicitud_id)) end);

drop policy crear on portal.expedientes;
create policy crear on portal.expedientes for insert to portal_app with check (portal.personal_escribe(solicitud_id));
drop policy editar on portal.expedientes;
create policy editar on portal.expedientes for update to portal_app using (portal.personal_escribe(solicitud_id)) with check (portal.personal_escribe(solicitud_id));

drop policy crear on portal.notas_internas;
create policy crear on portal.notas_internas for insert to portal_app with check (portal.personal_escribe(solicitud_id));
drop policy leer on portal.notas_internas;
create policy leer on portal.notas_internas for select to portal_app using (portal.personal_ve(solicitud_id));

drop policy despacho on portal.notificaciones;
create policy despacho on portal.notificaciones for select to portal_app using (
  portal.es_global() or (portal.es_personal() and (destinatario_id = portal.uid() or (solicitud_id is not null and portal.personal_ve(solicitud_id)))));

drop policy crear on portal.requisitos;
create policy crear on portal.requisitos for insert to portal_app with check (portal.personal_escribe(solicitud_id));
drop policy editar on portal.requisitos;
create policy editar on portal.requisitos for update to portal_app using (portal.personal_escribe(solicitud_id)) with check (portal.personal_escribe(solicitud_id));

drop policy crear on portal.solicitudes;
create policy crear on portal.solicitudes for insert to portal_app
  with check (cliente_id = portal.uid() or (portal.personal_ve_cliente(cliente_id) and portal.rol_actual() <> 'lectura'));
drop policy editar on portal.solicitudes;
create policy editar on portal.solicitudes for update to portal_app
  using ((cliente_id = portal.uid() and estado = 'borrador') or portal.personal_escribe(id))
  with check (cliente_id = portal.uid() or portal.personal_escribe(id));

drop policy crear on portal.accesos;
create policy crear on portal.accesos for insert to portal_app with check (portal.personal_escribe(solicitud_id));
drop policy editar on portal.accesos;
create policy editar on portal.accesos for update to portal_app using (portal.personal_escribe(solicitud_id)) with check (portal.personal_escribe(solicitud_id));
drop policy leer on portal.accesos;
create policy leer on portal.accesos for select to portal_app using (portal.personal_ve(solicitud_id) or user_id = portal.uid());

drop policy crear on portal.mensajes;
create policy crear on portal.mensajes for insert to portal_app
  with check (portal.puede_ver_solicitud(solicitud_id) and autor_id = portal.uid() and (not portal.es_personal() or portal.personal_escribe(solicitud_id)));

drop policy leer on portal.perfiles;
create policy leer on portal.perfiles for select to portal_app using (user_id = portal.uid() or portal.personal_ve_cliente(user_id));
drop policy editar_despacho on portal.perfiles;
create policy editar_despacho on portal.perfiles for update to portal_app
  using (portal.personal_ve_cliente(user_id) and portal.rol_actual() <> 'lectura')
  with check (portal.personal_ve_cliente(user_id) and portal.rol_actual() <> 'lectura');

drop policy app_lectura on identidad."user";
create policy app_lectura on identidad."user" for select to portal_app using (
  id = portal.uid() or portal.es_global()
  or (portal.es_personal() and (exists (select 1 from portal.personal p where p.user_id = id) or portal.personal_ve_cliente(id))));

-- ── Tareas del expediente: responsable (= propietario), suplente, resultado e historial ──
alter table portal.agenda_eventos
  add column suplente_id uuid references portal.personal(user_id),
  add column asignada_por uuid references portal.personal(user_id),
  add column resultado text check (length(resultado) <= 2000),
  add column completada_por uuid references portal.personal(user_id),
  add column completada_at timestamptz;
drop policy propia on portal.agenda_eventos;
-- Una tarea de un asunto se ve mientras se tenga el asunto asignado; las tareas sin asunto, solo su dueño o suplente.
create policy leer on portal.agenda_eventos for select to portal_app using (portal.es_personal() and
  case when solicitud_id is null then propietario_id = portal.uid() or suplente_id = portal.uid() else portal.personal_ve(solicitud_id) end);
create policy crear on portal.agenda_eventos for insert to portal_app with check (portal.es_personal() and portal.rol_actual() <> 'lectura'
  and (solicitud_id is null or portal.personal_escribe(solicitud_id)));
create policy editar on portal.agenda_eventos for update to portal_app
  using (portal.es_personal() and case when solicitud_id is null then propietario_id = portal.uid() or suplente_id = portal.uid() else portal.personal_escribe(solicitud_id) end)
  with check (portal.es_personal() and case when solicitud_id is null then propietario_id = portal.uid() or suplente_id = portal.uid() else portal.personal_escribe(solicitud_id) end);
create policy borrar on portal.agenda_eventos for delete to portal_app using (propietario_id = portal.uid() and portal.es_personal());
grant update (propietario_id, suplente_id, resultado) on portal.agenda_eventos to portal_app;

create or replace function portal.t_agenda_antes() returns trigger language plpgsql
set search_path = portal, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    if not portal.es_personal() then raise exception 'Sin permiso' using errcode = '42501'; end if;
    -- Por defecto la tarea es de quien la crea; puede encargarse a otro profesional que vea el asunto.
    if new.propietario_id is null or new.propietario_id = portal.uid() then
      new.propietario_id := portal.uid(); new.asignada_por := null;
    else
      new.asignada_por := portal.uid();
    end if;
    new.version := 1;
    new.created_at := now();
    new.completada_por := null; new.completada_at := null;
  else
    new.id := old.id; new.created_at := old.created_at; new.asignada_por := old.asignada_por;
    new.completada_por := old.completada_por; new.completada_at := old.completada_at;
    if new.propietario_id is distinct from old.propietario_id then new.asignada_por := portal.uid(); end if;
    if new.estado = 'completado' and old.estado <> 'completado' then
      new.completada_por := portal.uid(); new.completada_at := now();
    end if;
    if (new.inicio, new.repeticion, new.repetir_hasta, new.avisos_min, new.estado, new.propietario_id)
       is distinct from (old.inicio, old.repeticion, old.repetir_hasta, old.avisos_min, old.estado, old.propietario_id) then
      new.version := old.version + 1;
    end if;
    -- Cambiar la fecha de un plazo anula su verificación: hay que volver a comprobarla.
    if new.tipo = 'plazo' and new.inicio is distinct from old.inicio then
      new.plazo_verificado_por := null; new.plazo_verificado_at := null;
    end if;
  end if;
  -- Responsable y suplente: personal activo que pueda ver el asunto.
  if new.solicitud_id is not null then
    if not portal.ve_asunto(new.propietario_id, new.solicitud_id) then raise exception 'Esa persona no tiene asignado este asunto'; end if;
    if new.suplente_id is not null and not portal.ve_asunto(new.suplente_id, new.solicitud_id) then raise exception 'El suplente no tiene asignado este asunto'; end if;
  elsif new.propietario_id <> portal.uid() and tg_op = 'INSERT' then
    raise exception 'Las tareas sin asunto son personales';
  end if;
  if new.plazo_verificado_at is not null and (tg_op = 'INSERT' or old.plazo_verificado_at is null) then
    new.plazo_verificado_por := portal.uid(); new.plazo_verificado_at := now();
  end if;
  new.updated_at := now();
  return new;
end $$;

-- Historial en la cronología del asunto (interno) y aviso neutro a quien recibe un encargo.
create function portal.t_agenda_historial() returns trigger language plpgsql security definer
set search_path = portal, pg_temp as $$
begin
  if new.solicitud_id is null then return null; end if;
  if tg_op = 'INSERT' then
    if new.propietario_id <> portal.uid() then
      perform portal.registrar_evento(new.solicitud_id, 'tarea_encargada', jsonb_build_object('tarea', new.titulo, 'a', new.propietario_id), false);
      perform portal.encolar_aviso(new.propietario_id, 'despacho', 'aviso_interno', new.solicitud_id, interval '0');
    end if;
    return null;
  end if;
  if new.propietario_id is distinct from old.propietario_id then
    perform portal.registrar_evento(new.solicitud_id, 'tarea_reasignada', jsonb_build_object('tarea', new.titulo, 'de', old.propietario_id, 'a', new.propietario_id), false);
    perform portal.encolar_aviso(new.propietario_id, 'despacho', 'aviso_interno', new.solicitud_id, interval '0');
  end if;
  if new.estado = 'completado' and old.estado <> 'completado' then
    perform portal.registrar_evento(new.solicitud_id, 'tarea_completada', jsonb_build_object('tarea', new.titulo, 'resultado', new.resultado), false);
  end if;
  return null;
end $$;
create trigger agenda_historial after insert or update on portal.agenda_eventos for each row execute function portal.t_agenda_historial();

-- ── Gestión del equipo (solo superadministración) ─────────────────────────────────────
create function portal.crear_empleado(p_email text, p_nombre text, p_rol text) returns uuid language plpgsql security definer
set search_path = portal, pg_temp as $$
declare u uuid; correo text := lower(btrim(p_email));
begin
  if not portal.es_global() then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if p_rol not in ('administrador', 'abogado', 'apoyo', 'facturacion', 'lectura') then raise exception 'Rol no válido'; end if;
  if correo !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Correo no válido'; end if;
  if exists (select 1 from identidad."user" where email = correo) then raise exception 'Ya existe una cuenta con ese correo' using errcode = '23505'; end if;
  insert into identidad."user" (name, email, "emailVerified") values (btrim(p_nombre), correo, false) returning id into u;
  insert into portal.personal (user_id, rol, nombre_visible) values (u, p_rol::portal.rol_personal, btrim(p_nombre));
  perform portal.registrar_evento(null, 'empleado_creado', jsonb_build_object('empleado', u, 'rol', p_rol), false);
  return u;
end $$;

create function portal.invitar_empleado(p_user uuid, p_sha text) returns timestamptz language plpgsql security definer
set search_path = portal, pg_temp as $$
declare caduca timestamptz := now() + interval '72 hours';
begin
  if not portal.es_global() then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if not exists (select 1 from portal.personal where user_id = p_user and activo) then raise exception 'Solo para personal activo' using errcode = '42501'; end if;
  update portal.invitaciones set usada_at = now() where user_id = p_user and usada_at is null;
  insert into portal.invitaciones (user_id, token_sha256, expira_at) values (p_user, p_sha, caduca);
  perform portal.registrar_evento(null, 'invitacion_empleado', jsonb_build_object('empleado', p_user, 'caduca', caduca), false);
  return caduca;
end $$;

create function portal.cambiar_empleado(p_user uuid, p_rol text, p_activo boolean) returns void language plpgsql security definer
set search_path = portal, pg_temp as $$
begin
  if not portal.es_global() then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if p_user = portal.uid() then raise exception 'No puedes cambiar tu propio acceso'; end if;
  if p_rol not in ('administrador', 'abogado', 'apoyo', 'facturacion', 'lectura') then raise exception 'Rol no válido'; end if;
  update portal.personal set rol = p_rol::portal.rol_personal, activo = p_activo where user_id = p_user;
  if not found then raise exception 'Empleado inexistente'; end if;
  if not p_activo then
    -- Desactivar corta el acceso de inmediato: sesiones, invitaciones pendientes y avisos al móvil.
    delete from identidad.session where "userId" = p_user;
    update portal.invitaciones set usada_at = now() where user_id = p_user and usada_at is null;
    update portal.push_suscripciones set revocada_at = now() where user_id = p_user and revocada_at is null;
  end if;
  perform portal.registrar_evento(null, 'empleado_cambiado', jsonb_build_object('empleado', p_user, 'rol', p_rol, 'activo', p_activo), false);
end $$;

-- Asignar, retirar o cambiar el responsable: superadministración o el responsable actual del asunto.
create function portal.puede_gestionar_asunto(sid uuid) returns boolean language sql stable security definer
set search_path = portal, pg_temp as $$
  select portal.es_global() or (portal.rol_actual() in ('abogado', 'apoyo')
     and exists (select 1 from portal.solicitudes s where s.id = sid and s.responsable_id = portal.uid()))
$$;

create function portal.asignar(p_sid uuid, p_user uuid, p_papel text) returns void language plpgsql security definer
set search_path = portal, pg_temp as $$
begin
  if not portal.puede_gestionar_asunto(p_sid) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if not exists (select 1 from portal.personal where user_id = p_user and activo) then raise exception 'Debe ser personal activo del despacho'; end if;
  insert into portal.asignaciones (solicitud_id, user_id, papel, asignado_por) values (p_sid, p_user, coalesce(p_papel, 'colaborador'), portal.uid())
    on conflict (solicitud_id, user_id) do update set papel = excluded.papel;
  perform portal.registrar_evento(p_sid, 'asignacion', jsonb_build_object('empleado', p_user, 'papel', coalesce(p_papel, 'colaborador')), false);
  if p_user <> portal.uid() then perform portal.encolar_aviso(p_user, 'despacho', 'aviso_interno', p_sid, interval '0'); end if;
end $$;

create function portal.retirar_asignacion(p_sid uuid, p_user uuid) returns void language plpgsql security definer
set search_path = portal, pg_temp as $$
begin
  if not portal.puede_gestionar_asunto(p_sid) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if exists (select 1 from portal.solicitudes where id = p_sid and responsable_id = p_user) then
    raise exception 'Primero asigna otro responsable';
  end if;
  delete from portal.asignaciones where solicitud_id = p_sid and user_id = p_user;
  if found then
    -- Sus tareas pendientes de este asunto pasan al responsable; deja de ser suplente.
    update portal.agenda_eventos set propietario_id = (select responsable_id from portal.solicitudes where id = p_sid)
     where solicitud_id = p_sid and propietario_id = p_user and estado = 'pendiente';
    update portal.agenda_eventos set suplente_id = null where solicitud_id = p_sid and suplente_id = p_user;
    perform portal.registrar_evento(p_sid, 'asignacion_retirada', jsonb_build_object('empleado', p_user), false);
  end if;
end $$;

-- Relevo: otro profesional asume el asunto; quien lo llevaba sigue como colaborador para no perder el contexto.
create function portal.cambiar_responsable(p_sid uuid, p_user uuid) returns void language plpgsql security definer
set search_path = portal, pg_temp as $$
declare antes uuid;
begin
  if not portal.puede_gestionar_asunto(p_sid) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if not exists (select 1 from portal.personal where user_id = p_user and activo and rol::text in ('administrador', 'abogado', 'apoyo')) then
    raise exception 'El responsable debe ser abogado, apoyo o administrador activo';
  end if;
  select responsable_id into antes from portal.solicitudes where id = p_sid for update;
  if antes is not distinct from p_user then return; end if;
  update portal.solicitudes set responsable_id = p_user where id = p_sid;
  update portal.expedientes set responsable_id = p_user where solicitud_id = p_sid;
  delete from portal.asignaciones where solicitud_id = p_sid and user_id = p_user;
  if antes is not null then
    insert into portal.asignaciones (solicitud_id, user_id, papel, asignado_por) values (p_sid, antes, 'colaborador', portal.uid())
      on conflict do nothing;
  end if;
  perform portal.encolar_aviso(p_user, 'despacho', 'aviso_interno', p_sid, interval '0');
end $$;

-- ── Funciones existentes: mismas reglas, ahora con la asignación ──────────────────────
create or replace function portal.convertir_en_expediente(p_solicitud uuid, p_titulo text, p_responsable uuid) returns uuid
language plpgsql security definer set search_path = portal, pg_temp as $$
declare s record; nuevo uuid;
begin
  if not portal.personal_escribe(p_solicitud) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if not exists (select 1 from portal.personal where user_id = p_responsable and activo) then
    raise exception 'El responsable debe ser personal activo del despacho';
  end if;
  select * into s from portal.solicitudes where id = p_solicitud for update;
  if not found then raise exception 'Solicitud inexistente'; end if;
  if s.estado not in ('enviada', 'en_revision') then raise exception 'La solicitud no está pendiente de decisión'; end if;
  if s.conflictos_revisados_at is null then raise exception 'Antes de aceptar, registra la revisión de conflictos de intereses'; end if;
  insert into portal.expedientes (solicitud_id, cliente_id, titulo, tipo_asunto_id, responsable_id, abierto_por)
    values (s.id, s.cliente_id, p_titulo, s.tipo_asunto_id, p_responsable, portal.uid())
    returning id into nuevo;
  update portal.solicitudes set estado = 'aceptada', responsable_id = p_responsable, decidida_at = now(), decidida_por = portal.uid()
    where id = s.id;
  -- Quien acepta el asunto para otra persona sigue viéndolo como colaborador.
  if p_responsable <> portal.uid() and not portal.es_global() then
    insert into portal.asignaciones (solicitud_id, user_id, papel, asignado_por) values (s.id, portal.uid(), 'colaborador', portal.uid()) on conflict do nothing;
  end if;
  perform portal.registrar_evento(s.id, 'expediente_abierto', jsonb_build_object('expediente', nuevo), true);
  perform portal.avisar_cliente(s.id);
  return nuevo;
end $$;

create or replace function portal.abrir_expediente(p_cliente uuid, p_titulo text, p_tipo text, p_responsable uuid) returns uuid
language plpgsql security definer set search_path = portal, pg_temp as $$
declare sid uuid; resp uuid := coalesce(p_responsable, portal.uid());
begin
  if not portal.personal_ve_cliente(p_cliente) or portal.rol_actual() not in ('administrador', 'abogado', 'apoyo') then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  if not exists (select 1 from portal.perfiles where user_id = p_cliente) then raise exception 'Cliente inexistente'; end if;
  if p_tipo is not null and not exists (select 1 from portal.tipos_asunto where id = p_tipo) then raise exception 'Tipo de asunto no válido'; end if;
  insert into portal.solicitudes (cliente_id, tipo_asunto_id, estado, descripcion, conflictos_revisados_at, responsable_id)
    values (p_cliente, p_tipo, 'en_revision', 'Expediente abierto por el despacho: ' || btrim(p_titulo), now(), resp)
    returning id into sid;
  if resp <> portal.uid() and not portal.es_global() then
    insert into portal.asignaciones (solicitud_id, user_id, papel, asignado_por) values (sid, portal.uid(), 'colaborador', portal.uid());
  end if;
  perform portal.convertir_en_expediente(sid, btrim(p_titulo), resp);
  return sid;
end $$;

create or replace function portal.crear_cliente(p_email text, p_nombre text, p_tipo portal.tipo_cliente, p_empresa text, p_telefono text, p_nif text)
returns uuid language plpgsql security definer set search_path = portal, pg_temp as $$
declare u uuid; correo text := lower(btrim(p_email));
begin
  if coalesce(portal.rol_actual(), '') not in ('administrador', 'abogado', 'apoyo') then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if correo !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Correo no válido'; end if;
  if exists (select 1 from identidad."user" where email = correo) then raise exception 'Ya existe una cuenta con ese correo' using errcode = '23505'; end if;
  insert into identidad."user" (name, email, "emailVerified") values (btrim(p_nombre), correo, false) returning id into u;
  insert into portal.perfiles (user_id, tipo, nombre, empresa, telefono, nif, creado_por)
    values (u, p_tipo, btrim(p_nombre), nullif(btrim(p_empresa), ''), nullif(btrim(p_telefono), ''), nullif(upper(btrim(p_nif)), ''), portal.uid());
  perform portal.registrar_evento(null, 'cliente_creado', jsonb_build_object('cliente', u), false);
  return u;
end $$;

create or replace function portal.invitar_cliente(p_user uuid, p_sha text) returns timestamptz
language plpgsql security definer set search_path = portal, pg_temp as $$
declare caduca timestamptz := now() + interval '7 days';
begin
  if not portal.personal_ve_cliente(p_user) or portal.rol_actual() not in ('administrador', 'abogado', 'apoyo') then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  if exists (select 1 from portal.personal where user_id = p_user) then raise exception 'Solo para clientes' using errcode = '42501'; end if;
  if not exists (select 1 from portal.perfiles where user_id = p_user) then raise exception 'Cliente inexistente'; end if;
  update portal.invitaciones set usada_at = now() where user_id = p_user and usada_at is null;
  insert into portal.invitaciones (user_id, token_sha256, expira_at) values (p_user, p_sha, caduca);
  perform portal.registrar_evento(null, 'invitacion_cliente', jsonb_build_object('cliente', p_user, 'caduca', caduca), false);
  return caduca;
end $$;

grant execute on function portal.rol_actual(), portal.es_global(), portal.ve_asunto(uuid, uuid), portal.personal_ve(uuid), portal.personal_escribe(uuid),
  portal.personal_ve_cliente(uuid), portal.puede_gestionar_asunto(uuid), portal.crear_empleado(text, text, text), portal.invitar_empleado(uuid, text),
  portal.cambiar_empleado(uuid, text, boolean), portal.asignar(uuid, uuid, text), portal.retirar_asignacion(uuid, uuid),
  portal.cambiar_responsable(uuid, uuid) to portal_app;
revoke execute on all functions in schema portal from public;
