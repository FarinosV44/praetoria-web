-- 0016 · Papelera de documentos del expediente y cierre/reapertura de expedientes.
-- · «Eliminar» lleva el documento a la papelera: desaparece para todos (cronología, cliente, búsqueda, descargas
--   e IA) porque la RLS deja de devolverlo, pero se puede restaurar durante 30 días. Pasado ese plazo, la tarea
--   periódica borra el archivo del almacenamiento y su texto extraído; queda solo el registro (quién, cuándo, por qué).
-- · Lo pueden eliminar y restaurar quienes pueden escribir en el asunto (nunca el cliente ni el rol de lectura).
-- · Cerrar y reabrir un expediente queda en la cronología.

alter table portal.documentos
  add column eliminado_at timestamptz,
  add column eliminado_por uuid references portal.personal(user_id),
  add column eliminado_motivo text check (length(eliminado_motivo) <= 300),
  add column purgado_at timestamptz;
create index documentos_papelera on portal.documentos (eliminado_at) where eliminado_at is not null and purgado_at is null;

-- Lo que está en la papelera no lo ve nadie por la vía normal.
drop policy leer on portal.documentos;
create policy leer on portal.documentos for select to portal_app
  using (eliminado_at is null and (portal.personal_ve(solicitud_id) or (visible_cliente and portal.puede_ver_solicitud(solicitud_id))));

create function portal.documento_eliminar(p_doc uuid, p_motivo text) returns void language plpgsql security definer
set search_path = portal, pg_temp as $$
declare d portal.documentos;
begin
  select * into d from portal.documentos where id = p_doc for update;
  if not found or d.eliminado_at is not null or not portal.personal_escribe(d.solicitud_id) then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  update portal.documentos set eliminado_at = now(), eliminado_por = portal.uid(), eliminado_motivo = nullif(left(trim(coalesce(p_motivo, '')), 300), '')
   where id = p_doc;
  -- Si cumplía un requisito y no queda otro documento vivo para él, el requisito vuelve a estar pendiente.
  if d.requisito_id is not null and not exists (select 1 from portal.documentos x where x.requisito_id = d.requisito_id and x.id <> d.id and x.eliminado_at is null) then
    update portal.requisitos set estado = 'pendiente' where id = d.requisito_id and estado in ('recibido', 'en_revision');
  end if;
  perform portal.registrar_evento(d.solicitud_id, 'documento_eliminado',
    jsonb_build_object('documento', d.id, 'archivo', d.nombre_original, 'version', d.version, 'motivo', nullif(trim(coalesce(p_motivo, '')), '')), false);
end $$;

create function portal.documento_restaurar(p_doc uuid) returns void language plpgsql security definer
set search_path = portal, pg_temp as $$
declare d portal.documentos;
begin
  select * into d from portal.documentos where id = p_doc for update;
  if not found or d.eliminado_at is null or not portal.personal_escribe(d.solicitud_id) then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  if d.purgado_at is not null or d.eliminado_at < now() - interval '30 days' then
    raise exception 'Han pasado más de 30 días: el archivo ya no se puede restaurar';
  end if;
  update portal.documentos set eliminado_at = null, eliminado_por = null, eliminado_motivo = null where id = p_doc;
  if d.requisito_id is not null then
    update portal.requisitos set estado = 'recibido' where id = d.requisito_id and estado = 'pendiente';
  end if;
  perform portal.registrar_evento(d.solicitud_id, 'documento_restaurado', jsonb_build_object('documento', d.id, 'archivo', d.nombre_original, 'version', d.version), false);
end $$;

-- Papelera de un asunto: solo para quien ve el asunto (personal).
create function portal.papelera(p_sid uuid) returns table (id uuid, nombre text, carpeta text, version int, mime text, tamano int,
    eliminado_at timestamptz, eliminado_por text, motivo text, purgado_at timestamptz)
language sql stable security definer set search_path = portal, pg_temp as $$
  select d.id, d.nombre_original, coalesce(q.carpeta, d.carpeta), d.version, d.mime, d.tamano, d.eliminado_at, p.nombre_visible, d.eliminado_motivo, d.purgado_at
    from portal.documentos d left join portal.requisitos q on q.id = d.requisito_id left join portal.personal p on p.user_id = d.eliminado_por
   where d.solicitud_id = p_sid and d.eliminado_at is not null and portal.personal_ve(p_sid)
   order by d.eliminado_at desc
$$;

-- Purga (solo la tarea periódica, que no actúa como ninguna persona): documentos con más de 30 días en la papelera.
create function portal.papelera_por_purgar(p_limite int) returns table (id uuid, storage_key text)
language sql stable security definer set search_path = portal, pg_temp as $$
  select d.id, d.storage_key from portal.documentos d
   where portal.uid() is null and d.eliminado_at < now() - interval '30 days' and d.purgado_at is null
   order by d.eliminado_at limit least(greatest(p_limite, 1), 50)
$$;
create function portal.papelera_marcar_purgado(p_doc uuid) returns void language plpgsql security definer
set search_path = portal, pg_temp as $$
declare d portal.documentos;
begin
  if portal.uid() is not null then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into d from portal.documentos where id = p_doc and eliminado_at < now() - interval '30 days' and purgado_at is null for update;
  if not found then return; end if;
  delete from portal.documentos_texto where documento_id = p_doc;
  update portal.documentos set purgado_at = now() where id = p_doc;
  perform portal.registrar_evento(d.solicitud_id, 'documento_purgado', jsonb_build_object('documento', d.id, 'archivo', d.nombre_original, 'version', d.version), false);
end $$;

-- Cerrar o reabrir el expediente.
create function portal.expediente_estado(p_sid uuid, p_cerrar boolean) returns void language plpgsql security definer
set search_path = portal, pg_temp as $$
declare e portal.expedientes;
begin
  if not portal.personal_escribe(p_sid) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into e from portal.expedientes where solicitud_id = p_sid for update;
  if not found then raise exception 'Este asunto no tiene expediente abierto'; end if;
  if p_cerrar and e.estado = 'activo' then
    update portal.expedientes set estado = 'cerrado', cerrado_at = now() where id = e.id;
    perform portal.registrar_evento(p_sid, 'expediente_cerrado', '{}', false);
  elsif not p_cerrar and e.estado = 'cerrado' then
    update portal.expedientes set estado = 'activo', cerrado_at = null where id = e.id;
    perform portal.registrar_evento(p_sid, 'expediente_reabierto', '{}', false);
  end if;
end $$;

revoke execute on function portal.documento_eliminar(uuid, text), portal.documento_restaurar(uuid), portal.papelera(uuid),
  portal.papelera_por_purgar(int), portal.papelera_marcar_purgado(uuid), portal.expediente_estado(uuid, boolean) from public;
grant execute on function portal.documento_eliminar(uuid, text), portal.documento_restaurar(uuid), portal.papelera(uuid),
  portal.papelera_por_purgar(int), portal.papelera_marcar_purgado(uuid), portal.expediente_estado(uuid, boolean) to portal_app;
