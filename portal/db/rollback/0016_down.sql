-- Reversión de 0016_papelera_y_cierre. ATENCIÓN: los documentos que estén en la papelera vuelven a verse.
--   psql "$DATABASE_URL_ADMIN" -v ON_ERROR_STOP=1 -1 -f portal/db/rollback/0016_down.sql
drop function portal.documento_eliminar(uuid, text);
drop function portal.documento_restaurar(uuid);
drop function portal.papelera(uuid);
drop function portal.papelera_por_purgar(int);
drop function portal.papelera_marcar_purgado(uuid);
drop function portal.expediente_estado(uuid, boolean);
drop policy leer on portal.documentos;
create policy leer on portal.documentos for select to portal_app
  using (portal.personal_ve(solicitud_id) or (visible_cliente and portal.puede_ver_solicitud(solicitud_id)));
drop index portal.documentos_papelera;
alter table portal.documentos drop column eliminado_at, drop column eliminado_por, drop column eliminado_motivo, drop column purgado_at;
delete from migraciones.aplicadas where nombre = '0016_papelera_y_cierre.sql';
