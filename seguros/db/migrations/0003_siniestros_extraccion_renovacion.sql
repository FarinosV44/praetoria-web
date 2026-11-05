-- 0003 · Texto por página, extracción revisable (#2), siniestros con análisis (#7) y renegociación (#6)

-- ---------------------------------------------------------------- Texto de cada página (para citar y verificar)
-- Se obtiene del propio PDF (capa de texto). Los escaneados sin capa de texto quedan sin filas: sus citas se
-- marcan como «no verificables automáticamente».
CREATE TABLE documento_paginas (
  documento_id  uuid NOT NULL REFERENCES documentos(id) ON DELETE CASCADE,
  pagina        integer NOT NULL CHECK (pagina > 0),
  texto         text NOT NULL,
  PRIMARY KEY (documento_id, pagina)
);
ALTER TABLE documentos ADD COLUMN texto_extraido boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------- Extracción revisable (#2)
-- Cada lectura es una versión nueva; nunca se aplica sola: la persona confirma campo a campo.
CREATE TABLE extracciones (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id  uuid NOT NULL REFERENCES documentos(id),
  titular_id    uuid NOT NULL REFERENCES titulares(id),
  version       integer NOT NULL,
  estado        text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'procesando', 'revision', 'confirmado', 'error', 'descartado')),
  intentos      integer NOT NULL DEFAULT 0,
  proveedor     text,
  modelo        text,
  campos        jsonb,                   -- {campo: {valor, pagina, cita, confianza, verificada}}
  avisos        jsonb,                   -- dudas, documentos que faltan, ilegibilidad…
  error         text,
  solicitada_por uuid REFERENCES usuarios(id),
  creada_en     timestamptz NOT NULL DEFAULT now(),
  terminada_en  timestamptz,
  aplicada_por  uuid REFERENCES usuarios(id),
  aplicada_en   timestamptz,
  campos_aplicados jsonb,
  UNIQUE (documento_id, version)
);
CREATE INDEX extracciones_cola ON extracciones (estado, creada_en);

-- ---------------------------------------------------------------- Siniestros (#7)
CREATE TABLE siniestros (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titular_id          uuid NOT NULL REFERENCES titulares(id),
  titulo              text NOT NULL,
  relato              text NOT NULL,
  fecha_hecho         date,
  fecha_conocimiento  date,
  lugar               text,
  riesgo_afectado     text,
  danos               text,
  terceros            text,
  importe_estimado    numeric(12,2),
  pruebas             text,
  estado              text NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'comunicado', 'en_tramitacion',
                        'documentacion_solicitada', 'aceptado', 'rechazado', 'cerrado')),
  referencia_aseguradora text,
  plazo_comunicacion  date,
  plazo_comunicacion_fuente text,
  creado_por          uuid REFERENCES usuarios(id),
  creado_en           timestamptz NOT NULL DEFAULT now(),
  actualizado_en      timestamptz NOT NULL DEFAULT now(),
  archivado_en        timestamptz
);
CREATE INDEX siniestros_titular ON siniestros (titular_id);

-- Pólizas candidatas y la anualidad que estaba vigente en la fecha del hecho (elegida o confirmada por la persona).
CREATE TABLE siniestro_polizas (
  siniestro_id  uuid NOT NULL REFERENCES siniestros(id) ON DELETE CASCADE,
  poliza_id     uuid NOT NULL REFERENCES polizas(id),
  anualidad_id  uuid REFERENCES anualidades(id),
  PRIMARY KEY (siniestro_id, poliza_id)
);

-- Fotos, partes y comunicaciones del siniestro (mismo almacén privado que los documentos de póliza).
CREATE TABLE siniestro_archivos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  siniestro_id    uuid NOT NULL REFERENCES siniestros(id),
  titular_id      uuid NOT NULL REFERENCES titulares(id),
  tipo            text NOT NULL CHECK (tipo IN ('foto', 'parte', 'comunicacion', 'presupuesto', 'otro')),
  nombre_original text NOT NULL,
  mime            text NOT NULL,
  bytes           bigint NOT NULL,
  sha256          text NOT NULL,
  clave_almacen   text NOT NULL UNIQUE,
  subido_por      uuid REFERENCES usuarios(id),
  subido_en       timestamptz NOT NULL DEFAULT now(),
  eliminado_en    timestamptz,
  purgado_en      timestamptz
);

