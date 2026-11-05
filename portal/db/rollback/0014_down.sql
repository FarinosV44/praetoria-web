-- Reversión de 0014_estilos_escritos: elimina los perfiles de estilo y sus versiones.
--   psql "$DATABASE_URL_ADMIN" -v ON_ERROR_STOP=1 -1 -f portal/db/rollback/0014_down.sql
drop table portal.bib_estilo_versiones;
drop table portal.bib_estilos;
drop function portal.t_bib_estilo();
drop function portal.t_bib_estilo_version();
delete from migraciones.aplicadas where nombre = '0014_estilos_escritos.sql';
