-- 0014 · Perfiles de estilo de los escritos (#97): tipografía, márgenes, interlineado, títulos, numeración,
-- encabezado, pie con paginación y firma. Versionados: cambiar un estilo crea una versión nueva y lo exportado
-- antes conserva la versión con la que se generó. Solo formato: nunca datos ni firmas de escritos anteriores.

create table portal.bib_estilos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique check (length(nombre) between 3 and 80),
  destino text not null default 'general' check (destino in ('judicial', 'administrativo', 'convenio', 'contrato', 'informe', 'extrajudicial', 'general')),
  materias text[] not null default '{}',          -- estilo preferido para estas materias de la biblioteca
  activo boolean not null default true,
  creado_por uuid not null references portal.personal(user_id),
  created_at timestamptz not null default now()
);

create table portal.bib_estilo_versiones (
  id uuid primary key default gen_random_uuid(),
  estilo_id uuid not null references portal.bib_estilos(id) on delete cascade,
  version int not null,
  config jsonb not null check (jsonb_typeof(config) = 'object' and length(config::text) <= 8000),
  origen_modelo uuid references portal.bib_modelos(id) on delete set null,   -- Word de referencia del que se extrajo
  creado_por uuid not null references portal.personal(user_id),
  created_at timestamptz not null default now(),
  unique (estilo_id, version)
);

create function portal.t_bib_estilo() returns trigger language plpgsql
set search_path = portal, pg_temp as $$
begin
  if tg_op = 'INSERT' then new.creado_por := portal.uid(); new.created_at := now(); end if;
  return new;
end $$;
create trigger bib_estilo before insert on portal.bib_estilos for each row execute function portal.t_bib_estilo();

create function portal.t_bib_estilo_version() returns trigger language plpgsql
set search_path = portal, pg_temp as $$
begin
  new.creado_por := portal.uid(); new.created_at := now();
  select coalesce(max(version), 0) + 1 into new.version from portal.bib_estilo_versiones where estilo_id = new.estilo_id;
  return new;
end $$;
create trigger bib_estilo_version before insert on portal.bib_estilo_versiones for each row execute function portal.t_bib_estilo_version();

alter table portal.bib_estilos enable row level security;
alter table portal.bib_estilo_versiones enable row level security;
-- Lo usa todo el equipo jurídico; lo configura la superadministración.
create policy leer on portal.bib_estilos for select to portal_app using (portal.bib_puede_subir() or portal.rol_actual() = 'lectura');
create policy gestionar on portal.bib_estilos for all to portal_app using (portal.es_global()) with check (portal.es_global());
create policy leer on portal.bib_estilo_versiones for select to portal_app using (portal.bib_puede_subir() or portal.rol_actual() = 'lectura');
create policy crear on portal.bib_estilo_versiones for insert to portal_app with check (portal.es_global());
grant select, insert, update on portal.bib_estilos to portal_app;
grant select, insert on portal.bib_estilo_versiones to portal_app;

revoke execute on function portal.t_bib_estilo(), portal.t_bib_estilo_version() from public;
revoke execute on all functions in schema portal from public;
