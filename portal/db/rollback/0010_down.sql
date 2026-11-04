-- Reversión de 0010_equipo_asignaciones: vuelve a «todo el personal activo ve todos los asuntos».
--   psql "$DATABASE_URL_ADMIN" -v ON_ERROR_STOP=1 -1 -f portal/db/rollback/0010_down.sql
-- Se niega si hay personal con los roles nuevos (facturacion, lectura): habría que cambiarles el rol antes.
-- Los valores nuevos del tipo rol_personal se quedan (PostgreSQL no permite quitarlos); sin uso, no tienen efecto.
do $$ begin
  if exists (select 1 from portal.personal where rol::text in ('facturacion', 'lectura')) then
    raise exception 'Hay personal con rol facturacion o lectura: cámbialo antes de revertir';
  end if;
end $$;

drop trigger agenda_historial on portal.agenda_eventos;
drop function portal.t_agenda_historial();
CREATE OR REPLACE FUNCTION portal.t_agenda_antes()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'portal', 'pg_temp'
AS $function$
begin
  if tg_op = 'INSERT' then
    if not portal.es_personal() then raise exception 'Sin permiso' using errcode = '42501'; end if;
    new.propietario_id := portal.uid();
    new.version := 1;
    new.created_at := now();
  else
    new.id := old.id; new.propietario_id := old.propietario_id; new.created_at := old.created_at;
    if (new.inicio, new.repeticion, new.repetir_hasta, new.avisos_min, new.estado)
       is distinct from (old.inicio, old.repeticion, old.repetir_hasta, old.avisos_min, old.estado) then
      new.version := old.version + 1;
    end if;
    -- Cambiar la fecha de un plazo anula su verificación: hay que volver a comprobarla.
    if new.tipo = 'plazo' and new.inicio is distinct from old.inicio then
      new.plazo_verificado_por := null; new.plazo_verificado_at := null;
    end if;
  end if;
  if new.plazo_verificado_at is not null and (tg_op = 'INSERT' or old.plazo_verificado_at is null) then
    new.plazo_verificado_por := portal.uid(); new.plazo_verificado_at := now();
  end if;
  new.updated_at := now();
  return new;
end $function$

;

