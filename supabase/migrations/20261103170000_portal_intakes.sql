-- Portal del cliente · MVP de alta y solicitudes (#56, base de #16 y #12).
-- Principios: denegar por defecto, RLS en todas las tablas, ningún permiso para «anon»,
-- el cliente solo ve lo suyo y el estado lo cambia únicamente el despacho mediante funciones auditadas.
-- Un alta NO acepta el encargo ni crea un expediente: crea una solicitud (intake) pendiente de revisión.

-- ───────────────────────── Tipos ─────────────────────────
create type public.client_kind as enum ('persona', 'empresa');
create type public.intake_status as enum (
  'borrador',                -- el cliente la está preparando
  'pendiente_de_revision',   -- enviada al despacho
  'informacion_solicitada',  -- el despacho pide datos o documentos; el cliente puede volver a editar
  'aceptada',                -- el despacho acepta estudiar el encargo
  'rechazada',               -- no se acepta (conflicto, materia, etc.)
  'convertida'               -- se ha convertido en cliente y expediente
);
create type public.staff_role as enum ('superadmin', 'abogado', 'apoyo');

-- ───────────────────────── Tablas ─────────────────────────
-- Perfil del usuario autenticado (1:1 con auth.users). Datos mínimos: nada de DNI ni salud en el alta.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  kind public.client_kind not null default 'persona',
  full_name text not null default '' check (char_length(full_name) <= 120),
  phone text check (phone is null or phone ~ '^[0-9 +()-]{6,20}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Personal del despacho. Solo un superadministrador (o una migración) da de alta personal.
create table public.staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role public.staff_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Empresas cliente y sus representantes. El vínculo solo vale cuando el despacho lo verifica.
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null check (char_length(legal_name) between 2 and 200),
  tax_id text check (tax_id is null or char_length(tax_id) <= 20),
  created_by uuid not null default auth.uid() references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.company_members (
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'representante' check (role in ('titular', 'representante')),
  verified boolean not null default false,
  verified_by uuid references auth.users (id),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (company_id, user_id)
);

-- Solicitud inicial. La referencia es la que ve el cliente; el id no se muestra.
create table public.intakes (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default (
    'SOL-' || to_char(now() at time zone 'Europe/Madrid', 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))
  ),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete restrict,
  company_id uuid references public.companies (id) on delete restrict,
  area text not null check (area in ('transporte', 'mercantil', 'hacienda', 'civil', 'familia', 'arte', 'laboral', 'penal', 'otro')),
  description text not null default '' check (char_length(description) <= 4000),
  counterparties text check (counterparties is null or char_length(counterparties) <= 500),
  locality text check (locality is null or char_length(locality) <= 120),
  relevant_dates text check (relevant_dates is null or char_length(relevant_dates) <= 500),
  urgent boolean not null default false,
  contact_channel text not null default 'correo' check (contact_channel in ('correo', 'telefono', 'whatsapp')),
  status public.intake_status not null default 'borrador',
  assigned_to uuid references auth.users (id),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index intakes_owner_idx on public.intakes (owner_id);
create index intakes_company_idx on public.intakes (company_id);
create index intakes_status_idx on public.intakes (status, submitted_at);

-- Documentos aportados. El fichero vive en Storage (bucket privado); aquí, sus metadatos.
-- Ningún documento se borra ni se sobrescribe desde el portal: una corrección es un documento nuevo (#57).
create table public.intake_documents (
  id uuid primary key default gen_random_uuid(),
  intake_id uuid not null references public.intakes (id) on delete restrict,
  uploaded_by uuid not null default auth.uid() references auth.users (id) on delete restrict,
  storage_path text not null unique,
  original_name text not null check (char_length(original_name) between 1 and 200),
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 20971520),
  status text not null default 'cuarentena' check (status in ('cuarentena', 'disponible', 'rechazado')),
  created_at timestamptz not null default now()
);
create index intake_documents_intake_idx on public.intake_documents (intake_id);

-- Mensajes del hilo de la solicitud. Las notas internas nunca son visibles para el cliente.
create table public.intake_messages (
  id uuid primary key default gen_random_uuid(),
  intake_id uuid not null references public.intakes (id) on delete restrict,
  author_id uuid not null default auth.uid() references auth.users (id) on delete restrict,
  body text not null check (char_length(body) between 1 and 4000),
  internal boolean not null default false,
  created_at timestamptz not null default now()
);
create index intake_messages_intake_idx on public.intake_messages (intake_id, created_at);

-- Registro de auditoría: solo lo escriben las funciones y disparadores; nadie lo modifica.
create table public.intake_events (
  id bigint generated always as identity primary key,
  intake_id uuid not null references public.intakes (id) on delete restrict,
  actor_id uuid references auth.users (id),
  kind text not null,
  visible_to_client boolean not null default true,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index intake_events_intake_idx on public.intake_events (intake_id, created_at);

-- ───────────────────────── Funciones auxiliares ─────────────────────────
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff s where s.user_id = (select auth.uid()) and s.active);
$$;

create or replace function public.owns_intake(p_intake uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.intakes i where i.id = p_intake and i.owner_id = (select auth.uid()));
$$;

create or replace function public.intake_editable_by_client(p_intake uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.intakes i
    where i.id = p_intake and i.owner_id = (select auth.uid())
      and i.status in ('borrador', 'informacion_solicitada')
  );
$$;

create or replace function public.is_verified_member(p_company uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.company_members m
    where m.company_id = p_company and m.user_id = (select auth.uid()) and m.verified
  );
$$;

-- Extrae la solicitud de una ruta de Storage «<intake_id>/...»; null si la ruta no tiene ese formato (nunca lanza error).
create or replace function public.intake_id_from_path(p_name text)
returns uuid language sql immutable set search_path = '' as $$
  select case when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then split_part(p_name, '/', 1)::uuid end;
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create or replace function public.log_intake_event(p_intake uuid, p_kind text, p_visible boolean, p_detail jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.intake_events (intake_id, actor_id, kind, visible_to_client, detail)
  values (p_intake, (select auth.uid()), p_kind, p_visible, coalesce(p_detail, '{}'::jsonb));
$$;
revoke all on function public.log_intake_event(uuid, text, boolean, jsonb) from public, anon, authenticated;

-- Perfil automático al registrarse (solo el nombre que el usuario haya dado).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger intakes_touch before update on public.intakes
  for each row execute function public.touch_updated_at();

-- Eventos automáticos: creación y documentos aportados.
create or replace function public.intake_after_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.log_intake_event(new.id, 'creada', true);
  return new;
end $$;
create trigger intakes_after_insert after insert on public.intakes
  for each row execute function public.intake_after_insert();

create or replace function public.document_after_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.log_intake_event(new.intake_id, 'documento_aportado', true,
    jsonb_build_object('documento', new.id, 'nombre', new.original_name));
  return new;
end $$;
create trigger intake_documents_after_insert after insert on public.intake_documents
  for each row execute function public.document_after_insert();

-- ───────────────────────── Acciones con reglas de negocio ─────────────────────────
-- El cliente envía su solicitud: solo desde borrador o información solicitada y con descripción suficiente.
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
  perform public.log_intake_event(p_intake, 'enviada', true);
  return 'pendiente_de_revision';
end $$;

-- El despacho cambia el estado, siempre con motivo cuando rechaza o pide información.
create or replace function public.set_intake_status(p_intake uuid, p_status public.intake_status, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_old public.intake_status;
begin
  if not public.is_staff() then
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
  perform public.log_intake_event(p_intake, 'estado_cambiado', true,
    jsonb_build_object('de', v_old, 'a', p_status, 'nota', p_note));
end $$;

-- El despacho verifica a un representante de empresa.
create or replace function public.verify_company_member(p_company uuid, p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_staff() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  update public.company_members
     set verified = true, verified_by = (select auth.uid()), verified_at = now()
   where company_id = p_company and user_id = p_user;
end $$;

revoke all on function public.submit_intake(uuid) from public, anon;
revoke all on function public.set_intake_status(uuid, public.intake_status, text) from public, anon;
revoke all on function public.verify_company_member(uuid, uuid) from public, anon;
grant execute on function public.submit_intake(uuid) to authenticated;
grant execute on function public.set_intake_status(uuid, public.intake_status, text) to authenticated;
grant execute on function public.verify_company_member(uuid, uuid) to authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.intake_after_insert() from public, anon, authenticated;
revoke all on function public.document_after_insert() from public, anon, authenticated;

-- ───────────────────────── Permisos y RLS ─────────────────────────
alter table public.profiles enable row level security;
alter table public.staff enable row level security;
alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.intakes enable row level security;
alter table public.intake_documents enable row level security;
alter table public.intake_messages enable row level security;
alter table public.intake_events enable row level security;

revoke all on public.profiles, public.staff, public.companies, public.company_members, public.intakes,
  public.intake_documents, public.intake_messages, public.intake_events from anon, authenticated;

-- Perfiles: cada uno el suyo; el personal los ve todos. Nadie cambia su «id».
grant select on public.profiles to authenticated;
grant update (kind, full_name, phone) on public.profiles to authenticated;
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_staff()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Personal: cada miembro ve su propia fila (para saber su rol); no se escribe desde la API.
grant select on public.staff to authenticated;
create policy staff_select_self on public.staff for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_staff()));

-- Empresas: el creador o un miembro verificado; el personal, todas.
grant select, insert on public.companies to authenticated;
grant update (legal_name, tax_id) on public.companies to authenticated;
create policy companies_select on public.companies for select to authenticated
  using (created_by = (select auth.uid()) or public.is_verified_member(id) or (select public.is_staff()));
create policy companies_insert on public.companies for insert to authenticated
  with check (created_by = (select auth.uid()));
create policy companies_update on public.companies for update to authenticated
  using (created_by = (select auth.uid()) or (select public.is_staff()))
  with check (created_by = (select auth.uid()) or (select public.is_staff()));

-- Miembros: un usuario solo puede pedir vincularse a una empresa que ha creado él, y nunca como verificado.
grant select, insert on public.company_members to authenticated;
create policy members_select on public.company_members for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_staff()));
create policy members_insert on public.company_members for insert to authenticated
  with check (
    user_id = (select auth.uid()) and not verified and verified_by is null
    and exists (select 1 from public.companies c where c.id = company_id and c.created_by = (select auth.uid()))
  );

-- Solicitudes: el cliente crea y edita las suyas solo en borrador o con información solicitada.
-- El estado, la asignación y las fechas de envío no se pueden escribir desde la API (permisos por columna).
grant select on public.intakes to authenticated;
grant insert (company_id, area, description, counterparties, locality, relevant_dates, urgent, contact_channel)
  on public.intakes to authenticated;
grant update (company_id, area, description, counterparties, locality, relevant_dates, urgent, contact_channel)
  on public.intakes to authenticated;
create policy intakes_select on public.intakes for select to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_staff()));
create policy intakes_insert on public.intakes for insert to authenticated
  with check (
    owner_id = (select auth.uid()) and status = 'borrador'
    and (company_id is null or public.is_verified_member(company_id))
  );
