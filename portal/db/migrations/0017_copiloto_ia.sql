-- 0017 · Copiloto Jurídico: configuración, consumo, ejecuciones recuperables, conocimiento recuperable (RAG) y
-- conversaciones de despacho. Solo añade: no borra ni reescribe datos de expedientes o de la biblioteca.
--   · Biblioteca y expedientes se fragmentan en tablas DISTINTAS, cada una con la RLS de su origen: un fragmento de
--     expediente nunca es alcanzable por una consulta a la biblioteca, ni al revés.
--   · Lo aprobable se sigue decidiendo con portal.bib_usable() en el momento de recuperar, no al indexar.
--   · Los embeddings son opcionales. Los de expedientes están desactivados hasta que la superadministración los
--     autorice, porque envían texto del expediente a un proveedor adicional. Sin ellos funciona la búsqueda textual.
--   · La indexación periódica actúa con la identidad de una persona administradora: pasa por la RLS, sin rol especial.

create schema if not exists extensions;
create extension if not exists vector with schema extensions;
grant usage on schema extensions to portal_app;

-- ── Configuración (una sola fila) ─────────────────────────────────────────────────────
create table portal.ia_ajustes (
  id boolean primary key default true check (id),
  proveedor text not null default 'anthropic' check (proveedor in ('anthropic', 'openai')),
  modo text not null default 'equilibrado' check (modo in ('rapido', 'equilibrado', 'maximo')),
  modelos jsonb not null default '{
    "anthropic": {"rapido": "claude-sonnet-5-5", "equilibrado": "claude-opus-5-5", "maximo": "claude-fable-5-1"},
    "openai": {"rapido": "gpt-6-astra", "equilibrado": "gpt-6-astra", "maximo": "gpt-6-astra"}
  }' check (jsonb_typeof(modelos) = 'object'),
  fallback_proveedor text check (fallback_proveedor in ('anthropic', 'openai')),
  fallback_modelo text check (length(fallback_modelo) <= 80),
  openai_autorizado boolean not null default false,
  embeddings_biblioteca boolean not null default false,
  embeddings_expedientes boolean not null default false,
  ocr_activo boolean not null default false,
  revision_doble boolean not null default true,
  limite_diario_usd numeric(10,2) check (limite_diario_usd >= 0),
  limite_mensual_usd numeric(10,2) check (limite_mensual_usd >= 0),
  limite_hora_usuario int not null default 60 check (limite_hora_usuario between 1 and 1000),
  tarifas jsonb not null default '{}' check (jsonb_typeof(tarifas) = 'object'),
  estilo_instrucciones text not null default '' check (length(estilo_instrucciones) <= 8000),
  updated_by uuid references portal.personal(user_id),
  updated_at timestamptz not null default now()
);
insert into portal.ia_ajustes (fallback_proveedor, fallback_modelo) values ('anthropic', 'claude-opus-5-5');

-- ── Registro de consumo y auditoría ───────────────────────────────────────────────────
create table portal.ia_consumo (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  user_id uuid not null references portal.personal(user_id),
  solicitud_id uuid references portal.solicitudes(id) on delete set null,
  tarea text not null check (length(tarea) <= 40),
  modo text check (modo in ('rapido', 'equilibrado', 'maximo')),
  proveedor text not null check (proveedor in ('anthropic', 'openai')),
  modelo_pedido text not null,
  modelo_usado text,
  fallback boolean not null default false,
  tokens_entrada int, tokens_salida int, tokens_cache_lectura int, tokens_cache_escritura int,
  coste_usd numeric(12,6),
  estado text not null check (estado in ('ok', 'error', 'rechazo')),
  error_codigo text check (length(error_codigo) <= 60),
  duracion_ms int
);
create index ia_consumo_at on portal.ia_consumo (at desc);
create index ia_consumo_usuario on portal.ia_consumo (user_id, at desc);
create index ia_consumo_solicitud on portal.ia_consumo (solicitud_id) where solicitud_id is not null;

