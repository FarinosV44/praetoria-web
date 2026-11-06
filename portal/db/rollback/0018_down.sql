-- Reversión de 0018_expediente_automatizaciones. Elimina análisis, propuestas y vistas guardadas, y los datos procesales añadidos al expediente.
--   psql "$DATABASE_URL_ADMIN" -v ON_ERROR_STOP=1 -1 -f portal/db/rollback/0018_down.sql
drop function portal.ia_propuesta_decidir(uuid, boolean, date);
drop table portal.ia_propuestas, portal.doc_analisis, portal.vistas_guardadas;
alter table portal.expedientes drop column organo, drop column numero_autos, drop column procedimiento_id;
delete from migraciones.aplicadas where nombre = '0018_expediente_automatizaciones.sql';
