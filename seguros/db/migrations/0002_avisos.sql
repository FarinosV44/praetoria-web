-- 0002 · Motor de avisos, centro de notificaciones, suscripciones push y estado del planificador (#4, #5)

-- Ajustes generales (clave/valor). Valores por defecto de los avisos:
CREATE TABLE ajustes (
  clave           text PRIMARY KEY,
  valor           jsonb NOT NULL,
  actualizado_en  timestamptz NOT NULL DEFAULT now()
);
INSERT INTO ajustes (clave, valor) VALUES
  ('avisos.margen_oposicion_dias', '15'),   -- días antes de la fecha límite de oposición confirmada
  ('avisos.recordatorio_dias', '7'),        -- recordatorio adicional antes del vencimiento (0 = desactivado)
  ('avisos.repetir_dias', '7'),             -- repetir un aviso sin atender cada N días…
  ('avisos.max_repeticiones', '2'),         -- …como mucho N veces
  ('avisos.hora_envio', '9');               -- no se envía antes de esta hora (Europe/Madrid)

-- Preferencias de cada persona
ALTER TABLE usuarios
  ADD COLUMN correo_avisos text NOT NULL DEFAULT 'respaldo' CHECK (correo_avisos IN ('nunca', 'respaldo', 'siempre')),
  ADD COLUMN push_detallado boolean NOT NULL DEFAULT false;   -- por defecto, texto discreto en pantalla bloqueada

CREATE TABLE push_suscripciones (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id      uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  endpoint        text NOT NULL UNIQUE,
  p256dh          text NOT NULL,
  auth            text NOT NULL,
  agente          text,
  creada_en       timestamptz NOT NULL DEFAULT now(),
  ultimo_exito    timestamptz,
  ultimo_error    text,
  revocada_en     timestamptz
);
CREATE INDEX push_usuario ON push_suscripciones (usuario_id) WHERE revocada_en IS NULL;

-- Un aviso por anualidad, tipo y fecha programada. La clave única impide duplicados aunque la tarea se repita.
CREATE TABLE avisos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clave           text NOT NULL UNIQUE,
  anualidad_id    uuid NOT NULL REFERENCES anualidades(id),
  poliza_id       uuid NOT NULL REFERENCES polizas(id),
  titular_id      uuid NOT NULL REFERENCES titulares(id),
  tipo            text NOT NULL CHECK (tipo IN ('vencimiento_mes', 'oposicion', 'recordatorio', 'vencida')),
  fecha           date NOT NULL,                 -- día en que corresponde avisar
  referencia      date NOT NULL,                 -- vencimiento o fecha límite a la que se refiere
  estado          text NOT NULL DEFAULT 'programado'
                  CHECK (estado IN ('programado', 'emitido', 'reconocido', 'pospuesto', 'en_negociacion', 'obsoleto')),
  pospuesto_hasta date,
  repeticiones    integer NOT NULL DEFAULT 0,
  emitido_en      timestamptz,
  ultima_emision  timestamptz,
  atendido_por    uuid REFERENCES usuarios(id),
  atendido_en     timestamptz,
  creado_en       timestamptz NOT NULL DEFAULT now(),
  obsoleto_en     timestamptz
);
CREATE INDEX avisos_titular ON avisos (titular_id, estado);
CREATE INDEX avisos_pendientes ON avisos (estado, fecha);

-- Cola persistente de envíos. Idempotente por aviso/emisión/canal/destinatario.
CREATE TABLE envios (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clave           text NOT NULL UNIQUE,
  aviso_id        uuid NOT NULL REFERENCES avisos(id),
  usuario_id      uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  canal           text NOT NULL CHECK (canal IN ('app', 'push', 'correo')),
  suscripcion_id  uuid REFERENCES push_suscripciones(id) ON DELETE SET NULL,
  estado          text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'enviando', 'enviado', 'fallido', 'descartado')),
  intentos        integer NOT NULL DEFAULT 0,
  proximo_intento timestamptz NOT NULL DEFAULT now(),
  ultimo_error    text,
  enviado_en      timestamptz,                   -- aceptado por el proveedor (no implica lectura)
  leido_en        timestamptz,                   -- la persona lo abrió en la aplicación
  creado_en       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX envios_cola ON envios (estado, proximo_intento);
CREATE INDEX envios_usuario ON envios (usuario_id, creado_en DESC);

-- Registro de ejecuciones del planificador (indicadores de salud, #9)
CREATE TABLE ejecuciones (
  id              bigserial PRIMARY KEY,
  tarea           text NOT NULL,
  inicio          timestamptz NOT NULL DEFAULT now(),
  fin             timestamptz,
  ok              boolean,
  resumen         jsonb,
  error           text
);
CREATE INDEX ejecuciones_tarea ON ejecuciones (tarea, inicio DESC);

-- Purga física de documentos eliminados tras el periodo de retención (docs/SEGURIDAD.md)
ALTER TABLE documentos ADD COLUMN purgado_en timestamptz;
