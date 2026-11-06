-- Reversión de 0017_copiloto_ia. Elimina lo que añade (configuración, consumo, ejecuciones, fragmentos, cola de indexación)
-- y las conversaciones de despacho, que no tienen asunto. Conserva hilos y mensajes de los expedientes.
--   psql "$DATABASE_URL_ADMIN" -v ON_ERROR_STOP=1 -1 -f portal/db/rollback/0017_down.sql
drop trigger indexar_documento on portal.documentos;
drop trigger purgar_fragmentos on portal.documentos;
drop trigger indexar_version on portal.bib_versiones;
drop trigger indexar_aprobado on portal.bib_modelos;
drop policy actualizar_texto on portal.documentos_texto;
drop policy actualizar_ocr on portal.bib_versiones;
drop table portal.ia_indexacion, portal.doc_fragmentos, portal.bib_fragmentos, portal.ia_ejecuciones, portal.ia_auditoria, portal.ia_consumo, portal.ia_ajustes;
drop function portal.t_indexar_documento(), portal.t_indexar_version(), portal.t_indexar_aprobado(), portal.t_purgar_fragmentos(),
  portal.ia_indexacion_tomar(int), portal.ia_ejecutor(), portal.ia_reindexar(text, uuid), portal.ia_gasto(timestamptz), portal.ia_consultas_hora(),
  portal.t_ia_autor(), portal.t_ia_ajustes();

drop policy leer on portal.ia_hilos;
drop policy crear on portal.ia_hilos;
drop policy leer on portal.ia_mensajes;
drop policy crear on portal.ia_mensajes;
drop function portal.ia_usa_biblioteca();
delete from portal.ia_hilos where solicitud_id is null;
alter table portal.ia_mensajes alter column solicitud_id set not null;
alter table portal.ia_hilos drop constraint ia_hilos_ambito_asunto, drop column ambito, alter column solicitud_id set not null;
alter table portal.ia_mensajes drop column proveedor, drop column modo, drop column fallback, drop column coste_usd;
create policy leer on portal.ia_hilos for select to portal_app using (portal.personal_ve(solicitud_id));
create policy crear on portal.ia_hilos for insert to portal_app with check (portal.personal_escribe(solicitud_id));
create policy leer on portal.ia_mensajes for select to portal_app using (portal.personal_ve(solicitud_id));
create policy crear on portal.ia_mensajes for insert to portal_app with check (portal.personal_escribe(solicitud_id));
create or replace function portal.t_ia_mensaje() returns trigger language plpgsql
set search_path = portal, pg_temp as $$
begin
  if not exists (select 1 from portal.ia_hilos h where h.id = new.hilo_id and h.solicitud_id = new.solicitud_id) then
    raise exception 'El mensaje no pertenece a ese asunto';
  end if;
  new.autor_id := portal.uid();
  new.created_at := now();
  return new;
end $$;
alter table portal.bib_versiones drop column texto_ocr;
alter table portal.documentos_texto drop column metodo;
delete from migraciones.aplicadas where nombre = '0017_copiloto_ia.sql';