create table portal.ia_auditoria (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  user_id uuid references portal.personal(user_id),
  accion text not null check (length(accion) <= 60),
  solicitud_id uuid references portal.solicitudes(id) on delete set null,
  detalle jsonb not null default '{}'
);
create index ia_auditoria_at on portal.ia_auditoria (at desc);

-- ── Ejecuciones: lo que tarda sobrevive a una recarga y a un reinicio (queda marcado como interrumpido) ──
create table portal.ia_ejecuciones (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('chat', 'redaccion', 'edicion', 'analisis')),
  estado text not null default 'en_curso' check (estado in ('en_curso', 'listo', 'error')),
  progreso text check (length(progreso) <= 200),
  parcial text not null default '' check (length(parcial) <= 800000),
  resultado jsonb,
  error text check (length(error) <= 400),
  solicitud_id uuid references portal.solicitudes(id) on delete cascade,
  hilo_id uuid references portal.ia_hilos(id) on delete cascade,
  modo text check (modo in ('rapido', 'equilibrado', 'maximo')),
  proveedor text, modelo text,
  creado_por uuid not null references portal.personal(user_id),
  created_at timestamptz not null default now(),
  latido_at timestamptz not null default now(),
  finalizado_at timestamptz
);
create index ia_ejecuciones_usuario on portal.ia_ejecuciones (creado_por, created_at desc);
create index ia_ejecuciones_hilo on portal.ia_ejecuciones (hilo_id, created_at desc);

-- ── Conversaciones de despacho: sin asunto, solo las ve quien las creó ────────────────
alter table portal.ia_hilos alter column solicitud_id drop not null;
alter table portal.ia_hilos add column ambito text not null default 'expediente' check (ambito in ('expediente', 'despacho', 'editor'));
alter table portal.ia_hilos add constraint ia_hilos_ambito_asunto check ((ambito = 'despacho') = (solicitud_id is null));
alter table portal.ia_mensajes alter column solicitud_id drop not null;
alter table portal.ia_mensajes add column proveedor text, add column modo text, add column fallback text, add column coste_usd numeric(12,6);
alter table portal.ia_mensajes drop constraint ia_mensajes_texto_check;
alter table portal.ia_mensajes add constraint ia_mensajes_texto_check check (length(texto) <= 400000);
create index ia_hilos_despacho on portal.ia_hilos (creado_por, created_at desc) where solicitud_id is null;

create or replace function portal.t_ia_mensaje() returns trigger language plpgsql
set search_path = portal, pg_temp as $$
begin
  if not exists (select 1 from portal.ia_hilos h where h.id = new.hilo_id and h.solicitud_id is not distinct from new.solicitud_id) then
    raise exception 'El mensaje no pertenece a ese asunto';
  end if;
  new.autor_id := portal.uid();
  new.created_at := now();
  return new;
end $$;

-- ¿Puede esta persona usar la biblioteca a través de la IA? Facturación no accede a la biblioteca.
create function portal.ia_usa_biblioteca() returns boolean language sql stable security definer
set search_path = portal, pg_temp as $$
  select coalesce(portal.rol_actual(), '') in ('administrador', 'abogado', 'apoyo', 'lectura')
$$;

drop policy leer on portal.ia_hilos;
drop policy crear on portal.ia_hilos;
drop policy leer on portal.ia_mensajes;
drop policy crear on portal.ia_mensajes;
create policy leer on portal.ia_hilos for select to portal_app using (
  case when solicitud_id is null then creado_por = portal.uid() and portal.ia_usa_biblioteca() else portal.personal_ve(solicitud_id) end);
create policy crear on portal.ia_hilos for insert to portal_app with check (
  case when solicitud_id is null then creado_por = portal.uid() and portal.ia_usa_biblioteca() else portal.personal_escribe(solicitud_id) end);
