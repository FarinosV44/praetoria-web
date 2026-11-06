-- 0007 · Cada póliza es un expediente permanente: documentos de cualquier tipo con su fecha, notas propias,
-- modificaciones de condiciones (suplementos), comunicaciones, asuntos y recibos/pagos. Nada se borra al renovar.

-- Documentos: más tipos y la fecha del propio documento (distinta de la de subida).
ALTER TABLE documentos DROP CONSTRAINT documentos_tipo_check;
ALTER TABLE documentos ADD CONSTRAINT documentos_tipo_check CHECK (tipo IN (
  'condiciones_particulares', 'condiciones_generales', 'suplemento', 'renovacion', 'recibo', 'justificante_pago',
  'comunicacion', 'siniestro', 'informe', 'fotografia', 'reclamacion', 'oferta', 'otro'));
ALTER TABLE documentos ADD COLUMN fecha_documento date;
ALTER TABLE documentos ADD COLUMN descripcion text;

-- Asuntos abiertos del seguro (un siniestro, una reclamación, una revisión de prima…), con su resumen de estado.
CREATE TABLE asuntos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poliza_id         uuid NOT NULL REFERENCES polizas(id),
  siniestro_id      uuid UNIQUE REFERENCES siniestros(id),
  tipo              text NOT NULL CHECK (tipo IN ('siniestro', 'reclamacion', 'documentacion', 'prima', 'comunicacion', 'otro')),
  titulo            text NOT NULL,
  estado            text NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto', 'cerrado')),
  resumen           jsonb,          -- {ocurrido, ultima_actuacion, respuesta, pendiente, siguiente_paso, citas}
  resumen_en        timestamptz,
  resumen_desactualizado boolean NOT NULL DEFAULT true,
  creado_por        uuid REFERENCES usuarios(id),
  creado_en         timestamptz NOT NULL DEFAULT now(),
  cerrado_en        timestamptz
);
CREATE INDEX asuntos_poliza ON asuntos (poliza_id, estado);

-- Un documento del seguro puede pertenecer también a un siniestro (sin duplicar el archivo).
CREATE TABLE documento_siniestros (
  documento_id  uuid NOT NULL REFERENCES documentos(id) ON DELETE CASCADE,
  siniestro_id  uuid NOT NULL REFERENCES siniestros(id) ON DELETE CASCADE,
  PRIMARY KEY (documento_id, siniestro_id)
);

-- Notas propias: afirmaciones que no están acreditadas por un documento.
CREATE TABLE notas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poliza_id     uuid NOT NULL REFERENCES polizas(id),
  asunto_id     uuid REFERENCES asuntos(id),
  fecha         date NOT NULL,
  texto         text NOT NULL CHECK (length(texto) BETWEEN 1 AND 8000),
  creado_por    uuid REFERENCES usuarios(id),
  creado_en     timestamptz NOT NULL DEFAULT now(),
  eliminado_en  timestamptz
);
CREATE INDEX notas_poliza ON notas (poliza_id, fecha DESC);

-- Modificaciones de condiciones dentro de un periodo (suplementos), con su fecha de efecto.
CREATE TABLE modificaciones (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poliza_id     uuid NOT NULL REFERENCES polizas(id),
  anualidad_id  uuid REFERENCES anualidades(id),
  fecha_efecto  date,
  descripcion   text NOT NULL,
  documento_id  uuid REFERENCES documentos(id),
  pagina        integer,
  cita          text,
  origen        text NOT NULL DEFAULT 'manual' CHECK (origen IN ('ia', 'manual')),
  creado_por    uuid REFERENCES usuarios(id),
  creado_en     timestamptz NOT NULL DEFAULT now(),
  anulada_en    timestamptz
);
CREATE INDEX modificaciones_poliza ON modificaciones (poliza_id, fecha_efecto);

-- Comunicaciones con la aseguradora o el mediador (enviadas o recibidas).
CREATE TABLE comunicaciones (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poliza_id     uuid NOT NULL REFERENCES polizas(id),
  asunto_id     uuid REFERENCES asuntos(id),
  fecha         date NOT NULL,
  direccion     text NOT NULL CHECK (direccion IN ('enviada', 'recibida')),
  medio         text NOT NULL DEFAULT 'otro' CHECK (medio IN ('correo', 'carta', 'burofax', 'telefono', 'web', 'presencial', 'otro')),
  interlocutor  text,
  asunto        text,
  resumen       text,
  documento_id  uuid REFERENCES documentos(id),
  escrito_version_id uuid,          -- escrito enviado (entrega 3)
  origen        text NOT NULL DEFAULT 'manual' CHECK (origen IN ('ia', 'manual')),
  creado_por    uuid REFERENCES usuarios(id),
  creado_en     timestamptz NOT NULL DEFAULT now(),
  eliminado_en  timestamptz
);
CREATE INDEX comunicaciones_poliza ON comunicaciones (poliza_id, fecha DESC);

