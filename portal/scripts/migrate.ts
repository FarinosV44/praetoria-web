// Aplica las migraciones de db/migrations en orden, una transacción por archivo.
// Usa DATABASE_URL_ADMIN (rol administrador): nunca se usa en la aplicación.
// Opcional: PORTAL_APP_PASSWORD y PORTAL_AUTH_PASSWORD activan el inicio de sesión de esos roles.
import { readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import pg from 'pg';

const url = process.env.DATABASE_URL_ADMIN;
if (!url) { console.error('Falta DATABASE_URL_ADMIN'); process.exit(1); }
const dir = join(import.meta.dirname, '..', 'db', 'migrations');
const c = new pg.Client({ connectionString: url });
await c.connect();
await c.query(`create schema if not exists migraciones;
  create table if not exists migraciones.aplicadas (nombre text primary key, sha256 text not null, aplicada_at timestamptz not null default now())`);
const hechas = new Map((await c.query('select nombre, sha256 from migraciones.aplicadas')).rows.map((r) => [r.nombre, r.sha256]));
for (const f of readdirSync(dir).filter((n) => n.endsWith('.sql')).sort()) {
  const sql = readFileSync(join(dir, f), 'utf8');
  const h = createHash('sha256').update(sql).digest('hex');
  if (hechas.has(f)) {
    if (hechas.get(f) !== h) { console.error(`La migración ${f} ya aplicada ha cambiado. Crea una migración nueva.`); process.exit(1); }
    continue;
  }
  try {
    await c.query('begin');
    await c.query(sql);
    await c.query('insert into migraciones.aplicadas (nombre, sha256) values ($1, $2)', [f, h]);
    await c.query('commit');
    console.log(`aplicada ${f}`);
  } catch (e) {
    await c.query('rollback');
    console.error(`Error en ${f}:`, (e as Error).message);
    process.exit(1);
  }
}
for (const [rol, variable] of [['portal_app', 'PORTAL_APP_PASSWORD'], ['portal_auth', 'PORTAL_AUTH_PASSWORD']] as const) {
  const pw = process.env[variable];
  if (pw) {
    if (pw.length < 24) { console.error(`${variable} debe tener al menos 24 caracteres`); process.exit(1); }
    await c.query(`alter role ${rol} login password ${c.escapeLiteral(pw)}`);
    console.log(`rol ${rol}: inicio de sesión activado`);
  }
}
await c.end();