create policy leer on portal.ia_mensajes for select to portal_app using (
  case when solicitud_id is null then exists (select 1 from portal.ia_hilos h where h.id = hilo_id and h.creado_por = portal.uid()) and portal.ia_usa_biblioteca()
       else portal.personal_ve(solicitud_id) end);
create policy crear on portal.ia_mensajes for insert to portal_app with check (
  case when solicitud_id is null then exists (select 1 from portal.ia_hilos h where h.id = hilo_id and h.creado_por = portal.uid()) and portal.ia_usa_biblioteca()
       else portal.personal_escribe(solicitud_id) end);

-- ── Fragmentos recuperables ───────────────────────────────────────────────────────────
create table portal.bib_fragmentos (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references portal.bib_versiones(id) on delete cascade,
  modelo_id uuid not null references portal.bib_modelos(id) on delete cascade,
  orden int not null,
  seccion text check (length(seccion) <= 200),
  pagina int,
  texto text not null check (length(texto) between 1 and 12000),
  tsv tsvector generated always as (to_tsvector('spanish', texto)) stored,
  embedding extensions.vector(1536),
  embedding_modelo text,
  unique (version_id, orden)
);
create index bib_fragmentos_tsv on portal.bib_fragmentos using gin (tsv);
create index bib_fragmentos_modelo on portal.bib_fragmentos (modelo_id);
create index bib_fragmentos_vector on portal.bib_fragmentos using hnsw (embedding extensions.vector_cosine_ops);

create table portal.doc_fragmentos (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid not null references portal.documentos(id) on delete cascade,
  solicitud_id uuid not null references portal.solicitudes(id) on delete cascade,
  orden int not null,
  seccion text check (length(seccion) <= 200),
  pagina int,
  texto text not null check (length(texto) between 1 and 12000),
  tsv tsvector generated always as (to_tsvector('spanish', texto)) stored,
  embedding extensions.vector(1536),
  embedding_modelo text,
  unique (documento_id, orden)
);
create index doc_fragmentos_tsv on portal.doc_fragmentos using gin (tsv);
create index doc_fragmentos_solicitud on portal.doc_fragmentos (solicitud_id);
create index doc_fragmentos_vector on portal.doc_fragmentos using hnsw (embedding extensions.vector_cosine_ops);

-- Texto obtenido por OCR de una versión escaneada: la versión original (archivo y texto) sigue siendo inmutable.
alter table portal.bib_versiones add column texto_ocr text check (length(texto_ocr) <= 600000);
-- Un documento leído por OCR se puede releer: se indica cómo se obtuvo su texto.
alter table portal.documentos_texto add column metodo text not null default 'texto' check (metodo in ('texto', 'ocr'));

-- ── Cola de indexación ────────────────────────────────────────────────────────────────
create table portal.ia_indexacion (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('documento', 'biblioteca')),
  origen_id uuid not null,
  solicitud_id uuid references portal.solicitudes(id) on delete cascade,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'procesando', 'ok', 'sin_texto', 'error')),
  intentos int not null default 0,
  fragmentos int not null default 0,
  con_ocr boolean not null default false,
  con_embeddings boolean not null default false,
  detalle text check (length(detalle) <= 300),
  creado_at timestamptz not null default now(),
  actualizado_at timestamptz not null default now(),
  unique (tipo, origen_id)
);
create index ia_indexacion_cola on portal.ia_indexacion (actualizado_at) where estado in ('pendiente', 'procesando');
create index ia_indexacion_solicitud on portal.ia_indexacion (solicitud_id) where solicitud_id is not null;

create function portal.t_indexar_documento() returns trigger language plpgsql security definer
set search_path = portal, pg_temp as $$
begin
  insert into portal.ia_indexacion (tipo, origen_id, solicitud_id) values ('documento', new.id, new.solicitud_id)
    on conflict (tipo, origen_id) do update set estado = 'pendiente', intentos = 0, actualizado_at = now();
  return new;
