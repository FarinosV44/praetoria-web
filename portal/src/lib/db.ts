import 'server-only';
import { Pool, type PoolClient } from 'pg';
import { env } from './env';

// Dos pools con roles distintos:
//  - app: rol portal_app, sujeto a Row Level Security. Cada operación abre una transacción y fija
//    app.user_id; las políticas de la base de datos deciden qué filas ve o modifica.
//  - auth: rol portal_auth, solo para la librería de autenticación (esquema identidad).
const g = globalThis as unknown as { __poolApp?: Pool; __poolAuth?: Pool };

export function poolApp(): Pool {
  g.__poolApp ??= new Pool({ connectionString: env.dbApp, max: 10, application_name: 'portal-app' });
  return g.__poolApp;
}

export function poolAuth(): Pool {
  g.__poolAuth ??= new Pool({
    connectionString: env.dbAuth,
    max: 5,
    application_name: 'portal-auth',
    options: '-c search_path=identidad',
  });
  return g.__poolAuth;
}

export type Tx = PoolClient;

/** Ejecuta fn dentro de una transacción con la identidad del usuario fijada para RLS. */
export async function comoUsuario<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const c = await poolApp().connect();
  try {
    await c.query('begin');
    await c.query("select set_config('app.user_id', $1, true)", [userId]);
    const r = await fn(c);
    await c.query('commit');
    return r;
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}
