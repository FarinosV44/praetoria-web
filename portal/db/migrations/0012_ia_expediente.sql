-- 0012 · Asistente de IA por expediente (#48).
-- Conversaciones internas del despacho con la IA, siempre ligadas a UN asunto y protegidas por la misma
-- asignación que el expediente (#81). El cliente nunca las ve. La IA no tiene herramientas: solo devuelve
-- texto que un profesional revisa; guardar, enviar o publicar sigue siendo una acción humana.

create table portal.ia_hilos (
  id uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null references portal.solicitudes(id) on delete cascade,
  titulo text not null check (length(titulo) between 1 and 120),
  creado_por uuid not null references portal.personal(user_id),
  created_at timestamptz not null default now()
);
create index ia_hilos_solicitud on portal.ia_hilos (solicitud_id, created_at desc);

create table portal.ia_mensajes (
  id uuid primary key default gen_random_uuid(),
  hilo_id uuid not null references portal.ia_hilos(id) on delete cascade,
  solicitud_id uuid not null references portal.solicitudes(id) on delete cascade,
  rol text not null check (rol in ('usuario', 'asistente')),
  texto text not null check (length(texto) <= 60000),
  citas jsonb not null default '[]',
  limites jsonb not null default '[]',           -- documentos que no se pudieron leer, recortes de contexto…
  modelo text, tokens_entrada int, tokens_salida int,
  autor_id uuid not null references portal.personal(user_id),
  created_at timestamptz not null default now()
);
create index ia_mensajes_hilo on portal.ia_mensajes (hilo_id, created_at);
create index ia_mensajes_autor on portal.ia_mensajes (autor_id, created_at);

-- Texto extraído de cada documento (por páginas), para que la IA cite archivo, versión y página.
create table portal.documentos_texto (
  documento_id uuid primary key references portal.documentos(id) on delete cascade,
  solicitud_id uuid not null references portal.solicitudes(id) on delete cascade,
  estado text not null check (estado in ('ok', 'sin_texto', 'error', 'no_admitido')),
  paginas jsonb not null default '[]',
  detalle text,
  extraido_at timestamptz not null default now()
);

alter table portal.ia_hilos enable row level security;
alter table portal.ia_mensajes enable row level security;
alter table portal.documentos_texto enable row level security;

-- Coherencia: el hilo y su mensaje son del mismo asunto; el autor es quien escribe.
create function portal.t_ia_mensaje() returns trigger language plpgsql
set search_path = portal, pg_temp as $$
begin
  if not exists (select 1 from portal.ia_hilos h where h.id = new.hilo_id and h.solicitud_id = new.solicitud_id) then
    raise exception 'El mensaje no pertenece a ese asunto';
  end if;
  new.autor_id := portal.uid();
  new.created_at := now();
  return new;
end $$;
create trigger ia_mensaje before insert on portal.ia_mensajes for each row execute function portal.t_ia_mensaje();

create function portal.t_ia_hilo() returns trigger language plpgsql
set search_path = portal, pg_temp as $$
begin
  new.creado_por := portal.uid();
  new.created_at := now();
  return new;
end $$;
create trigger ia_hilo before insert on portal.ia_hilos for each row execute function portal.t_ia_hilo();

create policy leer on portal.ia_hilos for select to portal_app using (portal.personal_ve(solicitud_id));
create policy crear on portal.ia_hilos for insert to portal_app with check (portal.personal_escribe(solicitud_id));
create policy leer on portal.ia_mensajes for select to portal_app using (portal.personal_ve(solicitud_id));
create policy crear on portal.ia_mensajes for insert to portal_app with check (portal.personal_escribe(solicitud_id));
create policy leer on portal.documentos_texto for select to portal_app using (portal.personal_ve(solicitud_id));
create policy guardar on portal.documentos_texto for insert to portal_app
  with check (portal.personal_ve(solicitud_id) and exists (select 1 from portal.documentos d where d.id = documento_id and d.solicitud_id = documentos_texto.solicitud_id));
grant select, insert on portal.ia_hilos, portal.ia_mensajes, portal.documentos_texto to portal_app;

-- Las funciones de disparador no se invocan directamente.
revoke execute on function portal.t_agenda_documento(), portal.t_ia_mensaje(), portal.t_ia_hilo() from public;
revoke execute on all functions in schema portal from public;