end $$;
create trigger indexar_documento after insert on portal.documentos for each row execute function portal.t_indexar_documento();

create function portal.t_indexar_version() returns trigger language plpgsql security definer
set search_path = portal, pg_temp as $$
begin
  insert into portal.ia_indexacion (tipo, origen_id) values ('biblioteca', new.id)
    on conflict (tipo, origen_id) do update set estado = 'pendiente', intentos = 0, actualizado_at = now();
  return new;
end $$;
create trigger indexar_version after insert on portal.bib_versiones for each row execute function portal.t_indexar_version();

-- Al aprobar un modelo se reprocesa su última versión: hasta entonces no se le generan embeddings.
create function portal.t_indexar_aprobado() returns trigger language plpgsql security definer
set search_path = portal, pg_temp as $$
begin
  if new.estado = 'aprobado' and old.estado is distinct from 'aprobado' then
    update portal.ia_indexacion set estado = 'pendiente', intentos = 0, actualizado_at = now()
     where tipo = 'biblioteca' and origen_id = (select id from portal.bib_versiones where modelo_id = new.id order by version desc limit 1);
  end if;
  return new;
end $$;
create trigger indexar_aprobado after update on portal.bib_modelos for each row execute function portal.t_indexar_aprobado();

-- Al purgar un documento desaparece también lo que se extrajo de él.
create function portal.t_purgar_fragmentos() returns trigger language plpgsql security definer
set search_path = portal, pg_temp as $$
begin
  if new.purgado_at is not null and old.purgado_at is null then
    delete from portal.doc_fragmentos where documento_id = new.id;
    delete from portal.ia_indexacion where tipo = 'documento' and origen_id = new.id;
  end if;
  return new;
end $$;
create trigger purgar_fragmentos after update on portal.documentos for each row execute function portal.t_purgar_fragmentos();

-- Lo ya existente entra en la cola; la tarea periódica lo procesa poco a poco.
insert into portal.ia_indexacion (tipo, origen_id, solicitud_id)
  select 'documento', d.id, d.solicitud_id from portal.documentos d where d.purgado_at is null;
insert into portal.ia_indexacion (tipo, origen_id)
  select 'biblioteca', v.id from portal.bib_versiones v;

-- La tarea periódica no actúa como nadie al tomar trabajo (igual que la purga de la papelera) y no ve contenido:
-- solo identificadores. Después indexa con la identidad de una persona administradora, por tanto bajo RLS.
create function portal.ia_indexacion_tomar(p_limite int) returns table (id uuid, tipo text, origen_id uuid, solicitud_id uuid)
language sql security definer set search_path = portal, pg_temp as $$
  update portal.ia_indexacion i set estado = 'procesando', intentos = i.intentos + 1, actualizado_at = now()
   where i.id in (
     select x.id from portal.ia_indexacion x
      where portal.uid() is null and x.intentos < 3
        and (x.estado = 'pendiente' or (x.estado = 'procesando' and x.actualizado_at < now() - interval '15 minutes'))
      order by x.actualizado_at limit least(greatest(p_limite, 1), 20) for update skip locked)
  returning i.id, i.tipo, i.origen_id, i.solicitud_id
$$;
create function portal.ia_ejecutor() returns uuid language sql stable security definer set search_path = portal, pg_temp as $$
  select user_id from portal.personal where portal.uid() is null and rol = 'administrador' and activo order by user_id limit 1
$$;

