-- 0002 · Modelo mínimo del portal: clientes, solicitudes (intake), expedientes, requisitos
-- documentales, versiones de documentos, mensajes, notas internas, eventos y notificaciones.
-- Una solicitud NO es un expediente: solo el despacho la convierte tras revisarla.

create extension if not exists pgcrypto;
create schema if not exists portal;
revoke all on schema portal from public;
grant usage on schema portal to portal_app;

create type portal.tipo_cliente as enum ('particular', 'empresa');
create type portal.rol_personal as enum ('abogado', 'apoyo', 'administrador');
create type portal.estado_solicitud as enum ('borrador', 'enviada', 'en_revision', 'aceptada', 'no_aceptada', 'archivada');
create type portal.estado_requisito as enum ('pendiente', 'recibido', 'en_revision', 'validado', 'subsanacion', 'no_aplicable');
create type portal.estado_documento as enum ('pendiente', 'valido', 'rechazado');
create type portal.estado_expediente as enum ('activo', 'cerrado');

-- Identidad efectiva de la transacción (la fija el servidor tras validar la sesión).
create function portal.uid() returns uuid language sql stable as $$
  select nullif(current_setting('app.user_id', true), '')::uuid
$$;

create table portal.personal (
  user_id uuid primary key references identidad."user"(id) on delete restrict,
  rol portal.rol_personal not null,
  nombre_visible text not null check (length(nombre_visible) between 2 and 120),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create function portal.es_personal() returns boolean language sql stable security definer
set search_path = portal, pg_temp as $$
  select exists (select 1 from portal.personal p where p.user_id = portal.uid() and p.activo)
$$;

create table portal.perfiles (
  user_id uuid primary key references identidad."user"(id) on delete cascade,
  tipo portal.tipo_cliente not null default 'particular',
  nombre text not null check (length(nombre) between 1 and 120),
  apellidos text check (length(apellidos) <= 160),
  telefono text check (telefono ~ '^\+?[0-9 ]{9,20}$'),
  empresa text check (length(empresa) <= 200),
  cargo text check (length(cargo) <= 120),
  version_privacidad text not null,
  acepta_privacidad_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (tipo = 'particular' or empresa is not null)
);

create table portal.tipos_asunto (
  id text primary key check (id ~ '^[a-z0-9-]{3,60}$'),
  nombre text not null,
  descripcion text not null,
  area text not null,
  orden int not null default 100,
  activo boolean not null default true
);

create table portal.plantillas (
  id uuid primary key default gen_random_uuid(),
  tipo_asunto_id text not null references portal.tipos_asunto(id),
  nombre text not null,
  activa boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references identidad."user"(id)
);
create unique index plantillas_una_activa on portal.plantillas (tipo_asunto_id) where activa;

create table portal.plantilla_items (
  id uuid primary key default gen_random_uuid(),
  plantilla_id uuid not null references portal.plantillas(id) on delete cascade,
  titulo text not null check (length(titulo) between 3 and 160),
  explicacion text not null check (length(explicacion) between 3 and 600),
  ejemplo text check (length(ejemplo) <= 300),
  obligatorio boolean not null default true,
  multiple boolean not null default false,
  sensible boolean not null default false,
  orden int not null default 100,
  activo boolean not null default true
);

create sequence portal.seq_solicitud;
create sequence portal.seq_expediente;

create table portal.solicitudes (
  id uuid primary key default gen_random_uuid(),
  referencia text not null unique default ('SOL-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('portal.seq_solicitud')::text, 5, '0')),
  cliente_id uuid not null references identidad."user"(id) on delete restrict,
  tipo_asunto_id text references portal.tipos_asunto(id),
  estado portal.estado_solicitud not null default 'borrador',
  paso smallint not null default 1 check (paso between 1 and 4),
  descripcion text check (length(descripcion) <= 4000),
  contraparte text check (length(contraparte) <= 300),
  localidad text check (length(localidad) <= 120),
  fechas text check (length(fechas) <= 300),
  urgencia text not null default 'normal' check (urgencia in ('normal', 'urgente')),
  contacto_preferido text not null default 'portal' check (contacto_preferido in ('portal', 'correo', 'telefono')),
  responsable_id uuid references portal.personal(user_id),
  conflictos_revisados_at timestamptz,
  conflictos_revisados_por uuid references portal.personal(user_id),
  estado_visible text check (length(estado_visible) <= 600),
  motivo_no_aceptada text check (length(motivo_no_aceptada) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  enviada_at timestamptz,
  decidida_at timestamptz,
  decidida_por uuid references portal.personal(user_id)
);
create index solicitudes_cliente on portal.solicitudes (cliente_id);
create index solicitudes_estado on portal.solicitudes (estado, enviada_at);

create table portal.expedientes (
  id uuid primary key default gen_random_uuid(),
  referencia text not null unique default ('EXP-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('portal.seq_expediente')::text, 5, '0')),
  solicitud_id uuid not null unique references portal.solicitudes(id) on delete restrict,
  cliente_id uuid not null references identidad."user"(id) on delete restrict,
  titulo text not null check (length(titulo) between 3 and 200),
  tipo_asunto_id text references portal.tipos_asunto(id),
  estado portal.estado_expediente not null default 'activo',
  responsable_id uuid not null references portal.personal(user_id),
  estado_visible text check (length(estado_visible) <= 600),
  abierto_at timestamptz not null default now(),
  abierto_por uuid not null references portal.personal(user_id),
  cerrado_at timestamptz
);
create index expedientes_cliente on portal.expedientes (cliente_id);

-- Contactos autorizados por el despacho sobre una solicitud concreta (revocables).
create table portal.accesos (
  id uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null references portal.solicitudes(id) on delete restrict,
  user_id uuid not null references identidad."user"(id) on delete restrict,
  permiso text not null check (permiso in ('lectura', 'aportar')),
  concedido_por uuid not null references portal.personal(user_id),
  concedido_at timestamptz not null default now(),
  revocado_at timestamptz,
  revocado_por uuid references portal.personal(user_id)
);
create unique index accesos_vigente on portal.accesos (solicitud_id, user_id) where revocado_at is null;

create table portal.requisitos (
  id uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null references portal.solicitudes(id) on delete restrict,
  plantilla_item_id uuid references portal.plantilla_items(id) on delete set null,
  titulo text not null check (length(titulo) between 3 and 160),
  explicacion text not null check (length(explicacion) between 3 and 600),
  ejemplo text check (length(ejemplo) <= 300),
  obligatorio boolean not null default true,
  multiple boolean not null default false,
  sensible boolean not null default false,
  estado portal.estado_requisito not null default 'pendiente',
  comentario text check (length(comentario) <= 1000),
  orden int not null default 100,
  solicitado_por uuid references portal.personal(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index requisitos_solicitud on portal.requisitos (solicitud_id, orden);

create table portal.documentos (
  id uuid primary key default gen_random_uuid(),
  requisito_id uuid not null references portal.requisitos(id) on delete restrict,
  solicitud_id uuid not null references portal.solicitudes(id) on delete restrict,
  cliente_id uuid not null references identidad."user"(id) on delete restrict,
  version int not null,
  sustituye_a uuid references portal.documentos(id),
  storage_key text not null unique check (storage_key ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}$'),
  nombre_original text not null check (length(nombre_original) between 1 and 200),
  mime text not null check (mime in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif')),
  tamano bigint not null check (tamano > 0),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  subido_por uuid not null references identidad."user"(id),
  subido_at timestamptz not null default now(),
  estado portal.estado_documento not null default 'pendiente',
  motivo text check (length(motivo) <= 1000),
  revisado_por uuid references portal.personal(user_id),
  revisado_at timestamptz,
  analisis text not null default 'no_analizado' check (analisis in ('no_analizado', 'limpio', 'infectado', 'error'))
);
create index documentos_requisito on portal.documentos (requisito_id, version);
create index documentos_solicitud on portal.documentos (solicitud_id);
create index documentos_subidor on portal.documentos (subido_por, subido_at);

create table portal.notas_internas (
  id uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null references portal.solicitudes(id) on delete restrict,
  autor_id uuid not null references portal.personal(user_id),
  texto text not null check (length(texto) between 1 and 4000),
  created_at timestamptz not null default now()
);

create table portal.mensajes (
  id uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null references portal.solicitudes(id) on delete restrict,
  autor_id uuid not null references identidad."user"(id),
  del_despacho boolean not null,
  texto text not null check (length(btrim(texto)) between 1 and 4000),
  created_at timestamptz not null default now(),
  leido_at timestamptz
);
create index mensajes_solicitud on portal.mensajes (solicitud_id, created_at);

-- Registro de auditoría y cronología: solo se añade, nunca se modifica ni se borra.
create table portal.eventos (
  id bigserial primary key,
  solicitud_id uuid references portal.solicitudes(id),
  expediente_id uuid references portal.expedientes(id),
  actor_id uuid references identidad."user"(id),
  tipo text not null,
  detalle jsonb not null default '{}',
  visible_cliente boolean not null default false,
  happened_at timestamptz not null default now(),
  recorded_at timestamptz not null default now()
);
create index eventos_solicitud on portal.eventos (solicitud_id, id);

create table portal.notificaciones (
  id uuid primary key default gen_random_uuid(),
  destinatario_id uuid references identidad."user"(id),
  destino text not null check (destino in ('cliente', 'despacho')),
  tipo text not null check (tipo in ('novedades', 'recordatorio', 'aviso_interno')),
  solicitud_id uuid references portal.solicitudes(id),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'enviada', 'error', 'cancelada')),
  intentos int not null default 0,
  ultimo_error text,
  enviar_despues timestamptz not null default now(),
  created_at timestamptz not null default now(),
  enviada_at timestamptz
);
-- Agrupa avisos: mientras haya uno pendiente para el mismo destinatario, solicitud y tipo, no se crea otro.
create unique index notificaciones_sin_duplicar on portal.notificaciones
  (coalesce(destinatario_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(solicitud_id, '00000000-0000-0000-0000-000000000000'::uuid), tipo)
  where estado = 'pendiente';
