-- 0011 · Plazos desde el expediente (#51): documento de origen, estado de la fecha y auditoría de cambios.
-- Una fecha nunca se da por definitiva sola: queda «sugerida» (propuesta, p. ej. por IA en #48) o
-- «pendiente de verificar» hasta que un profesional confirma el cómputo; cambiarla anula la verificación.

alter table portal.agenda_eventos
  add column documento_id uuid references portal.documentos(id) on delete set null,
  add column origen_fecha text not null default 'manual' check (origen_fecha in ('manual', 'sugerida'));

-- El documento de origen tiene que ser del mismo asunto (y la persona tiene que poder verlo).
create function portal.t_agenda_documento() returns trigger language plpgsql
set search_path = portal, pg_temp as $$
begin
  if new.documento_id is not null and (tg_op = 'INSERT' or new.documento_id is distinct from old.documento_id) then
    if new.solicitud_id is null or not exists (select 1 from portal.documentos d where d.id = new.documento_id and d.solicitud_id = new.solicitud_id) then
      raise exception 'El documento de origen debe ser de este mismo asunto';
    end if;
  end if;
  return new;
end $$;
create trigger agenda_documento before insert or update on portal.agenda_eventos for each row execute function portal.t_agenda_documento();
grant update (documento_id) on portal.agenda_eventos to portal_app;

-- Historial: además de encargos, reasignaciones y cierres, las verificaciones y los cambios de fecha.
create or replace function portal.t_agenda_historial() returns trigger language plpgsql security definer
set search_path = portal, pg_temp as $$
begin
  if new.solicitud_id is null then return null; end if;
  if tg_op = 'INSERT' then
    if new.propietario_id <> portal.uid() then
      perform portal.registrar_evento(new.solicitud_id, 'tarea_encargada', jsonb_build_object('tarea', new.titulo, 'a', new.propietario_id), false);
      perform portal.encolar_aviso(new.propietario_id, 'despacho', 'aviso_interno', new.solicitud_id, interval '0');
    end if;
    if new.plazo_verificado_at is not null then
      perform portal.registrar_evento(new.solicitud_id, 'plazo_verificado', jsonb_build_object('tarea', new.titulo, 'fecha', new.inicio), false);
    end if;
    return null;
  end if;
  if new.propietario_id is distinct from old.propietario_id then
    perform portal.registrar_evento(new.solicitud_id, 'tarea_reasignada', jsonb_build_object('tarea', new.titulo, 'de', old.propietario_id, 'a', new.propietario_id), false);
    perform portal.encolar_aviso(new.propietario_id, 'despacho', 'aviso_interno', new.solicitud_id, interval '0');
  end if;
  if new.inicio is distinct from old.inicio then
    perform portal.registrar_evento(new.solicitud_id, 'tarea_reprogramada',
      jsonb_build_object('tarea', new.titulo, 'desde', old.inicio, 'hasta', new.inicio, 'verificacion_anulada', old.plazo_verificado_at is not null and new.plazo_verificado_at is null), false);
    -- Si lo cambia otra persona, se avisa al responsable (aviso neutro, sin la fecha ni el asunto).
    if new.propietario_id <> portal.uid() then perform portal.encolar_aviso(new.propietario_id, 'despacho', 'aviso_interno', new.solicitud_id, interval '0'); end if;
  end if;
  if new.plazo_verificado_at is not null and old.plazo_verificado_at is null then
    perform portal.registrar_evento(new.solicitud_id, 'plazo_verificado', jsonb_build_object('tarea', new.titulo, 'fecha', new.inicio), false);
  end if;
  if new.estado = 'completado' and old.estado <> 'completado' then
    perform portal.registrar_evento(new.solicitud_id, 'tarea_completada', jsonb_build_object('tarea', new.titulo, 'resultado', new.resultado), false);
  end if;
  return null;
end $$;
