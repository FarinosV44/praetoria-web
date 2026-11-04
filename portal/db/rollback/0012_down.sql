-- Reversión de 0012_ia_expediente: borra las conversaciones con la IA y el texto extraído de los documentos.
--   psql "$DATABASE_URL_ADMIN" -v ON_ERROR_STOP=1 -1 -f portal/db/rollback/0012_down.sql
-- (Deliberadamente NO se devuelve a public la ejecución de portal.t_agenda_documento: quitarla solo endurece.)
drop table portal.ia_mensajes;
drop table portal.ia_hilos;
drop table portal.documentos_texto;
drop function portal.t_ia_mensaje();
drop function portal.t_ia_hilo();
delete from migraciones.aplicadas where nombre = '0012_ia_expediente.sql';
