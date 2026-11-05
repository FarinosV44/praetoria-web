import { q, q1, type Db, pool } from '../db';

/**
 * Limitador basado en la base de datos (funciona con varias instancias).
 * `clave` identifica el recurso: «acceso:email», «acceso-ip:1.2.3.4», «subida:usuario»…
 */
export async function superaLimite(clave: string, maximo: number, ventanaMin: number, db: Db = pool()) {
  const r = await q1<{ n: string }>(
    `SELECT count(*) AS n FROM limites WHERE clave = $1 AND NOT exito AND en > now() - make_interval(mins => $2)`,
    [clave, ventanaMin], db,
  );
  return Number(r?.n ?? 0) >= maximo;
}

export async function registrarIntento(clave: string, exito: boolean, db: Db = pool()) {
  await q('INSERT INTO limites (clave, exito) VALUES ($1, $2)', [clave, exito], db);
  // Limpieza ocasional de registros antiguos.
  if (Math.random() < 0.02) await q(`DELETE FROM limites WHERE en < now() - interval '2 days'`, [], db);
}

/** Tras un acceso correcto se olvidan los fallos de esa cuenta. */
export async function limpiarFallos(clave: string, db: Db = pool()) {
  await q('DELETE FROM limites WHERE clave = $1 AND NOT exito', [clave], db);
}
