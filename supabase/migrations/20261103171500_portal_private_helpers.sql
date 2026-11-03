-- Las funciones auxiliares de las políticas RLS no deben poder llamarse por la API (/rest/v1/rpc).
-- Se mueven a un esquema «private» que PostgREST no expone; las políticas las siguen usando (van por OID).
-- Avisos 0028/0029 del asesor de seguridad de Supabase.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

alter function public.is_staff() set schema private;
alter function public.owns_intake(uuid) set schema private;
alter function public.intake_editable_by_client(uuid) set schema private;
alter function public.is_verified_member(uuid) set schema private;
alter function public.intake_id_from_path(text) set schema private;
alter function public.log_intake_event(uuid, text, boolean, jsonb) set schema private;

revoke all on function private.is_staff() from public, anon;
revoke all on function private.owns_intake(uuid) from public, anon;
revoke all on function private.intake_editable_by_client(uuid) from public, anon;
revoke all on function private.is_verified_member(uuid) from public, anon;
revoke all on function private.intake_id_from_path(text) from public, anon;
grant execute on function private.is_staff(), private.owns_intake(uuid), private.intake_editable_by_client(uuid),
  private.is_verified_member(uuid), private.intake_id_from_path(text) to authenticated;

-- Funciones cuyo cuerpo llamaba a las auxiliares por su nombre antiguo.
create or replace function public.intake_after_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.log_intake_event(new.id, 'creada', true);
  return new;
end $$;

create or replace function public.document_after_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.log_intake_event(new.intake_id, 'documento_aportado', true,
    jsonb_build_object('documento', new.id, 'nombre', new.original_name));
  return new;
end $$;

create or replace function public.submit_intake(p_intake uuid)
returns public.intake_status language plpgsql security definer set search_path = '' as $$
declare
  v public.intakes;
begin
  select * into v from public.intakes where id = p_intake and owner_id = (select auth.uid()) for update;
  if not found then
    raise exception 'Solicitud no encontrada' using errcode = 'P0002';
  end if;
  if v.status not in ('borrador', 'informacion_solicitada') then
    raise exception 'La solicitud ya está en revisión' using errcode = 'P0001';
  end if;
  if char_length(trim(v.description)) < 20 then
    raise exception 'Describe el asunto con al menos 20 caracteres' using errcode = '23514';
  end if;
  update public.intakes set status = 'pendiente_de_revision', submitted_at = coalesce(submitted_at, now()) where id = p_intake;
  perform private.log_intake_event(p_intake, 'enviada', true);
  return 'pendiente_de_revision';
end $$;

create or replace function public.set_intake_status(p_intake uuid, p_status public.intake_status, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_old public.intake_status;
begin
  if not private.is_staff() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_status in ('rechazada', 'informacion_solicitada') and coalesce(trim(p_note), '') = '' then
    raise exception 'Indica el motivo' using errcode = '23514';
  end if;
  select status into v_old from public.intakes where id = p_intake for update;
  if not found then
    raise exception 'Solicitud no encontrada' using errcode = 'P0002';
  end if;
  update public.intakes set status = p_status where id = p_intake;
  perform private.log_intake_event(p_intake, 'estado_cambiado', true,
    jsonb_build_object('de', v_old, 'a', p_status, 'nota', p_note));
end $$;

create or replace function public.verify_company_member(p_company uuid, p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_staff() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  update public.company_members
     set verified = true, verified_by = (select auth.uid()), verified_at = now()
   where company_id = p_company and user_id = p_user;
end $$;

-- Función propia de Supabase (activación automática de RLS): solo la usa su disparador de eventos.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
