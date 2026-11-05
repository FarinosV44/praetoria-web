-- 0001 · Base: usuarios, sesiones, titulares, ramos, pólizas, anualidades, documentos y auditoría (#1, #8)
-- Convenciones: fechas de calendario como DATE (sin hora), importes NUMERIC(12,2), nada se borra físicamente
-- salvo sesiones y fichas caducadas; las pólizas y documentos se archivan.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------- Usuarios y acceso
CREATE TABLE usuarios (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text NOT NULL,
  nombre          text NOT NULL,
  clave_hash      text NOT NULL,
  rol             text NOT NULL CHECK (rol IN ('admin', 'colaborador')),
  activo          boolean NOT NULL DEFAULT true,
  creado_en       timestamptz NOT NULL DEFAULT now(),
  ultimo_acceso   timestamptz
);
CREATE UNIQUE INDEX usuarios_email_unico ON usuarios (lower(email));

-- El identificador es el SHA-256 del token de la cookie: un volcado de la tabla no permite suplantar sesiones.
CREATE TABLE sesiones (
  id              text PRIMARY KEY,
  usuario_id      uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  creada_en       timestamptz NOT NULL DEFAULT now(),
  caduca_en       timestamptz NOT NULL,
  vista_en        timestamptz NOT NULL DEFAULT now(),
  agente          text
);
CREATE INDEX sesiones_usuario ON sesiones (usuario_id);

-- Limitación de intentos de acceso y de operaciones costosas (subidas, IA, recuperación).
CREATE TABLE limites (
  id              bigserial PRIMARY KEY,
  clave           text NOT NULL,
  en              timestamptz NOT NULL DEFAULT now(),
  exito           boolean NOT NULL DEFAULT false
);
CREATE INDEX limites_clave_en ON limites (clave, en DESC);

CREATE TABLE recuperaciones (
  id              text PRIMARY KEY,                -- SHA-256 del token enviado
  usuario_id      uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  caduca_en       timestamptz NOT NULL,
  usada_en        timestamptz
);

-- ---------------------------------------------------------------- Titulares
-- Titular = la empresa o persona a cuyo nombre se organizan las pólizas en la aplicación.
-- No equivale a tomador, asegurado ni beneficiario: esos se registran en cada póliza.
CREATE TABLE titulares (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo            text NOT NULL CHECK (tipo IN ('empresa', 'particular')),
  nombre          text NOT NULL,
  nif             text,
  notas           text,
  archivado_en    timestamptz,
  creado_en       timestamptz NOT NULL DEFAULT now(),
  actualizado_en  timestamptz NOT NULL DEFAULT now()
);

-- Acceso explícito de colaboradores a titulares (los administradores ven todos).
CREATE TABLE accesos_titular (
  usuario_id      uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  titular_id      uuid NOT NULL REFERENCES titulares(id) ON DELETE CASCADE,
  concedido_en    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, titular_id)
);

-- ---------------------------------------------------------------- Ramos (editables)
CREATE TABLE ramos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clave           text NOT NULL UNIQUE,
  nombre          text NOT NULL,
  icono           text NOT NULL DEFAULT 'otros',
  orden           integer NOT NULL DEFAULT 100,
  activo          boolean NOT NULL DEFAULT true
);
INSERT INTO ramos (clave, nombre, icono, orden) VALUES
  ('coche', 'Coche / moto', 'coche', 10),
  ('hogar', 'Hogar', 'hogar', 20),
  ('negocio', 'Negocio / multirriesgo', 'negocio', 30),
  ('salud', 'Salud', 'salud', 40),
  ('vida', 'Vida', 'vida', 50),
  ('accidentes', 'Accidentes', 'accidentes', 60),
  ('rc', 'Responsabilidad civil', 'rc', 70),
  ('transporte', 'Transporte / mercancías', 'transporte', 80),
  ('defensa', 'Defensa jurídica', 'defensa', 90),
  ('otros', 'Otros', 'otros', 100);

