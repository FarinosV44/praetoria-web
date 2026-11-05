-- 0004 · Subidas directas al almacén privado (despliegues sin servidor, como Vercel, que limitan el tamaño
-- de las peticiones). El servidor emite una autorización de subida de un solo uso; el navegador sube el
-- archivo al almacén y después el servidor lo comprueba y lo registra. Solo se registra lo que se emitió
-- para ese usuario y ese destino.
CREATE TABLE subidas_pendientes (
  clave_almacen text PRIMARY KEY,
  usuario_id    uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  titular_id    uuid NOT NULL REFERENCES titulares(id),
  destino       text NOT NULL CHECK (destino IN ('poliza', 'siniestro')),
  destino_id    uuid NOT NULL,
  nombre        text NOT NULL,
  creada_en     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX subidas_pendientes_creada ON subidas_pendientes (creada_en);
