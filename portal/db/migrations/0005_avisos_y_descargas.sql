-- 0005 · Envío de avisos, recordatorios de documentación y registro de descargas.

-- Registro de cada descarga (auditoría interna, no visible al cliente).
create function portal.registrar_descarga(p_documento uuid) returns void language plpgsql security definer
set search_path = portal, pg_temp as $$
declare sid uuid;
begin
  select solicitud_id into sid from portal.documentos where id = p_documento;
  if sid is null or not portal.puede_ver_solicitud(sid) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  perform portal.registrar_evento(sid, 'documento_descargado', jsonb_build_object('documento', p_documento), false);
end $$;

create function portal.es_notificador() returns boolean language sql stable as $$
  select current_setting('app.proceso', true) = 'notificador'
$$;

-- Devuelve los avisos listos para enviar con el correo del destinatario. Solo el proceso notificador.
create function portal.tomar_avisos(p_ignorar_retraso boolean, p_limite int)
returns table (id uuid, destino text, tipo text, email text) language plpgsql security definer
set search_path = portal, pg_temp as $$
begin
  if not portal.es_notificador() then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return query
    with t as (
      select n.id from portal.notificaciones n
      where n.estado = 'pendiente' and n.intentos < 5 and (p_ignorar_retraso or n.enviar_despues <= now())
      order by n.created_at limit p_limite for update skip locked
    )
    update portal.notificaciones n set intentos = n.intentos + 1
    from t where n.id = t.id
    returning n.id, n.destino, n.tipo, (select u.email from identidad."user" u where u.id = n.destinatario_id);
end $$;

create function portal.marcar_aviso(p_id uuid, p_ok boolean, p_error text) returns void language plpgsql security definer
set search_path = portal, pg_temp as $$
begin
  if not portal.es_notificador() then raise exception 'Sin permiso' using errcode = '42501'; end if;
  update portal.notificaciones
     set estado = case when p_ok then 'enviada' when intentos >= 5 then 'error' else 'pendiente' end,
         enviada_at = case when p_ok then now() end,
         ultimo_error = case when p_ok then null else left(p_error, 300) end
   where id = p_id;
end $$;

-- Recordatorios de documentación obligatoria pendiente. Se dejan de programar cuando no falta nada,
-- como máximo uno cada p_dias días por solicitud y un máximo de 4 por solicitud.
create function portal.programar_recordatorios(p_dias int) returns int language plpgsql security definer
set search_path = portal, pg_temp as $$
declare n int;
begin
  if not portal.es_notificador() then raise exception 'Sin permiso' using errcode = '42501'; end if;
  with candidatas as (
    select s.id, s.cliente_id from portal.solicitudes s
    where s.estado in ('enviada', 'en_revision', 'aceptada')
      and exists (select 1 from portal.requisitos r where r.solicitud_id = s.id and r.obligatorio
                  and r.estado in ('pendiente', 'subsanacion') and r.updated_at < now() - make_interval(days => p_dias))
      and not exists (select 1 from portal.notificaciones x where x.solicitud_id = s.id and x.tipo = 'recordatorio'
                      and (x.estado = 'pendiente' or x.created_at > now() - make_interval(days => p_dias)))
      and (select count(*) from portal.notificaciones x where x.solicitud_id = s.id and x.tipo = 'recordatorio' and x.estado = 'enviada') < 4
  )
  insert into portal.notificaciones (destinatario_id, destino, tipo, solicitud_id)
    select cliente_id, 'cliente', 'recordatorio', id from candidatas
  on conflict do nothing;
  get diagnostics n = row_count;
  -- Si ya no falta nada, los recordatorios pendientes se cancelan.
  update portal.notificaciones x set estado = 'cancelada'
   where x.tipo = 'recordatorio' and x.estado = 'pendiente'
     and not exists (select 1 from portal.requisitos r where r.solicitud_id = x.solicitud_id and r.obligatorio and r.estado in ('pendiente', 'subsanacion'));
  return n;
end $$;

grant execute on function portal.registrar_descarga(uuid), portal.es_notificador(), portal.tomar_avisos(boolean, int),
  portal.marcar_aviso(uuid, boolean, text), portal.programar_recordatorios(int) to portal_app;
