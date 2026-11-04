-- Reversión de 0009_expediente_conversacional. Ejecutar en una sola transacción con el rol administrador:
--   psql "$DATABASE_URL_ADMIN" -v ON_ERROR_STOP=1 -1 -f portal/db/rollback/0009_down.sql
-- Se NIEGA a ejecutarse si ya hay datos que solo existen gracias a 0009 (documentos sin requisito o DOCX,
-- clientes sin privacidad aceptada): borrarlos sería perder información, así que primero hay que decidir qué hacer con ellos.
do $$ begin
  if exists (select 1 from portal.documentos where requisito_id is null or mime not in ('application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif'))
     or exists (select 1 from portal.perfiles where version_privacidad is null or acepta_privacidad_at is null) then
    raise exception 'Hay datos creados con 0009 (documentos sin requisito o DOCX, o clientes sin privacidad aceptada): revísalos antes de revertir';
  end if;
end $$;

revoke execute on function portal.crear_cliente(text, text, portal.tipo_cliente, text, text, text), portal.invitar_cliente(uuid, text),
  portal.aceptar_privacidad(uuid, text), portal.invitacion_tipo(text), portal.abrir_expediente(uuid, text, text, uuid) from portal_app;
drop table portal.recientes;
alter table portal.notas_internas drop column fuente;

-- Funciones de disparador y avisos tal como quedaron en 0008
CREATE OR REPLACE FUNCTION portal.avisar_cliente(sid uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'portal', 'pg_temp'
AS $function$
declare c uuid;
begin
  select cliente_id into c from portal.solicitudes where id = sid and estado <> 'borrador';
  if c is not null then perform portal.encolar_aviso(c, 'cliente', 'novedades', sid, interval '2 minutes'); end if;
end $function$

;

CREATE OR REPLACE FUNCTION portal.t_documento_antes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'portal', 'pg_temp'
AS $function$
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
end $function$

;

CREATE OR REPLACE FUNCTION portal.t_documento_despues()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'portal', 'pg_temp'
AS $function$
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
end $function$

;

revoke update (visible_cliente, carpeta) on portal.documentos from portal_app;
drop policy leer on portal.documentos;
create policy leer on portal.documentos for select to portal_app using (portal.puede_ver_solicitud(solicitud_id));
alter table portal.documentos drop constraint documentos_mime_check, add constraint documentos_mime_check check (mime in
  ('application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'));
alter table portal.documentos drop column compartido_at, drop column compartido_por, drop column origen, drop column carpeta, drop column visible_cliente;
alter table portal.documentos alter column requisito_id set not null;

drop function portal.abrir_expediente(uuid, text, text, uuid);
drop function portal.aceptar_privacidad(uuid, text);
drop function portal.invitacion_tipo(text);
drop function portal.invitar_cliente(uuid, text);
drop function portal.crear_cliente(text, text, portal.tipo_cliente, text, text, text);

drop policy editar_despacho on portal.perfiles;
alter table portal.perfiles alter column version_privacidad set not null, alter column acepta_privacidad_at set not null;
alter table portal.perfiles drop column creado_por, drop column pais, drop column provincia, drop column localidad,
  drop column codigo_postal, drop column direccion, drop column nif;

revoke execute on all functions in schema portal from public;
delete from migraciones.aplicadas where nombre = '0009_expediente_conversacional.sql';