-- Seguimiento: cambios de estado, comunicaciones, pagos y notas.
CREATE TABLE siniestro_eventos (
  id            bigserial PRIMARY KEY,
  siniestro_id  uuid NOT NULL REFERENCES siniestros(id) ON DELETE CASCADE,
  tipo          text NOT NULL CHECK (tipo IN ('estado', 'nota', 'comunicacion', 'pago')),
  fecha         date NOT NULL,
  texto         text,
  importe       numeric(12,2),
  creado_por    uuid REFERENCES usuarios(id),
  creado_en     timestamptz NOT NULL DEFAULT now()
);

-- Análisis del asistente: versiones inmutables, con los documentos exactos que se usaron.
CREATE TABLE siniestro_analisis (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  siniestro_id    uuid NOT NULL REFERENCES siniestros(id),
  version         integer NOT NULL,
  estado          text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'procesando', 'listo', 'error')),
  intentos        integer NOT NULL DEFAULT 0,
  proveedor       text,
  modelo          text,
  documentos      jsonb,                 -- [{indice, documento_id, nombre, tipo, anualidad_id, poliza_id}]
  faltan          jsonb,                 -- avisos previos: condiciones generales ausentes, póliza sin anualidad en la fecha…
  resultado       jsonb,                 -- respuesta estructurada validada
  error           text,
  solicitado_por  uuid REFERENCES usuarios(id),
  creado_en       timestamptz NOT NULL DEFAULT now(),
  terminado_en    timestamptz,
  UNIQUE (siniestro_id, version)
);
CREATE INDEX analisis_cola ON siniestro_analisis (estado, creado_en);

-- Borradores editables de comunicación (versionados; el usuario decide si los envía).
CREATE TABLE siniestro_borradores (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  siniestro_id  uuid NOT NULL REFERENCES siniestros(id) ON DELETE CASCADE,
  analisis_id   uuid REFERENCES siniestro_analisis(id),
  origen        text NOT NULL CHECK (origen IN ('asistente', 'plantilla', 'manual')),
  texto         text NOT NULL,
  creado_por    uuid REFERENCES usuarios(id),
  creado_en     timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- Renegociación (#6)
CREATE TABLE renovaciones (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anualidad_id    uuid NOT NULL UNIQUE REFERENCES anualidades(id),
  poliza_id       uuid NOT NULL REFERENCES polizas(id),
  titular_id      uuid NOT NULL REFERENCES titulares(id),
  estado          text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'contactado', 'ofertas', 'decision',
                    'renovada', 'sustituida', 'baja')),
  interlocutor    text,
  nueva_anualidad_id uuid REFERENCES anualidades(id),
  nueva_poliza_id uuid REFERENCES polizas(id),
  creada_por      uuid REFERENCES usuarios(id),
  creada_en       timestamptz NOT NULL DEFAULT now(),
  actualizada_en  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ofertas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  renovacion_id   uuid NOT NULL REFERENCES renovaciones(id) ON DELETE CASCADE,
  aseguradora     text NOT NULL,
  es_renovacion_actual boolean NOT NULL DEFAULT false,   -- propuesta de la compañía actual
  prima_anual     numeric(12,2),
  impuestos_gastos text,
  garantias       text,
  capitales       text,
  franquicias     text,
  exclusiones     text,
  vigencia        text,
  notas           text,
  documento_id    uuid REFERENCES documentos(id),
  elegida         boolean NOT NULL DEFAULT false,
  creada_por      uuid REFERENCES usuarios(id),
  creada_en       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE renovacion_notas (
  id            bigserial PRIMARY KEY,
  renovacion_id uuid NOT NULL REFERENCES renovaciones(id) ON DELETE CASCADE,
  tipo          text NOT NULL CHECK (tipo IN ('nota', 'tarea', 'comunicacion', 'estado', 'borrador')),
  texto         text NOT NULL,
  hecha         boolean NOT NULL DEFAULT false,
  fecha_tarea   date,
  creado_por    uuid REFERENCES usuarios(id),
  creado_en     timestamptz NOT NULL DEFAULT now()
);

-- Resumen de condiciones confirmado por la persona (garantías, exclusiones, franquicias, capitales),
-- cada elemento con su referencia: [{texto, documento_id, pagina, cita}]
ALTER TABLE anualidades
  ADD COLUMN garantias jsonb,
  ADD COLUMN exclusiones jsonb,
  ADD COLUMN franquicias jsonb,
  ADD COLUMN capitales jsonb;
