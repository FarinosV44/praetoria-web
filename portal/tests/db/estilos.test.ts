// Perfiles de estilo (#97): los usa el equipo jurídico, los configura la superadministración y se versionan.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const admin = new pg.Client({ connectionString: process.env.DATABASE_URL_ADMIN });
const app = new pg.Pool({ connectionString: process.env.DATABASE_URL_APP, max: 4 });
const suf = randomUUID().slice(0, 8);
let SA = '', E = '', FAC = '', CLI = '';
async function como<T>(uid: string, fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await app.connect();
  try { await c.query('begin'); await c.query("select set_config('app.user_id', $1, true)", [uid]); const r = await fn(c); await c.query('commit'); return r; }
  catch (e) { await c.query('rollback'); throw e; } finally { c.release(); }
}
before(async () => {
  await admin.connect();
  SA = (await admin.query(`insert into identidad."user" (name, email, "emailVerified") values ('T', $1, true) returning id`, [`sa.est.${suf}@ejemplo.test`])).rows[0].id;
  await admin.query(`insert into portal.personal (user_id, rol, nombre_visible) values ($1, 'administrador', 'Titular Estilos')`, [SA]);
  E = await como(SA, async (c) => (await c.query(`select portal.crear_empleado($1, 'Abogada Estilos', 'abogado') id`, [`e.est.${suf}@ejemplo.test`])).rows[0].id);
  FAC = await como(SA, async (c) => (await c.query(`select portal.crear_empleado($1, 'Facturación Estilos', 'facturacion') id`, [`f.est.${suf}@ejemplo.test`])).rows[0].id);
  CLI = await como(SA, async (c) => (await c.query(`select portal.crear_cliente($1, 'Cliente Estilos', 'particular', null, null, null) id`, [`c.est.${suf}@ejemplo.test`])).rows[0].id);
});
after(async () => { await app.end(); await admin.end(); });

test('solo la superadministración crea y versiona estilos; el equipo jurídico los usa; ni facturación ni clientes', async () => {
  const id = await como(SA, async (c) => (await c.query(`insert into portal.bib_estilos (nombre, destino, creado_por) values ($1, 'judicial', $2) returning id, creado_por`, [`Judicial ficticio ${suf}`, E])).rows[0]).then((r) => { assert.equal(r.creado_por, SA); return r.id; });
  for (const cfg of [{ fuente: 'Arial' }, { fuente: 'Times New Roman' }]) await como(SA, (c) => c.query(`insert into portal.bib_estilo_versiones (estilo_id, version, config, creado_por) values ($1, 0, $2, $3)`, [id, JSON.stringify(cfg), E]));
  assert.deepEqual((await admin.query('select version from portal.bib_estilo_versiones where estilo_id = $1 order by version', [id])).rows.map((r) => r.version), [1, 2]);
  assert.equal((await como(E, (c) => c.query('select 1 from portal.bib_estilo_versiones where estilo_id = $1', [id]))).rowCount, 2);
  await assert.rejects(como(E, (c) => c.query(`insert into portal.bib_estilo_versiones (estilo_id, version, config, creado_por) values ($1, 0, '{}', $2)`, [id, E])), /row-level/);
  assert.equal((await como(E, (c) => c.query(`update portal.bib_estilos set nombre = 'x' where id = $1`, [id]))).rowCount, 0);
  for (const otro of [FAC, CLI]) assert.equal((await como(otro, (c) => c.query('select 1 from portal.bib_estilos where id = $1', [id]))).rowCount, 0);
  await assert.rejects(admin.query(`set role portal_app; update portal.bib_estilo_versiones set config = '{}'`), /permission denied/);
  await admin.query('reset role');
});