-- Reintentar o reindexar: quien puede escribir en ese asunto o, en la biblioteca, su autor y la superadministración.
create function portal.ia_reindexar(p_tipo text, p_origen uuid) returns void language plpgsql security definer
set search_path = portal, pg_temp as $$
declare ok boolean; sid uuid;
begin
  if p_tipo = 'documento' then
    select d.solicitud_id into sid from portal.documentos d where d.id = p_origen and d.eliminado_at is null;
    ok := sid is not null and portal.personal_escribe(sid);
  elsif p_tipo = 'biblioteca' then
    ok := exists (select 1 from portal.bib_versiones v join portal.bib_modelos m on m.id = v.modelo_id
      where v.id = p_origen and (portal.es_global() or (m.autor_id = portal.uid() and portal.bib_puede_subir())));
  else ok := false; end if;
  if not ok then raise exception 'Sin permiso' using errcode = '42501'; end if;
  insert into portal.ia_indexacion (tipo, origen_id, solicitud_id) values (p_tipo, p_origen, sid)
    on conflict (tipo, origen_id) do update set estado = 'pendiente', intentos = 0, detalle = null, actualizado_at = now();
  insert into portal.ia_auditoria (user_id, accion, solicitud_id, detalle)
    values (portal.uid(), 'reindexar', sid, jsonb_build_object('tipo', p_tipo, 'origen', p_origen));
end $$;

-- Gasto total del despacho para aplicar los límites: expone solo una suma, no quién ni en qué.
create function portal.ia_gasto(p_desde timestamptz) returns numeric language sql stable security definer
set search_path = portal, pg_temp as $$
  select coalesce(sum(coste_usd), 0) from portal.ia_consumo where portal.es_personal() and at >= p_desde
$$;
create function portal.ia_consultas_hora() returns int language sql stable security definer
set search_path = portal, pg_temp as $$
  select count(*)::int from portal.ia_consumo where user_id = portal.uid() and at > now() - interval '1 hour' and tarea not in ('ocr', 'embeddings')
$$;

-- ── Reglas de escritura ───────────────────────────────────────────────────────────────
create function portal.t_ia_autor() returns trigger language plpgsql set search_path = portal, pg_temp as $$
begin
  if tg_table_name = 'ia_ejecuciones' then
    if tg_op = 'INSERT' then new.creado_por := portal.uid(); new.created_at := now();
    else new.id := old.id; new.creado_por := old.creado_por; new.created_at := old.created_at; new.solicitud_id := old.solicitud_id; new.tipo := old.tipo; end if;
    new.latido_at := now();
  else
    new.user_id := portal.uid(); new.at := now();
  end if;
  return new;
end $$;
create trigger autor before insert or update on portal.ia_ejecuciones for each row execute function portal.t_ia_autor();
create trigger autor before insert on portal.ia_consumo for each row execute function portal.t_ia_autor();
create trigger autor before insert on portal.ia_auditoria for each row execute function portal.t_ia_autor();

create function portal.t_ia_ajustes() returns trigger language plpgsql set search_path = portal, pg_temp as $$
begin
  new.id := true; new.updated_by := portal.uid(); new.updated_at := now();
  insert into portal.ia_auditoria (user_id, accion, detalle) values (portal.uid(), 'ajustes_ia', jsonb_build_object(
    'proveedor', new.proveedor, 'modo', new.modo, 'modelos', new.modelos, 'fallback_modelo', new.fallback_modelo, 'openai_autorizado', new.openai_autorizado,
    'embeddings_biblioteca', new.embeddings_biblioteca, 'embeddings_expedientes', new.embeddings_expedientes, 'ocr_activo', new.ocr_activo,
    'limite_diario_usd', new.limite_diario_usd, 'limite_mensual_usd', new.limite_mensual_usd));
  return new;
end $$;
create trigger ajustes before update on portal.ia_ajustes for each row execute function portal.t_ia_ajustes();

-- ── RLS ───────────────────────────────────────────────────────────────────────────────
alter table portal.ia_ajustes enable row level security;
alter table portal.ia_consumo enable row level security;
alter table portal.ia_auditoria enable row level security;
alter table portal.ia_ejecuciones enable row level security;
alter table portal.bib_fragmentos enable row level security;
alter table portal.doc_fragmentos enable row level security;
alter table portal.ia_indexacion enable row level security;

