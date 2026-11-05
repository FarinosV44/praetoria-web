-- 0015 · Borradores de escritos redactados con la biblioteca y el expediente (#94/#48).
-- · Un escrito es del asunto y tiene versiones inmutables: cada cambio (por chat o a mano) crea una versión nueva,
--   nunca sobrescribe la anterior. Cada versión guarda qué modelos de la biblioteca se usaron (modelo, versión,
--   secciones), las citas al expediente y los avisos (lagunas, normas sin verificar, datos retirados).
-- · Solo se pueden usar modelos APROBADOS, en su versión vigente y que esa persona pueda ver: lo comprueba
--   portal.bib_usable(), la misma regla en la consulta de modelos y en el registro de usos.
-- · Todo es borrador interno: aquí no hay estado de aprobación ni presentación (eso es #95).

create function portal.bib_usable(p_version uuid) returns boolean language sql stable security definer
set search_path = portal, pg_temp as $$
  select exists (
    select 1 from portal.bib_versiones v join portal.bib_modelos m on m.id = v.modelo_id
     where v.id = p_version and m.estado = 'aprobado' and m.clase in ('maestro', 'historico_anonimizado', 'clausula')
       and portal.bib_puede_ver(m)
       and v.version = (select max(x.version) from portal.bib_versiones x where x.modelo_id = m.id))
$$;

create table portal.escritos (
  id uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null references portal.solicitudes(id) on delete cascade,
  titulo text not null check (length(titulo) between 3 and 200),
  procedimiento_id uuid references portal.bib_procedimientos(id),
  hilo_id uuid references portal.ia_hilos(id) on delete set null,
  creado_por uuid not null references portal.personal(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on portal.escritos (solicitud_id, updated_at desc);
create unique index on portal.escritos (hilo_id) where hilo_id is not null;   -- una conversación trabaja sobre un escrito

create table portal.escrito_versiones (
  id uuid primary key default gen_random_uuid(),
  escrito_id uuid not null references portal.escritos(id) on delete cascade,
  solicitud_id uuid not null references portal.solicitudes(id) on delete cascade,
  version int not null,
  texto text not null check (length(texto) between 1 and 200000),
  origen text not null check (origen in ('ia', 'manual')),
  instruccion text check (length(instruccion) <= 8000),
  mensaje_id uuid references portal.ia_mensajes(id) on delete set null,
  modelos jsonb not null default '[]' check (jsonb_typeof(modelos) = 'array'),
  citas jsonb not null default '[]' check (jsonb_typeof(citas) = 'array'),
  avisos jsonb not null default '[]' check (jsonb_typeof(avisos) = 'array'),
  autor_id uuid not null references portal.personal(user_id),
  created_at timestamptz not null default now(),
  unique (escrito_id, version)
);

alter table portal.bib_usos add column escrito_version_id uuid references portal.escrito_versiones(id) on delete set null;

create function portal.t_escrito() returns trigger language plpgsql
set search_path = portal, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    new.creado_por := portal.uid(); new.created_at := now();
    if new.hilo_id is not null and not exists (select 1 from portal.ia_hilos h where h.id = new.hilo_id and h.solicitud_id = new.solicitud_id) then
      raise exception 'La conversación no es de ese asunto' using errcode = '42501';
    end if;
  else
    new.id := old.id; new.solicitud_id := old.solicitud_id; new.creado_por := old.creado_por; new.created_at := old.created_at; new.hilo_id := old.hilo_id;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger escrito before insert or update on portal.escritos for each row execute function portal.t_escrito();

-- Versión: numerada por el servidor, del mismo asunto que su escrito, autor = quien la crea.
-- security definer solo para numerar y tocar updated_at; los permisos los decide la RLS del insert.
create function portal.t_escrito_version() returns trigger language plpgsql security definer
set search_path = portal, pg_temp as $$
begin
  select solicitud_id into new.solicitud_id from portal.escritos where id = new.escrito_id for update;
  if new.solicitud_id is null then raise exception 'Escrito inexistente'; end if;
  if new.mensaje_id is not null and not exists (select 1 from portal.ia_mensajes m where m.id = new.mensaje_id and m.solicitud_id = new.solicitud_id) then
    raise exception 'La respuesta no es de ese asunto' using errcode = '42501';
  end if;
  new.autor_id := portal.uid(); new.created_at := now();
  select coalesce(max(version), 0) + 1 into new.version from portal.escrito_versiones where escrito_id = new.escrito_id;
  update portal.escritos set updated_at = now() where id = new.escrito_id;
  return new;
end $$;
create trigger escrito_version before insert on portal.escrito_versiones for each row execute function portal.t_escrito_version();

alter table portal.escritos enable row level security;
alter table portal.escrito_versiones enable row level security;
create policy leer on portal.escritos for select to portal_app using (portal.personal_ve(solicitud_id));
create policy crear on portal.escritos for insert to portal_app with check (portal.personal_escribe(solicitud_id));
create policy editar on portal.escritos for update to portal_app using (portal.personal_escribe(solicitud_id)) with check (portal.personal_escribe(solicitud_id));
create policy leer on portal.escrito_versiones for select to portal_app using (portal.personal_ve(solicitud_id));
-- La comprobación usa el asunto del ESCRITO (el trigger corrige solicitud_id, pero la RLS se evalúa sobre la fila final).
create policy crear on portal.escrito_versiones for insert to portal_app
  with check (portal.personal_escribe(solicitud_id) and exists (select 1 from portal.escritos e where e.id = escrito_id and e.solicitud_id = escrito_versiones.solicitud_id));
grant select, insert on portal.escritos, portal.escrito_versiones to portal_app;
grant update (titulo, procedimiento_id) on portal.escritos to portal_app;

-- Uso de un modelo: solo si es utilizable (aprobado, vigente y visible) y para una versión de escrito del mismo asunto.
drop policy crear on portal.bib_usos;
create policy crear on portal.bib_usos for insert to portal_app with check (
  portal.personal_escribe(solicitud_id) and portal.bib_usable(version_id) and user_id = portal.uid()
  and (escrito_version_id is null or exists (select 1 from portal.escrito_versiones v where v.id = escrito_version_id and v.solicitud_id = bib_usos.solicitud_id)));

revoke execute on function portal.t_escrito(), portal.t_escrito_version() from public;
revoke execute on function portal.bib_usable(uuid) from public;
grant execute on function portal.bib_usable(uuid) to portal_app;