CREATE OR REPLACE FUNCTION portal.convertir_en_expediente(p_solicitud uuid, p_titulo text, p_responsable uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'portal', 'pg_temp'
AS $function$
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
end $function$

;

CREATE OR REPLACE FUNCTION portal.abrir_expediente(p_cliente uuid, p_titulo text, p_tipo text, p_responsable uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'portal', 'pg_temp'
AS $function$
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
end $function$

;

CREATE OR REPLACE FUNCTION portal.crear_cliente(p_email text, p_nombre text, p_tipo portal.tipo_cliente, p_empresa text, p_telefono text, p_nif text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'portal', 'pg_temp'
AS $function$
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
end $function$

;

CREATE OR REPLACE FUNCTION portal.invitar_cliente(p_user uuid, p_sha text)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'portal', 'pg_temp'
AS $function$
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
end $function$

;

CREATE OR REPLACE FUNCTION portal.puede_ver_solicitud(sid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'portal', 'pg_temp'
AS $function$
  select portal.es_personal()
      or exists (select 1 from portal.solicitudes s where s.id = sid and s.cliente_id = portal.uid())
      or exists (select 1 from portal.accesos a where a.solicitud_id = sid and a.user_id = portal.uid() and a.revocado_at is null)
$function$

;

drop policy crear on portal.documentos;
drop policy leer on portal.documentos;
drop policy revisar on portal.documentos;
create policy crear on portal.documentos as PERMISSIVE for INSERT to portal_app with check ((portal.puede_aportar(solicitud_id) OR portal.es_personal()));
create policy revisar on portal.documentos as PERMISSIVE for UPDATE to portal_app using (portal.es_personal()) with check (portal.es_personal());
create policy leer on portal.documentos as PERMISSIVE for SELECT to portal_app using ((portal.es_personal() OR (visible_cliente AND portal.puede_ver_solicitud(solicitud_id))));
drop policy leer on portal.eventos;
create policy leer on portal.eventos as PERMISSIVE for SELECT to portal_app using ((portal.es_personal() OR (visible_cliente AND (solicitud_id IS NOT NULL) AND portal.puede_ver_solicitud(solicitud_id))));
drop policy crear on portal.expedientes;
drop policy editar on portal.expedientes;
drop policy leer on portal.expedientes;
create policy leer on portal.expedientes as PERMISSIVE for SELECT to portal_app using (portal.puede_ver_solicitud(solicitud_id));
create policy crear on portal.expedientes as PERMISSIVE for INSERT to portal_app with check (portal.es_personal());
create policy editar on portal.expedientes as PERMISSIVE for UPDATE to portal_app using (portal.es_personal()) with check (portal.es_personal());
drop policy crear on portal.notas_internas;
drop policy leer on portal.notas_internas;
create policy leer on portal.notas_internas as PERMISSIVE for SELECT to portal_app using (portal.es_personal());
create policy crear on portal.notas_internas as PERMISSIVE for INSERT to portal_app with check (portal.es_personal());
drop policy despacho on portal.notificaciones;
create policy despacho on portal.notificaciones as PERMISSIVE for SELECT to portal_app using (portal.es_personal());
drop policy crear on portal.requisitos;
drop policy editar on portal.requisitos;
drop policy leer on portal.requisitos;
create policy leer on portal.requisitos as PERMISSIVE for SELECT to portal_app using (portal.puede_ver_solicitud(solicitud_id));
create policy crear on portal.requisitos as PERMISSIVE for INSERT to portal_app with check (portal.es_personal());
create policy editar on portal.requisitos as PERMISSIVE for UPDATE to portal_app using (portal.es_personal()) with check (portal.es_personal());
drop policy crear on portal.solicitudes;
drop policy editar on portal.solicitudes;
drop policy leer on portal.solicitudes;
create policy leer on portal.solicitudes as PERMISSIVE for SELECT to portal_app using (((cliente_id = portal.uid()) OR portal.puede_ver_solicitud(id)));
create policy crear on portal.solicitudes as PERMISSIVE for INSERT to portal_app with check (((cliente_id = portal.uid()) OR portal.es_personal()));
create policy editar on portal.solicitudes as PERMISSIVE for UPDATE to portal_app using ((((cliente_id = portal.uid()) AND (estado = 'borrador'::portal.estado_solicitud)) OR portal.es_personal())) with check (((cliente_id = portal.uid()) OR portal.es_personal()));
drop policy crear on portal.accesos;
drop policy editar on portal.accesos;
drop policy leer on portal.accesos;
create policy leer on portal.accesos as PERMISSIVE for SELECT to portal_app using ((portal.es_personal() OR (user_id = portal.uid())));
create policy crear on portal.accesos as PERMISSIVE for INSERT to portal_app with check (portal.es_personal());
create policy editar on portal.accesos as PERMISSIVE for UPDATE to portal_app using (portal.es_personal()) with check (portal.es_personal());
drop policy crear on portal.mensajes;
drop policy leer on portal.mensajes;
create policy leer on portal.mensajes as PERMISSIVE for SELECT to portal_app using (portal.puede_ver_solicitud(solicitud_id));
create policy crear on portal.mensajes as PERMISSIVE for INSERT to portal_app with check ((portal.puede_ver_solicitud(solicitud_id) AND (autor_id = portal.uid())));
drop policy crear on portal.perfiles;
drop policy editar on portal.perfiles;
drop policy editar_despacho on portal.perfiles;
drop policy leer on portal.perfiles;
create policy leer on portal.perfiles as PERMISSIVE for SELECT to portal_app using (((user_id = portal.uid()) OR portal.es_personal()));
create policy crear on portal.perfiles as PERMISSIVE for INSERT to portal_app with check ((user_id = portal.uid()));
create policy editar on portal.perfiles as PERMISSIVE for UPDATE to portal_app using ((user_id = portal.uid())) with check ((user_id = portal.uid()));
create policy editar_despacho on portal.perfiles as PERMISSIVE for UPDATE to portal_app using (portal.es_personal()) with check (portal.es_personal());
drop policy borrar on portal.agenda_eventos;
drop policy crear on portal.agenda_eventos;
drop policy editar on portal.agenda_eventos;
drop policy leer on portal.agenda_eventos;
create policy propia on portal.agenda_eventos as PERMISSIVE for ALL to portal_app using (((propietario_id = portal.uid()) AND portal.es_personal())) with check (((propietario_id = portal.uid()) AND portal.es_personal()));
drop policy app_lectura on identidad."user";
create policy app_lectura on identidad."user" for select to portal_app using (((id = portal.uid()) OR portal.es_personal()));
revoke update (propietario_id, suplente_id, resultado) on portal.agenda_eventos from portal_app;
alter table portal.agenda_eventos drop column completada_at, drop column completada_por, drop column resultado, drop column asignada_por, drop column suplente_id;

drop function portal.cambiar_responsable(uuid, uuid);
drop function portal.retirar_asignacion(uuid, uuid);
drop function portal.asignar(uuid, uuid, text);
drop function portal.puede_gestionar_asunto(uuid);
drop function portal.cambiar_empleado(uuid, text, boolean);
drop function portal.invitar_empleado(uuid, text);
drop function portal.crear_empleado(text, text, text);
drop table portal.asignaciones;
drop function portal.personal_ve_cliente(uuid);
drop function portal.personal_escribe(uuid);
drop function portal.personal_ve(uuid);
drop function portal.ve_asunto(uuid, uuid);
drop function portal.es_global();
drop function portal.rol_actual();

revoke execute on all functions in schema portal from public;
delete from migraciones.aplicadas where nombre = '0010_equipo_asignaciones.sql';
