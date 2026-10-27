-- 0003 · Reglas de negocio en la base de datos y Row Level Security.
-- La aplicación comprueba permisos en el servidor, pero la base de datos es la última barrera:
-- aunque una consulta olvide un filtro, el rol portal_app solo ve y modifica lo que estas
-- políticas permiten para el usuario fijado en app.user_id.

-- ── Permisos derivados ────────────────────────────────────────────────────────────────
create function portal.puede_ver_solicitud(sid uuid) returns boolean language sql stable security definer
set search_path = portal, pg_temp as $$
  select portal.es_personal()
      or exists (select 1 from portal.solicitudes s where s.id = sid and s.cliente_id = portal.uid())
      or exists (select 1 from portal.accesos a where a.solicitud_id = sid and a.user_id = portal.uid() and a.revocado_at is null)
$$;

create function portal.puede_aportar(sid uuid) returns boolean language sql stable security definer
set search_path = portal, pg_temp as $$
  select exists (select 1 from portal.solicitudes s where s.id = sid and s.cliente_id = portal.uid())
      or exists (select 1 from portal.accesos a where a.solicitud_id = sid and a.user_id = portal.uid()
                 and a.permiso = 'aportar' and a.revocado_at is null)
$$;

create function portal.registrar_evento(p_sid uuid, p_tipo text, p_detalle jsonb, p_visible boolean) returns void
language plpgsql security definer set search_path = portal, pg_temp as $$
begin
  insert into portal.eventos (solicitud_id, expediente_id, actor_id, tipo, detalle, visible_cliente)
  values (p_sid, (select e.id from portal.expedientes e where e.solicitud_id = p_sid), portal.uid(), p_tipo, coalesce(p_detalle, '{}'), p_visible);
end $$;