create policy leer on portal.ia_ajustes for select to portal_app using (portal.es_personal());
create policy editar on portal.ia_ajustes for update to portal_app using (portal.es_global()) with check (portal.es_global());
create policy leer on portal.ia_consumo for select to portal_app using (portal.es_global() or user_id = portal.uid());
create policy crear on portal.ia_consumo for insert to portal_app with check (portal.es_personal() and (solicitud_id is null or portal.personal_ve(solicitud_id)));
create policy leer on portal.ia_auditoria for select to portal_app using (portal.es_global());
create policy crear on portal.ia_auditoria for insert to portal_app with check (portal.es_personal());
create policy leer on portal.ia_ejecuciones for select to portal_app using (creado_por = portal.uid() or (solicitud_id is not null and portal.personal_ve(solicitud_id)));
create policy crear on portal.ia_ejecuciones for insert to portal_app with check (portal.es_personal() and (solicitud_id is null or portal.personal_escribe(solicitud_id)));
create policy editar on portal.ia_ejecuciones for update to portal_app using (creado_por = portal.uid()) with check (creado_por = portal.uid());

-- Un fragmento se ve si se ve su modelo (biblioteca) o su documento y el asunto (expediente). El cliente, nunca.
create policy leer on portal.bib_fragmentos for select to portal_app using (portal.bib_ve_modelo(modelo_id));
create policy leer on portal.doc_fragmentos for select to portal_app using (
  portal.personal_ve(solicitud_id) and exists (select 1 from portal.documentos d where d.id = documento_id));
create policy escribir on portal.bib_fragmentos for all to portal_app using (portal.es_global()) with check (portal.es_global());
create policy escribir on portal.doc_fragmentos for all to portal_app using (portal.es_global()) with check (portal.es_global());
create policy leer on portal.ia_indexacion for select to portal_app using (portal.es_global() or (solicitud_id is not null and portal.personal_ve(solicitud_id)));
create policy actualizar on portal.ia_indexacion for update to portal_app using (portal.es_global()) with check (portal.es_global());
create policy actualizar_texto on portal.documentos_texto for update to portal_app using (portal.es_global()) with check (portal.es_global());
create policy actualizar_ocr on portal.bib_versiones for update to portal_app using (portal.es_global()) with check (portal.es_global());

grant select on portal.ia_ajustes to portal_app;
grant update (proveedor, modo, modelos, fallback_proveedor, fallback_modelo, openai_autorizado, embeddings_biblioteca, embeddings_expedientes, ocr_activo,
  revision_doble, limite_diario_usd, limite_mensual_usd, limite_hora_usuario, tarifas, estilo_instrucciones) on portal.ia_ajustes to portal_app;
grant select, insert on portal.ia_consumo, portal.ia_auditoria, portal.ia_ejecuciones to portal_app;
grant update (estado, progreso, parcial, resultado, error, hilo_id, proveedor, modelo, modo, finalizado_at, latido_at) on portal.ia_ejecuciones to portal_app;
grant select, insert, delete on portal.bib_fragmentos, portal.doc_fragmentos to portal_app;
grant select on portal.ia_indexacion to portal_app;
grant update (estado, fragmentos, con_ocr, con_embeddings, detalle, actualizado_at) on portal.ia_indexacion to portal_app;
grant update (estado, paginas, detalle, metodo, extraido_at) on portal.documentos_texto to portal_app;
grant update (texto_ocr) on portal.bib_versiones to portal_app;

-- Las funciones solo las invoca quien debe.
revoke execute on all functions in schema portal from public;
grant execute on function portal.ia_usa_biblioteca(), portal.ia_indexacion_tomar(int), portal.ia_ejecutor(), portal.ia_reindexar(text, uuid),
  portal.ia_gasto(timestamptz), portal.ia_consultas_hora() to portal_app;
