-- Reversión de 0015_escritos_borradores: elimina los borradores de escritos y deja bib_usos como en 0013.
--   psql "$DATABASE_URL_ADMIN" -v ON_ERROR_STOP=1 -1 -f portal/db/rollback/0015_down.sql
drop policy crear on portal.bib_usos;
alter table portal.bib_usos drop column escrito_version_id;
create policy crear on portal.bib_usos for insert to portal_app with check (portal.personal_escribe(solicitud_id) and portal.bib_ve_modelo((select modelo_id from portal.bib_versiones where id = version_id)));
drop table portal.escrito_versiones;
drop table portal.escritos;
drop function portal.t_escrito();
drop function portal.t_escrito_version();
drop function portal.bib_usable(uuid);
delete from migraciones.aplicadas where nombre = '0015_escritos_borradores.sql';
