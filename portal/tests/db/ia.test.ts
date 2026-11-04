// Asistente de IA (#48): hilos, respuestas y texto extraído quedan dentro del asunto y de su asignación.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const admin = new pg.Client({ connectionString: process.env.DATABASE_URL_ADMIN });
const app = new pg.Pool({ connectionString: process.env.DATABASE_URL_APP, max: 4 });
const suf = randomUUID().slice(0, 8);
let SA = '', E = '', CX = '', X = '', Y = '', DY = '';

async function como<T>(uid: string, fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await app.connect();
  try {
    await c.query('begin');
    await c.query("select set_config('app.user_id', $1, true)", [uid]);
    const r = await fn(c);
    await c.query('commit');
    return r;
  } catch (e) { await c.query('rollback'); throw e; } finally { c.release(); }
}

before(async () => {
  await admin.connect();
  SA = (await admin.query(`insert into identidad."user" (name, email, "emailVerified") values ('Titular', $1, true) returning id`, [`sa.ia.${suf}@ejemplo.test`])).rows[0].id;
  await admin.query(`insert into portal.personal (user_id, rol, nombre_visible) values ($1, 'administrador', 'Titular IA')`, [SA]);
  E = await como(SA, async (c) => (await c.query(`select portal.crear_empleado($1, 'Empleado IA', 'abogado') id`, [`e.ia.${suf}@ejemplo.test`])).rows[0].id);
  CX = await como(SA, async (c) => (await c.query(`select portal.crear_cliente($1, 'Cliente X', 'particular', null, null, null) id`, [`cx.ia.${suf}@ejemplo.test`])).rows[0].id);
  const cy = await como(SA, async (c) => (await c.query(`select portal.crear_cliente($1, 'Cliente Y', 'particular', null, null, null) id`, [`cy.ia.${suf}@ejemplo.test`])).rows[0].id);
  X = await como(SA, async (c) => (await c.query(`select portal.abrir_expediente($1, 'Asunto X ficticio', null, null) id`, [CX])).rows[0].id);
  Y = await como(SA, async (c) => (await c.query(`select portal.abrir_expediente($1, 'Asunto Y ficticio', null, null) id`, [cy])).rows[0].id);
  const id = randomUUID();
  DY = await como(SA, async (c) => (await c.query(`insert into portal.documentos (id, solicitud_id, cliente_id, version, storage_key, nombre_original, mime, tamano, sha256, subido_por)
    values ($1, $2, $3, 0, $4, 'y.pdf', 'application/pdf', 100, $5, $6) returning id`, [id, Y, cy, `${Y}/${id}`, 'b'.repeat(64), SA])).rows[0].id);
  await como(SA, (c) => c.query(`select portal.asignar($1, $2, 'colaborador')`, [X, E]));
});
after(async () => { await app.end(); await admin.end(); });

test('las conversaciones con la IA son del asunto: las ve quien lo tiene asignado, nunca el cliente ni otro empleado', async () => {
  const h = await como(E, async (c) => (await c.query(`insert into portal.ia_hilos (solicitud_id, titulo, creado_por) values ($1, 'Resumen', $2) returning id, creado_por`, [X, SA])).rows[0]);
  assert.equal(h.creado_por, E, 'el autor lo fija la base de datos');
  await como(E, (c) => c.query(`insert into portal.ia_mensajes (hilo_id, solicitud_id, rol, texto, autor_id) values ($1, $2, 'usuario', 'Resúmeme', $3)`, [h.id, X, SA]));
  // Un mensaje no puede colgar de un hilo de otro asunto
  await assert.rejects(como(SA, (c) => c.query(`insert into portal.ia_mensajes (hilo_id, solicitud_id, rol, texto, autor_id) values ($1, $2, 'usuario', 'x', $3)`, [h.id, Y, SA])), /no pertenece/);
  assert.equal((await como(SA, (c) => c.query('select 1 from portal.ia_mensajes where hilo_id = $1', [h.id]))).rowCount, 1);
  assert.equal((await como(CX, (c) => c.query('select 1 from portal.ia_hilos where solicitud_id = $1', [X]))).rowCount, 0, 'el cliente no ve los hilos internos');
  await como(SA, (c) => c.query('select portal.retirar_asignacion($1, $2)', [X, E]));
  assert.equal((await como(E, (c) => c.query('select 1 from portal.ia_mensajes where solicitud_id = $1', [X]))).rowCount, 0, 'al retirar la asignación, nada');
  await assert.rejects(como(E, (c) => c.query(`insert into portal.ia_hilos (solicitud_id, titulo, creado_por) values ($1, 'x', $2)`, [X, E])), /row-level/);
});

test('el texto extraído solo se guarda para un documento de ese mismo asunto y solo lo lee quien ve el asunto', async () => {
  await assert.rejects(como(SA, (c) => c.query(`insert into portal.documentos_texto (documento_id, solicitud_id, estado) values ($1, $2, 'ok')`, [DY, X])), /row-level/);
  await como(SA, (c) => c.query(`insert into portal.documentos_texto (documento_id, solicitud_id, estado, paginas) values ($1, $2, 'ok', '["Texto ficticio de Y"]')`, [DY, Y]));
  assert.equal((await como(E, (c) => c.query('select 1 from portal.documentos_texto where documento_id = $1', [DY]))).rowCount, 0);
  assert.equal((await como(CX, (c) => c.query('select 1 from portal.documentos_texto'))).rowCount, 0);
});
