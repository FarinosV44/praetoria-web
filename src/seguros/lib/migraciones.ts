import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { Pool } from 'pg';

/** Aplica en orden las migraciones SQL pendientes de seguros/db/migrations. Cada una en su transacción. */
export async function migrar(pool: Pool, dir = path.join(process.cwd(), 'seguros/db/migrations')) {
  await pool.query(`CREATE TABLE IF NOT EXISTS migraciones (nombre text PRIMARY KEY, aplicada_en timestamptz NOT NULL DEFAULT now())`);
  const hechas = new Set((await pool.query<{ nombre: string }>('SELECT nombre FROM migraciones')).rows.map((r) => r.nombre));
  const aplicadas: string[] = [];
  for (const archivo of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    if (hechas.has(archivo)) continue;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(readFileSync(path.join(dir, archivo), 'utf8'));
      await client.query('INSERT INTO migraciones (nombre) VALUES ($1)', [archivo]);
      await client.query('COMMIT');
      aplicadas.push(archivo);
    } catch (e) {
      await client.query('ROLLBACK');
      throw new Error(`Error en la migración ${archivo}: ${(e as Error).message}`);
    } finally {
      client.release();
    }
  }
  return aplicadas;
}
