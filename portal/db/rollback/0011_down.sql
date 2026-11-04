-- Reversión de 0011_plazos_expediente.
--   psql "$DATABASE_URL_ADMIN" -v ON_ERROR_STOP=1 -1 -f portal/db/rollback/0011_down.sql
-- Se pierde el enlace al documento de origen y la marca de «fecha sugerida» de las tareas (el resto se conserva).
CREATE OR REPLACE FUNCTION portal.t_agenda_historial()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'portal', 'pg_temp'
AS $function$
begin
  if new.solicitud_id is null then return null; end if;
  if tg_op = 'INSERT' then
    if new.propietario_id <> portal.uid() then
      perform portal.registrar_evento(new.solicitud_id, 'tarea_encargada', jsonb_build_object('tarea', new.titulo, 'a', new.propietario_id), false);
      perform portal.encolar_aviso(new.propietario_id, 'despacho', 'aviso_interno', new.solicitud_id, interval '0');
    end if;
    return null;
  end if;
  if new.propietario_id is distinct from old.propietario_id then
    perform portal.registrar_evento(new.solicitud_id, 'tarea_reasignada', jsonb_build_object('tarea', new.titulo, 'de', old.propietario_id, 'a', new.propietario_id), false);
    perform portal.encolar_aviso(new.propietario_id, 'despacho', 'aviso_interno', new.solicitud_id, interval '0');
  end if;
  if new.estado = 'completado' and old.estado <> 'completado' then
    perform portal.registrar_evento(new.solicitud_id, 'tarea_completada', jsonb_build_object('tarea', new.titulo, 'resultado', new.resultado), false);
  end if;
  return null;
end $function$

;
drop trigger agenda_documento on portal.agenda_eventos;
drop function portal.t_agenda_documento();
revoke update (documento_id) on portal.agenda_eventos from portal_app;
alter table portal.agenda_eventos drop column origen_fecha, drop column documento_id;
delete from migraciones.aplicadas where nombre = '0011_plazos_expediente.sql';
