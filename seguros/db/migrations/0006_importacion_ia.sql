-- 0006 · Alta de pólizas subiendo documentos: la IA lee, guarda y organiza; lo que no está en la póliza
-- (teléfono de siniestros, asistencia) se busca en internet y se guarda con su fuente.

-- Importaciones: un lote de documentos que la IA convierte en titulares, pólizas y anualidades.
CREATE TABLE importaciones (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estado         text NOT NULL DEFAULT 'subiendo'
                 CHECK (estado IN ('subiendo', 'pendiente', 'procesando', 'hecha', 'error')),
  poliza_id      uuid REFERENCES polizas(id),       -- si se sube desde la ficha de una póliza
  titular_id     uuid REFERENCES titulares(id),     -- titular elegido (opcional) si el documento no lo identifica
  archivos       jsonb NOT NULL DEFAULT '[]',        -- [{clave, nombre, mime, bytes, sha256}]
  resultado      jsonb,                              -- resumen: pólizas creadas/actualizadas, datos guardados, pendientes
  avisos         jsonb,
  error          text,
  intentos       integer NOT NULL DEFAULT 0,
  modelo         text,
  solicitada_por uuid REFERENCES usuarios(id),
  creada_en      timestamptz NOT NULL DEFAULT now(),
  terminada_en   timestamptz
);
CREATE INDEX importaciones_estado ON importaciones (estado, creada_en);

-- Las subidas de una importación todavía no tienen titular ni póliza.
ALTER TABLE subidas_pendientes ALTER COLUMN titular_id DROP NOT NULL;
ALTER TABLE subidas_pendientes DROP CONSTRAINT subidas_pendientes_destino_check;
ALTER TABLE subidas_pendientes ADD CONSTRAINT subidas_pendientes_destino_check CHECK (destino IN ('poliza', 'siniestro', 'importacion'));

-- Contactos para un siniestro y procedencia de cada dato guardado automáticamente:
-- {campo: {origen: 'documento', documento_id, pagina, cita} | {origen: 'internet', url, titulo, fecha}}
ALTER TABLE polizas ADD COLUMN siniestros_telefono text;
ALTER TABLE polizas ADD COLUMN siniestros_email text;
ALTER TABLE polizas ADD COLUMN siniestros_web text;
ALTER TABLE polizas ADD COLUMN origen_datos jsonb NOT NULL DEFAULT '{}';
ALTER TABLE polizas ADD COLUMN importacion_id uuid REFERENCES importaciones(id);

-- Contactos públicos de cada aseguradora por tipo de seguro, encontrados en internet (se reutilizan 180 días).
CREATE TABLE contactos_aseguradora (
  aseguradora_norm text NOT NULL,
  ramo_clave       text NOT NULL,
  aseguradora      text NOT NULL,
  datos            jsonb NOT NULL DEFAULT '{}',      -- {siniestros_telefono: {valor, url, titulo}, asistencia_telefono: …}
  error            text,
  buscado_en       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (aseguradora_norm, ramo_clave)
);
