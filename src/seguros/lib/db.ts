import pg, { Pool, type PoolClient, type QueryResultRow } from 'pg';

// Base de datos del gestor de seguros: esquema «seguros» del mismo proyecto, con su propio rol
// (seguros_app, search_path = seguros). Pool propia: nunca comparte conexión ni permisos con el portal.
const global_ = globalThis as unknown as { __poolSeguros?: Pool };

// DATE (1082) como texto 'YYYY-MM-DD' y NUMERIC (1700) como texto, SOLO en esta pool: los tipos globales de
// «pg» los usa también el portal y no se tocan.
const crudo = (v: string) => v;
export const tiposSeguros = {
  getTypeParser: ((oid: number, formato?: 'text' | 'binary') =>
    oid === 1082 || oid === 1700 ? crudo : pg.types.getTypeParser(oid, formato)) as typeof pg.types.getTypeParser,
};

/** ¿Está configurado el módulo de seguros en este servidor? */
export const segurosConfigurado = () => !!process.env.DATABASE_URL_SEGUROS;

export function pool(): Pool {
  if (!global_.__poolSeguros) {
    const url = process.env.DATABASE_URL_SEGUROS;
    if (!url) throw new Error('Falta DATABASE_URL_SEGUROS (ver portal/.env.example).');
    global_.__poolSeguros = new Pool({ connectionString: url, max: Number(process.env.SEGUROS_DB_POOL_MAX ?? 5), idleTimeoutMillis: 10_000, application_name: 'seguros-app', types: tiposSeguros });
  }
  return global_.__poolSeguros;
}

export type Db = Pick<PoolClient, 'query'>;

export async function q<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = [], db: Db = pool()) {
  const r = await db.query<T>(sql, params);
  return r.rows;
}

export async function q1<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = [], db: Db = pool()) {
  const r = await db.query<T>(sql, params);
  return r.rows[0] ?? null;
}

export async function transaccion<T>(fn: (db: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query('BEGIN');
    const r = await fn(client);
    await client.query('COMMIT');
    return r;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