create policy intakes_update_client on public.intakes for update to authenticated
  using (owner_id = (select auth.uid()) and status in ('borrador', 'informacion_solicitada'))
  with check (
    owner_id = (select auth.uid()) and status in ('borrador', 'informacion_solicitada')
    and (company_id is null or public.is_verified_member(company_id))
  );

-- Documentos: el cliente registra documentos de sus solicitudes editables, dentro de su carpeta del bucket.
grant select on public.intake_documents to authenticated;
grant insert (intake_id, storage_path, original_name, mime_type, size_bytes) on public.intake_documents to authenticated;
create policy documents_select on public.intake_documents for select to authenticated
  using (public.owns_intake(intake_id) or (select public.is_staff()));
create policy documents_insert on public.intake_documents for insert to authenticated
  with check (
    uploaded_by = (select auth.uid()) and status = 'cuarentena'
    and public.intake_editable_by_client(intake_id)
    and split_part(storage_path, '/', 1) = intake_id::text
  );

-- Mensajes: el cliente lee y escribe los no internos de sus solicitudes; el personal, todos.
grant select on public.intake_messages to authenticated;
grant insert (intake_id, body, internal) on public.intake_messages to authenticated;
create policy messages_select on public.intake_messages for select to authenticated
  using ((public.owns_intake(intake_id) and not internal) or (select public.is_staff()));