-- Recibos y pagos. Un recibo emitido NO es un pago: solo «pagado» con fecha de pago (justificante o confirmación).
CREATE TABLE recibos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poliza_id       uuid NOT NULL REFERENCES polizas(id),
  anualidad_id    uuid REFERENCES anualidades(id),
  numero          text,
  periodo_desde   date,
  periodo_hasta   date,
  fecha_cargo     date,              -- fecha prevista de cobro
  fecha_pago      date,              -- fecha real de pago acreditada
  importe         numeric(12,2) CHECK (importe >= 0),
  periodicidad    text CHECK (periodicidad IN ('anual', 'semestral', 'trimestral', 'mensual', 'unica')),
  estado          text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('previsto', 'pendiente', 'pagado', 'devuelto', 'anulado')),
  documento_id    uuid REFERENCES documentos(id),     -- el recibo
  justificante_id uuid REFERENCES documentos(id),     -- el justificante de pago
  origen          text NOT NULL DEFAULT 'manual' CHECK (origen IN ('ia', 'manual')),
  revisado        boolean NOT NULL DEFAULT false,
  notas           text,
  creado_por      uuid REFERENCES usuarios(id),
  creado_en       timestamptz NOT NULL DEFAULT now(),
  actualizado_en  timestamptz NOT NULL DEFAULT now(),
  CHECK (periodo_hasta IS NULL OR periodo_desde IS NULL OR periodo_hasta > periodo_desde),
  CHECK (estado <> 'pagado' OR fecha_pago IS NOT NULL)
);
CREATE INDEX recibos_poliza ON recibos (poliza_id, coalesce(fecha_cargo, periodo_desde) DESC);
CREATE UNIQUE INDEX recibos_numero ON recibos (poliza_id, numero) WHERE numero IS NOT NULL AND estado <> 'anulado';
CREATE UNIQUE INDEX recibos_periodo ON recibos (poliza_id, periodo_desde, importe) WHERE periodo_desde IS NOT NULL AND importe IS NOT NULL AND estado <> 'anulado';

-- Conversaciones con la IA dentro de cada seguro (opcionalmente centradas en un asunto).
CREATE TABLE conversaciones (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poliza_id     uuid NOT NULL REFERENCES polizas(id),
  asunto_id     uuid REFERENCES asuntos(id),
  titulo        text NOT NULL,
  creada_por    uuid REFERENCES usuarios(id),
  creada_en     timestamptz NOT NULL DEFAULT now(),
  actualizada_en timestamptz NOT NULL DEFAULT now(),
  eliminada_en  timestamptz
);
CREATE INDEX conversaciones_poliza ON conversaciones (poliza_id, actualizada_en DESC);
CREATE TABLE mensajes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversacion_id uuid NOT NULL REFERENCES conversaciones(id) ON DELETE CASCADE,
  rol             text NOT NULL CHECK (rol IN ('usuario', 'asistente')),
  texto           text NOT NULL,
  estado          text NOT NULL DEFAULT 'listo' CHECK (estado IN ('pendiente', 'listo', 'error')),
  citas           jsonb,          -- [{documento_id, documento, pagina, fecha, cita, verificada}]
  fuentes         jsonb,          -- documentos consultados para la respuesta
  escrito_id      uuid,           -- escrito generado en esta respuesta
  modelo          text,
  error           text,
  creado_por      uuid REFERENCES usuarios(id),
  creado_en       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mensajes_conversacion ON mensajes (conversacion_id, creado_en);

-- Escritos: borradores con versiones; enviarlos se registra aparte (generar ≠ comunicar).
CREATE TABLE escritos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poliza_id     uuid NOT NULL REFERENCES polizas(id),
  asunto_id     uuid REFERENCES asuntos(id),
  conversacion_id uuid REFERENCES conversaciones(id),
  tipo          text NOT NULL DEFAULT 'otro',
  titulo        text NOT NULL,
  destinatario  text,
  estado        text NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'enviado', 'respondido', 'descartado')),
  creado_por    uuid REFERENCES usuarios(id),
  creado_en     timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  eliminado_en  timestamptz
);
CREATE INDEX escritos_poliza ON escritos (poliza_id, creado_en DESC);
CREATE TABLE escrito_versiones (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escrito_id    uuid NOT NULL REFERENCES escritos(id) ON DELETE CASCADE,
  version       integer NOT NULL,
  texto         text NOT NULL,
  origen        text NOT NULL CHECK (origen IN ('ia', 'manual')),
  datos_faltantes jsonb,
  citas         jsonb,
  creado_por    uuid REFERENCES usuarios(id),
  creado_en     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (escrito_id, version)
);
ALTER TABLE comunicaciones ADD CONSTRAINT comunicaciones_escrito_fk FOREIGN KEY (escrito_version_id) REFERENCES escrito_versiones(id);
ALTER TABLE mensajes ADD CONSTRAINT mensajes_escrito_fk FOREIGN KEY (escrito_id) REFERENCES escritos(id);
