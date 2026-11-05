import 'server-only';
import type pg from 'pg';
import { borrarObjeto } from './storage';

// Purga de la papelera (0016): documentos con más de 30 días eliminados. La ejecuta la tarea periódica sin actuar
// como ninguna persona (las funciones de la base de datos lo exigen). Primero se borra el archivo y, solo si el
// almacenamiento lo confirma, se marca como purgado (se borra su texto extraído y queda el registro).
export async function purgarPapelera(pool: pg.Pool, limite = 20) {
  const c = await pool.connect();
  let purgados = 0, fallos = 0;
  try {
    const lista = (await c.query('select id, storage_key from portal.papelera_por_purgar($1)', [limite])).rows as { id: string; storage_key: string }[];
    for (const d of lista) {
      try {
        await borrarObjeto(d.storage_key);
        await c.query('select portal.papelera_marcar_purgado($1)', [d.id]);
        purgados += 1;
      } catch { fallos += 1; }
    }
  } finally { c.release(); }
  return { purgados, fallos };
}
