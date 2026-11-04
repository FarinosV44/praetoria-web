// Plazos desde el expediente (#51): origen documental del mismo asunto, verificación expresa y auditoría de cambios.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const admin = new pg.Client({ connectionString: process.env.DATABASE_URL_ADMIN });
const app = new pg.Pool({ connectionString: process.env.DATABASE_URL_APP, max: 4 });
const suf = randomUUID().slice(0, 8);
let SA = '', E = '', X = '', Y = '', DX = '', DY = '';

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
const doc = (sid: string, cli: string) => { const id = randomUUID(); return como(SA, async (c) => (await c.query(`insert into portal.documentos (id, solicitud_id, cliente_id, version, storage_key, nombre_original, mime, tamano, sha256, subido_por)
  values ($1, $2, $3, 0, $4, 'notificacion.pdf', 'application/pdf', 100, $5, $6) returning id`, [id, sid, cli, `${sid}/${id}`, 'a'.repeat(64), SA])).rows[0].id as string); };

before(async () => {
  await admin.connect();
  SA = (await admin.query(`insert into identidad."user" (name, email, "emailVerified") values ('Titular', $1, true) returning id`, [`sa.p.${suf}@ejemplo.test`])).rows[0].id;
  await admin.query(`insert into portal.personal (user_id, rol, nombre_visible) values ($1, 'administrador', 'Titular')`, [SA]);
  E = await como(SA, async (c) => (await c.query(`select portal.crear_empleado($1, 'Elena Plazos', 'abogado') id`, [`e.p.${suf}@ejemplo.test`])).rows[0].id);
  const cx = await como(SA, async (c) => (await c.query(`select portal.crear_cliente($1, 'Cliente X', 'particular', null, null, null) id`, [`cx.${suf}@ejemplo.test`])).rows[0].id);
  const cy = await como(SA, async (c) => (await c.query(`select portal.crear_cliente($1, 'Cliente Y', 'particular', null, null, null) id`, [`cy.${suf}@ejemplo.test`])).rows[0].id);
  X = await como(SA, async (c) => (await c.query(`select portal.abrir_expediente($1, 'Asunto X', null, null) id`, [cx])).rows[0].id);
  Y = await como(SA, async (c) => (await c.query(`select portal.abrir_expediente($1, 'Asunto Y', null, null) id`, [cy])).rows[0].id);
  DX = await doc(X, cx); DY = await doc(Y, cy);
  await como(SA, (c) => c.query(`select portal.asignar($1, $2, 'colaborador')`, [X, E]));
});
after(async () => { await app.end(); await admin.end(); });

test('el documento de origen de un plazo tiene que ser del mismo asunto', async () => {
  await assert.rejects(como(SA, (c) => c.query(`insert into portal.agenda_eventos (titulo, tipo, inicio, solicitud_id, documento_id) values ('Contestar', 'plazo', now() + interval '10 days', $1, $2)`, [X, DY])), /mismo asunto/);
  const r = await como(E, async (c) => (await c.query(`insert into portal.agenda_eventos (titulo, tipo, inicio, solicitud_id, documento_id, avisos_min) values ('Contestar demanda', 'plazo', now() + interval '10 days', $1, $2, '{10080,1440,60}') returning id, plazo_verificado_at`, [X, DX])).rows[0]);
  assert.equal(r.plazo_verificado_at, null, 'un plazo nace sin verificar');
  const avisos = await admin.query(`select antelacion_min from portal.agenda_avisos where evento_id = $1 and estado = 'programado' order by 1`, [r.id]);
  assert.deepEqual(avisos.rows.map((a) => a.antelacion_min), [60, 1440, 10080]);
});

test('verificar y cambiar la fecha queda en la cronología; cambiarla anula la verificación y los avisos viejos', async () => {
  const id = (await admin.query(`select id from portal.agenda_eventos where solicitud_id = $1 and titulo = 'Contestar demanda'`, [X])).rows[0].id;
  const v = await como(E, async (c) => (await c.query(`update portal.agenda_eventos set plazo_verificado_at = now() where id = $1 returning plazo_verificado_por`, [id])).rows[0]);
  assert.equal(v.plazo_verificado_por, E);
  const antes = (await admin.query(`select count(*)::int n from portal.agenda_avisos where evento_id = $1 and estado = 'programado'`, [id])).rows[0].n;
  // Lo reprograma otra persona: se anula la verificación, se replanifican avisos y se avisa al responsable
  await como(SA, (c) => c.query(`update portal.agenda_eventos set inicio = inicio + interval '2 days' where id = $1`, [id]));
  const t = (await admin.query('select plazo_verificado_at, version from portal.agenda_eventos where id = $1', [id])).rows[0];
  assert.equal(t.plazo_verificado_at, null);
  const av = (await admin.query(`select estado, count(*)::int n from portal.agenda_avisos where evento_id = $1 group by 1`, [id])).rows;
  assert.equal(av.find((a) => a.estado === 'programado')?.n, antes, 'mismos avisos, ahora para la nueva fecha');
  assert.ok((av.find((a) => a.estado === 'cancelado')?.n ?? 0) >= antes, 'los avisos de la fecha vieja quedan cancelados');
  const ev = (await como(E, (c) => c.query(`select tipo, detalle from portal.eventos where solicitud_id = $1 and tipo in ('plazo_verificado', 'tarea_reprogramada') order by id`, [X]))).rows;
  assert.deepEqual(ev.map((e) => e.tipo), ['plazo_verificado', 'tarea_reprogramada']);
  assert.equal(ev[1].detalle.verificacion_anulada, true);
  // Nada de esto llega al cliente
  const cliente = (await admin.query('select cliente_id from portal.solicitudes where id = $1', [X])).rows[0].cliente_id;
  assert.equal((await como(cliente, (c) => c.query(`select 1 from portal.eventos where solicitud_id = $1 and tipo in ('plazo_verificado', 'tarea_reprogramada')`, [X]))).rowCount, 0);
  // Y quien no tiene el asunto no ve el plazo
  assert.equal((await como(E, (c) => c.query(`select 1 from portal.agenda_eventos where solicitud_id = $1`, [Y]))).rowCount, 0);
});