create policy messages_insert_client on public.intake_messages for insert to authenticated
  with check (author_id = (select auth.uid()) and not internal and public.owns_intake(intake_id));
create policy messages_insert_staff on public.intake_messages for insert to authenticated
  with check (author_id = (select auth.uid()) and (select public.is_staff()));

-- Eventos: lectura; el cliente solo los visibles de sus solicitudes. Nadie escribe desde la API.
grant select on public.intake_events to authenticated;
create policy events_select on public.intake_events for select to authenticated
  using ((public.owns_intake(intake_id) and visible_to_client) or (select public.is_staff()));

-- ───────────────────────── Almacenamiento privado ─────────────────────────
-- Ruta obligatoria: <intake_id>/<uuid>-<nombre>. Sin lectura pública; las descargas, con URL firmada temporal.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('intake-documents', 'intake-documents', false, 20971520, array[
  'application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
])
on conflict (id) do nothing;

create policy intake_files_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'intake-documents'
    and public.intake_editable_by_client(public.intake_id_from_path(name))
  );
create policy intake_files_select on storage.objects for select to authenticated
  using (
    bucket_id = 'intake-documents'
    and (public.owns_intake(public.intake_id_from_path(name)) or (select public.is_staff()))
  );
-- Sin políticas de UPDATE ni DELETE: nadie sobrescribe ni borra un documento aportado desde el portal.
