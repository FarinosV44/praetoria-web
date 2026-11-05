-- Reversión de 0013_biblioteca_juridica: elimina la biblioteca (modelos, versiones, catálogo).
-- Los archivos originales quedan en el almacenamiento bajo «biblioteca/»: bórralos aparte si procede.
--   psql "$DATABASE_URL_ADMIN" -v ON_ERROR_STOP=1 -1 -f portal/db/rollback/0013_down.sql
drop table portal.bib_usos;
drop table portal.bib_versiones;
drop function portal.bib_aprobar(uuid, boolean);
drop function portal.bib_ve_modelo(uuid);
drop table portal.bib_modelos cascade;   -- arrastra bib_puede_ver(), que usa su tipo de fila
drop function portal.bib_puede_subir();
drop function portal.t_bib_modelo();
drop function portal.t_bib_version();
drop table portal.bib_procedimientos;
drop table portal.bib_materias;
delete from migraciones.aplicadas where nombre = '0013_biblioteca_juridica.sql';