-- Encola un aviso neutro. Si ya hay uno pendiente para el mismo destinatario, solicitud y tipo,
-- no crea otro (evita duplicados cuando el despacho hace varios cambios seguidos).
create function portal.encolar_aviso(p_dest uuid, p_destino text, p_tipo text, p_sid uuid, p_retraso interval) returns void
language plpgsql security definer set search_path = portal, pg_temp as $$
begin
  insert into portal.notificaciones (destinatario_id, destino, tipo, solicitud_id, enviar_despues)
  values (p_dest, p_destino, p_tipo, p_sid, now() + p_retraso)
  on conflict (coalesce(destinatario_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(solicitud_id, '00000000-0000-0000-0000-000000000000'::uuid), tipo)
    where estado = 'pendiente' do nothing;
end $$;

create function portal.avisar_cliente(sid uuid) returns void language plpgsql security definer
set search_path = portal, pg_temp as $$
declare c uuid;
begin
  select cliente_id into c from portal.solicitudes where id = sid and estado <> 'borrador';
  if c is not null then perform portal.encolar_aviso(c, 'cliente', 'novedades', sid, interval '2 minutes'); end if;
end $$;

create function portal.avisar_despacho(sid uuid) returns void language plpgsql security definer
set search_path = portal, pg_temp as $$
begin
  perform portal.encolar_aviso((select responsable_id from portal.solicitudes where id = sid), 'despacho', 'aviso_interno', sid, interval '2 minutes');
end $$;

-- ── Perfiles ──────────────────────────────────────────────────────────────────────────
create function portal.t_perfil() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' then new.user_id := old.user_id; new.created_at := old.created_at; end if;
  new.updated_at := now();
  return new;
end $$;
create trigger perfil_antes before insert or update on portal.perfiles for each row execute function portal.t_perfil();

-- ── Solicitudes ───────────────────────────────────────────────────────────────────────
create function portal.t_solicitud_antes() returns trigger language plpgsql security definer
set search_path = portal, pg_temp as $$
declare staff boolean := portal.es_personal();
begin
  if tg_op = 'INSERT' then
    if portal.uid() is null then raise exception 'sin identidad' using errcode = '42501'; end if;
    if not staff then
      new.cliente_id := portal.uid();
      new.estado := 'borrador';
      new.responsable_id := null; new.conflictos_revisados_at := null; new.conflictos_revisados_por := null;
      new.estado_visible := null; new.motivo_no_aceptada := null; new.decidida_at := null; new.decidida_por := null;
    end if;
    new.enviada_at := null; new.created_at := now(); new.updated_at := now();
    return new;
  end if;

  new.id := old.id; new.referencia := old.referencia; new.cliente_id := old.cliente_id; new.created_at := old.created_at;
  new.updated_at := now();

  if not staff then
    if old.estado <> 'borrador' then raise exception 'La solicitud ya se ha enviado y no se puede modificar' using errcode = '42501'; end if;
    new.responsable_id := old.responsable_id; new.conflictos_revisados_at := old.conflictos_revisados_at;
    new.conflictos_revisados_por := old.conflictos_revisados_por; new.estado_visible := old.estado_visible;
    new.motivo_no_aceptada := old.motivo_no_aceptada; new.decidida_at := old.decidida_at; new.decidida_por := old.decidida_por;
    if new.estado not in ('borrador', 'enviada') then raise exception 'Cambio de estado no permitido' using errcode = '42501'; end if;
    if new.estado = 'enviada' then
      if new.tipo_asunto_id is null or coalesce(length(btrim(new.descripcion)), 0) < 20 then
        raise exception 'Faltan datos para enviar la solicitud' using errcode = '23514';
      end if;
      new.enviada_at := now();
    end if;
    return new;
  end if;

  -- Personal del despacho
  if new.estado is distinct from old.estado then
    if new.estado = 'borrador' then raise exception 'Una solicitud enviada no vuelve a borrador'; end if;
    if new.estado = 'aceptada' and not exists (select 1 from portal.expedientes e where e.solicitud_id = old.id) then
      raise exception 'Para aceptar, convierte la solicitud en expediente';
    end if;
    if new.estado = 'no_aceptada' then
      if coalesce(length(btrim(new.motivo_no_aceptada)), 0) < 5 then raise exception 'Indica el motivo que verá el cliente'; end if;
      new.decidida_at := now(); new.decidida_por := portal.uid();
    end if;
  end if;
  if new.conflictos_revisados_at is not null and old.conflictos_revisados_at is null then
    new.conflictos_revisados_at := now(); new.conflictos_revisados_por := portal.uid();
  end if;
  return new;
end $$;
create trigger solicitud_antes before insert or update on portal.solicitudes for each row execute function portal.t_solicitud_antes();

create function portal.t_solicitud_despues() returns trigger language plpgsql security definer
set search_path = portal, pg_temp as $$
declare pl uuid;
begin
  if old.estado = 'borrador' and new.estado = 'enviada' then
    select id into pl from portal.plantillas where tipo_asunto_id = new.tipo_asunto_id and activa;
    insert into portal.requisitos (solicitud_id, plantilla_item_id, titulo, explicacion, ejemplo, obligatorio, multiple, sensible, orden)
      select new.id, i.id, i.titulo, i.explicacion, i.ejemplo, i.obligatorio, i.multiple, i.sensible, i.orden
      from portal.plantilla_items i where i.plantilla_id = pl and i.activo
      order by i.orden;
    perform portal.registrar_evento(new.id, 'solicitud_enviada', jsonb_build_object('referencia', new.referencia), true);
    perform portal.avisar_despacho(new.id);
  elsif new.estado is distinct from old.estado then
    perform portal.registrar_evento(new.id, 'estado_solicitud', jsonb_build_object('de', old.estado, 'a', new.estado), true);
    if new.estado in ('en_revision', 'no_aceptada') then perform portal.avisar_cliente(new.id); end if;
  end if;
  if new.responsable_id is distinct from old.responsable_id then
    perform portal.registrar_evento(new.id, 'responsable_asignado', jsonb_build_object('responsable', new.responsable_id), false);
  end if;
  if new.conflictos_revisados_at is not null and old.conflictos_revisados_at is null then
    perform portal.registrar_evento(new.id, 'conflictos_revisados', '{}', false);
  end if;
  if new.estado_visible is distinct from old.estado_visible and new.estado_visible is not null then
    perform portal.registrar_evento(new.id, 'estado_visible', jsonb_build_object('texto', new.estado_visible), true);
    perform portal.avisar_cliente(new.id);
  end if;
  return null;
end $$;
create trigger solicitud_despues after update on portal.solicitudes for each row execute function portal.t_solicitud_despues();

-- ── Requisitos documentales ───────────────────────────────────────────────────────────
create function portal.t_requisito_antes() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.solicitado_por := coalesce(new.solicitado_por, case when portal.es_personal() then portal.uid() end);
    new.created_at := now();
  else
    new.id := old.id; new.solicitud_id := old.solicitud_id; new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger requisito_antes before insert or update on portal.requisitos for each row execute function portal.t_requisito_antes();

create function portal.t_requisito_despues() returns trigger language plpgsql security definer
set search_path = portal, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    if new.solicitado_por is not null then
      perform portal.registrar_evento(new.solicitud_id, 'documento_solicitado', jsonb_build_object('requisito', new.id, 'titulo', new.titulo), true);
      perform portal.avisar_cliente(new.solicitud_id);
    end if;
  elsif new.estado is distinct from old.estado or new.comentario is distinct from old.comentario then
    perform portal.registrar_evento(new.solicitud_id, 'requisito_actualizado',
      jsonb_build_object('requisito', new.id, 'titulo', new.titulo, 'de', old.estado, 'a', new.estado, 'comentario', new.comentario), true);
    if portal.es_personal() and new.estado <> 'recibido' then perform portal.avisar_cliente(new.solicitud_id); end if;
  end if;
  return null;
end $$;
create trigger requisito_despues after insert or update on portal.requisitos for each row execute function portal.t_requisito_despues();

-- ── Documentos (versiones) ────────────────────────────────────────────────────────────
create function portal.t_documento_antes() returns trigger language plpgsql security definer
set search_path = portal, pg_temp as $$
declare r record; staff boolean := portal.es_personal(); recientes int;
begin
  if tg_op = 'UPDATE' then
    if (new.requisito_id, new.solicitud_id, new.cliente_id, new.version, new.sustituye_a, new.storage_key, new.nombre_original,
        new.mime, new.tamano, new.sha256, new.subido_por, new.subido_at)
       is distinct from
       (old.requisito_id, old.solicitud_id, old.cliente_id, old.version, old.sustituye_a, old.storage_key, old.nombre_original,
        old.mime, old.tamano, old.sha256, old.subido_por, old.subido_at) then
      raise exception 'Un documento aportado no se modifica: se aporta una nueva versión' using errcode = '42501';
    end if;
    if new.estado is distinct from old.estado then new.revisado_por := portal.uid(); new.revisado_at := now(); end if;
    return new;
  end if;

  select q.id, q.solicitud_id, q.estado, q.multiple, s.cliente_id, s.estado as estado_solicitud
    into r from portal.requisitos q join portal.solicitudes s on s.id = q.solicitud_id where q.id = new.requisito_id;
  if not found then raise exception 'Requisito inexistente' using errcode = '42501'; end if;
  if not (staff or portal.puede_aportar(r.solicitud_id)) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if r.estado_solicitud in ('no_aceptada', 'archivada', 'borrador') then raise exception 'La solicitud no admite documentos' using errcode = '42501'; end if;
  if not staff and r.estado in ('validado', 'no_aplicable') then raise exception 'Este documento ya está validado o no es necesario' using errcode = '42501'; end if;
  if not staff then
    select count(*) into recientes from portal.documentos where subido_por = portal.uid() and subido_at > now() - interval '1 hour';
    if recientes >= 60 then raise exception 'Has alcanzado el límite de subidas por hora' using errcode = '54000'; end if;
  end if;

  new.solicitud_id := r.solicitud_id;
  new.cliente_id := r.cliente_id;
  new.subido_por := portal.uid();
  new.subido_at := now();
  new.estado := 'pendiente'; new.motivo := null; new.revisado_por := null; new.revisado_at := null;
  new.analisis := 'no_analizado';
  select coalesce(max(version), 0) + 1 into new.version from portal.documentos where requisito_id = r.id;
  if not r.multiple then
    select id into new.sustituye_a from portal.documentos where requisito_id = r.id order by version desc limit 1;
  else
    new.sustituye_a := null;
  end if;
  if new.storage_key <> (r.solicitud_id::text || '/' || new.id::text) then
    raise exception 'Ruta de almacenamiento no válida' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger documento_antes before insert or update on portal.documentos for each row execute function portal.t_documento_antes();

create function portal.t_documento_despues() returns trigger language plpgsql security definer
set search_path = portal, pg_temp as $$
declare tit text;
begin
  select titulo into tit from portal.requisitos where id = new.requisito_id;
  if tg_op = 'INSERT' then
    update portal.requisitos set estado = 'recibido' where id = new.requisito_id and estado in ('pendiente', 'subsanacion', 'en_revision');
    perform portal.registrar_evento(new.solicitud_id, 'documento_aportado',
      jsonb_build_object('documento', new.id, 'requisito', new.requisito_id, 'titulo', tit, 'version', new.version, 'archivo', new.nombre_original), true);
    if not portal.es_personal() then perform portal.avisar_despacho(new.solicitud_id); end if;
  elsif new.estado is distinct from old.estado then
    perform portal.registrar_evento(new.solicitud_id, 'documento_revisado',
      jsonb_build_object('documento', new.id, 'requisito', new.requisito_id, 'titulo', tit, 'version', new.version, 'a', new.estado, 'motivo', new.motivo), true);
  end if;
  return null;
end $$;
create trigger documento_despues after insert or update on portal.documentos for each row execute function portal.t_documento_despues();

-- ── Mensajes y notas internas ─────────────────────────────────────────────────────────
create function portal.t_mensaje_antes() returns trigger language plpgsql as $$
begin
  new.autor_id := portal.uid();
  new.del_despacho := portal.es_personal();
  new.created_at := now();
  new.leido_at := null;
  return new;
end $$;
create trigger mensaje_antes before insert on portal.mensajes for each row execute function portal.t_mensaje_antes();

create function portal.t_mensaje_despues() returns trigger language plpgsql security definer
set search_path = portal, pg_temp as $$
begin
  perform portal.registrar_evento(new.solicitud_id, 'mensaje', jsonb_build_object('mensaje', new.id, 'del_despacho', new.del_despacho), true);
  if new.del_despacho then perform portal.avisar_cliente(new.solicitud_id); else perform portal.avisar_despacho(new.solicitud_id); end if;
  return null;
end $$;
create trigger mensaje_despues after insert on portal.mensajes for each row execute function portal.t_mensaje_despues();

create function portal.t_nota_antes() returns trigger language plpgsql as $$
begin new.autor_id := portal.uid(); new.created_at := now(); return new; end $$;
create trigger nota_antes before insert on portal.notas_internas for each row execute function portal.t_nota_antes();

-- ── Eventos: solo inserción ───────────────────────────────────────────────────────────
create function portal.t_eventos_inmutables() returns trigger language plpgsql as $$
begin raise exception 'El registro de eventos no se modifica ni se borra' using errcode = '42501'; end $$;
create trigger eventos_inmutables before update or delete on portal.eventos for each row execute function portal.t_eventos_inmutables();
create trigger documentos_sin_borrado before delete on portal.documentos for each row execute function portal.t_eventos_inmutables();

-- ── Conversión de solicitud en expediente ─────────────────────────────────────────────
create function portal.convertir_en_expediente(p_solicitud uuid, p_titulo text, p_responsable uuid) returns uuid
language plpgsql security definer set search_path = portal, pg_temp as $$
declare s record; nuevo uuid;
begin
  if not portal.es_personal() then raise exception 'Sin permiso' using errcode = '42501'; end if;
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
  perform portal.registrar_evento(s.id, 'expediente_abierto', jsonb_build_object('expediente', nuevo), true);
  perform portal.avisar_cliente(s.id);
  return nuevo;
end $$;

-- ── Row Level Security ────────────────────────────────────────────────────────────────
alter table identidad."user" enable row level security;
create policy auth_todo on identidad."user" to portal_auth using (true) with check (true);
create policy app_lectura on identidad."user" for select to portal_app using (id = portal.uid() or portal.es_personal());

alter table portal.personal enable row level security;
create policy leer on portal.personal for select to portal_app using (user_id = portal.uid() or portal.es_personal());

alter table portal.perfiles enable row level security;
create policy leer on portal.perfiles for select to portal_app using (user_id = portal.uid() or portal.es_personal());
create policy crear on portal.perfiles for insert to portal_app with check (user_id = portal.uid());
create policy editar on portal.perfiles for update to portal_app using (user_id = portal.uid()) with check (user_id = portal.uid());

alter table portal.tipos_asunto enable row level security;
create policy leer on portal.tipos_asunto for select to portal_app using (portal.uid() is not null);
create policy gestionar on portal.tipos_asunto for update to portal_app using (portal.es_personal()) with check (portal.es_personal());

alter table portal.plantillas enable row level security;
create policy leer on portal.plantillas for select to portal_app using (portal.uid() is not null);
create policy crear on portal.plantillas for insert to portal_app with check (portal.es_personal());
create policy editar on portal.plantillas for update to portal_app using (portal.es_personal()) with check (portal.es_personal());

alter table portal.plantilla_items enable row level security;
create policy leer on portal.plantilla_items for select to portal_app using (portal.uid() is not null);
create policy crear on portal.plantilla_items for insert to portal_app with check (portal.es_personal());
create policy editar on portal.plantilla_items for update to portal_app using (portal.es_personal()) with check (portal.es_personal());

alter table portal.solicitudes enable row level security;
create policy leer on portal.solicitudes for select to portal_app using (cliente_id = portal.uid() or portal.puede_ver_solicitud(id));
create policy crear on portal.solicitudes for insert to portal_app with check (cliente_id = portal.uid() or portal.es_personal());
create policy editar on portal.solicitudes for update to portal_app
  using ((cliente_id = portal.uid() and estado = 'borrador') or portal.es_personal())
  with check (cliente_id = portal.uid() or portal.es_personal());

alter table portal.expedientes enable row level security;
create policy leer on portal.expedientes for select to portal_app using (portal.puede_ver_solicitud(solicitud_id));
create policy crear on portal.expedientes for insert to portal_app with check (portal.es_personal());
create policy editar on portal.expedientes for update to portal_app using (portal.es_personal()) with check (portal.es_personal());

alter table portal.accesos enable row level security;
create policy leer on portal.accesos for select to portal_app using (portal.es_personal() or user_id = portal.uid());
create policy crear on portal.accesos for insert to portal_app with check (portal.es_personal());
create policy editar on portal.accesos for update to portal_app using (portal.es_personal()) with check (portal.es_personal());

alter table portal.requisitos enable row level security;
create policy leer on portal.requisitos for select to portal_app using (portal.puede_ver_solicitud(solicitud_id));
create policy crear on portal.requisitos for insert to portal_app with check (portal.es_personal());
create policy editar on portal.requisitos for update to portal_app using (portal.es_personal()) with check (portal.es_personal());

alter table portal.documentos enable row level security;
create policy leer on portal.documentos for select to portal_app using (portal.puede_ver_solicitud(solicitud_id));
create policy crear on portal.documentos for insert to portal_app with check (portal.puede_aportar(solicitud_id) or portal.es_personal());
create policy revisar on portal.documentos for update to portal_app using (portal.es_personal()) with check (portal.es_personal());

alter table portal.notas_internas enable row level security;
create policy leer on portal.notas_internas for select to portal_app using (portal.es_personal());
create policy crear on portal.notas_internas for insert to portal_app with check (portal.es_personal());

alter table portal.mensajes enable row level security;
create policy leer on portal.mensajes for select to portal_app using (portal.puede_ver_solicitud(solicitud_id));
create policy crear on portal.mensajes for insert to portal_app with check (portal.puede_ver_solicitud(solicitud_id) and autor_id = portal.uid());

alter table portal.eventos enable row level security;
create policy leer on portal.eventos for select to portal_app
  using (portal.es_personal() or (visible_cliente and solicitud_id is not null and portal.puede_ver_solicitud(solicitud_id)));

alter table portal.notificaciones enable row level security;
create policy despacho on portal.notificaciones for select to portal_app using (portal.es_personal());
create policy emisor on portal.notificaciones for all to portal_app
  using (current_setting('app.proceso', true) = 'notificador') with check (current_setting('app.proceso', true) = 'notificador');

-- ── Privilegios del rol de la aplicación (nunca DELETE) ───────────────────────────────
grant select on portal.personal, portal.tipos_asunto, portal.eventos to portal_app;
grant select, insert, update on portal.perfiles, portal.plantillas, portal.plantilla_items, portal.solicitudes,
  portal.expedientes, portal.accesos, portal.requisitos, portal.documentos, portal.mensajes to portal_app;
grant select, insert on portal.notas_internas to portal_app;
grant update on portal.tipos_asunto to portal_app;
grant select, update on portal.notificaciones to portal_app;
grant usage on sequence portal.seq_solicitud, portal.seq_expediente to portal_app;

revoke execute on all functions in schema portal from public;
grant execute on function portal.uid(), portal.es_personal(), portal.puede_ver_solicitud(uuid), portal.puede_aportar(uuid),
  portal.convertir_en_expediente(uuid, text, uuid) to portal_app;
-- Las funciones de disparador se ejecutan por el propio disparador; las de aviso y eventos solo desde ellas.
grant execute on function portal.t_perfil(), portal.t_solicitud_antes(), portal.t_solicitud_despues(), portal.t_requisito_antes(),
  portal.t_requisito_despues(), portal.t_documento_antes(), portal.t_documento_despues(), portal.t_mensaje_antes(),
  portal.t_mensaje_despues(), portal.t_nota_antes(), portal.t_eventos_inmutables() to portal_app;
