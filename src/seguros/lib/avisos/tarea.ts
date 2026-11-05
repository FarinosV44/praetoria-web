import { q, pool } from '../db';
import { almacen } from '../almacen';
import { hoyMadrid } from '../fechas';
import { emitir, planificar, registrarEjecucion } from './motor';
import { procesarCola, canalesReales, type Canales } from './cola';

const CANDADO = 74_210_001; // pg_advisory_lock: una sola planificación a la vez aunque haya varias instancias
export const RETENCION_DOCUMENTOS_DIAS = 30;

/** Tarea periódica completa: planificar, emitir, enviar y limpiar. Segura ante repeticiones y ejecuciones paralelas. */
export async function tareaAvisos(ahora = new Date(), canales: Canales = canalesReales) {
  const client = await pool().connect();
  try {
    const { rows } = await client.query<{ ok: boolean }>('SELECT pg_try_advisory_lock($1) AS ok', [CANDADO]);
    if (!rows[0]?.ok) return { omitida: 'Otra ejecución en curso' };
    try {
      return await registrarEjecucion('avisos', async () => {
        const plan = await planificar(hoyMadrid(ahora));
        const emision = await emitir(ahora);
        const cola = await procesarCola(canales);
        const limpieza = await limpiar();
        return { ...plan, ...emision, ...cola, ...limpieza };
      });
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [CANDADO]);
    }
  } finally {
    client.release();
  }
}

export async function limpiar() {
  const sesiones = await q(`DELETE FROM sesiones WHERE caduca_en < now() OR vista_en < now() - interval '14 days' RETURNING 1`);
  await q(`DELETE FROM recuperaciones WHERE caduca_en < now() - interval '1 day'`);
  const purgar = await q<{ id: string; clave_almacen: string }>(
    `SELECT id, clave_almacen FROM documentos WHERE eliminado_en < now() - make_interval(days => $1) AND purgado_en IS NULL LIMIT 100`,
    [RETENCION_DOCUMENTOS_DIAS],
  );
  for (const d of purgar) {
    await almacen().borrar(d.clave_almacen);
    await q('UPDATE documentos SET purgado_en = now() WHERE id = $1', [d.id]);
  }
  const archivos = await q<{ id: string; clave_almacen: string }>(
    `SELECT id, clave_almacen FROM siniestro_archivos WHERE eliminado_en < now() - make_interval(days => $1) AND purgado_en IS NULL LIMIT 100`,
    [RETENCION_DOCUMENTOS_DIAS],
  );
  for (const a of archivos) {
    await almacen().borrar(a.clave_almacen);
    await q('UPDATE siniestro_archivos SET purgado_en = now() WHERE id = $1', [a.id]);
  }
  return { sesionesLimpiadas: sesiones.length, documentosPurgados: purgar.length + archivos.length };
}