-- ---------------------------------------------------------------- Pólizas
CREATE TABLE polizas (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titular_id          uuid NOT NULL REFERENCES titulares(id),
  ramo_id             uuid NOT NULL REFERENCES ramos(id),
  nombre              text NOT NULL,                 -- denominación corta: «Furgoneta 1234-ABC», «Nave Paterna»
  riesgo              text,                          -- objeto asegurado: matrícula, inmueble, actividad…
  aseguradora         text NOT NULL,
  numero              text,                          -- número de póliza (puede faltar hasta tener el documento)
  tomador             text,
  asegurado           text,
  beneficiario        text,
  mediador            text,
  mediador_telefono   text,
  mediador_email      text,
  asistencia_telefono text,
  moneda              char(3) NOT NULL DEFAULT 'EUR',
  renovacion_automatica boolean,                     -- NULL = no consta
  estado              text NOT NULL DEFAULT 'activa'
                      CHECK (estado IN ('activa', 'en_negociacion', 'anulada', 'sustituida')),
  sustituida_por      uuid REFERENCES polizas(id),
  notas               text,
  creada_por          uuid REFERENCES usuarios(id),
  creada_en           timestamptz NOT NULL DEFAULT now(),
  actualizada_en      timestamptz NOT NULL DEFAULT now(),
  archivada_en        timestamptz
);
CREATE INDEX polizas_titular ON polizas (titular_id);

-- Anualidad / versión: cada renovación crea una fila nueva; las anteriores se conservan intactas.
CREATE TABLE anualidades (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poliza_id           uuid NOT NULL REFERENCES polizas(id),
  inicio              date,                          -- NULL = pendiente de confirmar
  fin                 date,                          -- vencimiento; NULL = pendiente
  prima_anual         numeric(12,2) CHECK (prima_anual >= 0),         -- prima total anual real (si consta)
  periodicidad        text CHECK (periodicidad IN ('anual', 'semestral', 'trimestral', 'mensual', 'unica')),
  importe_recibo      numeric(12,2) CHECK (importe_recibo >= 0),      -- importe de cada recibo
  plazo_oposicion     date,                          -- fecha límite para oponerse a la prórroga
  plazo_oposicion_fuente text,                       -- p. ej. «Condiciones generales, art. 12, pág. 4»
  plazo_oposicion_confirmado boolean NOT NULL DEFAULT false,
  datos_confirmados   boolean NOT NULL DEFAULT false, -- revisados por una persona
  notas               text,
  creada_por          uuid REFERENCES usuarios(id),
  creada_en           timestamptz NOT NULL DEFAULT now(),
  actualizada_en      timestamptz NOT NULL DEFAULT now(),
  anulada_en          timestamptz,
  CHECK (fin IS NULL OR inicio IS NULL OR fin > inicio)
);
CREATE INDEX anualidades_poliza ON anualidades (poliza_id, inicio DESC NULLS LAST);

-- ---------------------------------------------------------------- Documentos (originales privados)
CREATE TABLE documentos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poliza_id       uuid NOT NULL REFERENCES polizas(id),
  anualidad_id    uuid REFERENCES anualidades(id),
  titular_id      uuid NOT NULL REFERENCES titulares(id),   -- copia para autorizar sin JOIN
  tipo            text NOT NULL CHECK (tipo IN ('condiciones_particulares', 'condiciones_generales',
                    'suplemento', 'recibo', 'renovacion', 'oferta', 'otro')),
  nombre_original text NOT NULL,
  mime            text NOT NULL,
  bytes           bigint NOT NULL,
  sha256          text NOT NULL,
  clave_almacen   text NOT NULL UNIQUE,
  paginas         integer,
  estado          text NOT NULL DEFAULT 'pendiente'
                  CHECK (estado IN ('pendiente', 'procesando', 'revision', 'confirmado', 'error')),
  subido_por      uuid REFERENCES usuarios(id),
  subido_en       timestamptz NOT NULL DEFAULT now(),
  eliminado_en    timestamptz
);
CREATE INDEX documentos_poliza ON documentos (poliza_id);
CREATE INDEX documentos_sha ON documentos (titular_id, sha256);

-- ---------------------------------------------------------------- Auditoría
-- Solo identificadores y campos cambiados; nunca el contenido de documentos ni datos de salud.
CREATE TABLE auditoria (
  id              bigserial PRIMARY KEY,
  en              timestamptz NOT NULL DEFAULT now(),
  usuario_id      uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  accion          text NOT NULL,
  entidad         text NOT NULL,
  entidad_id      text,
  titular_id      uuid,
  detalle         jsonb
);
CREATE INDEX auditoria_en ON auditoria (en DESC);
