// Papelera de documentos (30 días) y cierre de expedientes (0016). Rol real portal_app con RLS. Datos ficticios.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const admin = new pg.Client({ connectionString: process.env.DATABASE_URL_ADMIN });
const app = new pg.Pool({ connectionString: process.env.DATABASE_URL_APP, max: 4 });
const suf = randomUUID().slice(0, 8);
let SA = '', E = '', E2 = '', LEC = '', CX = '', X = '', D = '';

async function como<T>(uid: string | null, fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await app.connect();
  try {
    await c.query('begin');
    if (uid) await c.query("select set_config('app.user_id', $1, true)", [uid]);
    const r = await fn(c);
    await c.query('commit');
    return r;
  } catch (e) { await c.query('rollback'); throw e; } finally { c.release(); }
}
const ve = async (uid: string, id: string) => (await como(uid, (c) => c.query('select 1 from portal.documentos where id = $1', [id]))).rowCount;
const eventos = async (tipo: string) => (await admin.query('select visible_cliente, actor_id from portal.eventos where solicitud_id = $1 and tipo = $2', [X, tipo])).rows;

before(async () => {
  await admin.connect();
  SA = (await admin.query(`insert into identidad."user" (name, email, "emailVerified") values ('Titular', $1, true) returning id`, [`sa.pap.${suf}@ejemplo.test`])).rows[0].id;
  await admin.query(`insert into portal.personal (user_id, rol, nombre_visible) values ($1, 'administrador', 'Titular Pap')`, [SA]);
  const emp = async (rol: string, n: string) => como(SA, async (c) => (await c.query(`select portal.crear_empleado($1, $2, $3) id`, [`${n}.pap.${suf}@ejemplo.test`, `Persona ${n}`, rol])).rows[0].id as string);
  E = await emp('abogado', 'e'); E2 = await emp('abogado', 'e2'); LEC = await emp('lectura', 'lec');
  CX = await como(SA, async (c) => (await c.query(`select portal.crear_cliente($1, 'Cliente X', 'particular', null, null, null) id`, [`cx.pap.${suf}@ejemplo.test`])).rows[0].id);
  X = await como(SA, async (c) => (await c.query(`select portal.abrir_expediente($1, 'Asunto ficticio papelera', null, null) id`, [CX])).rows[0].id);
  await como(SA, (c) => c.query(`select portal.asignar($1, $2, 'colaborador')`, [X, E]));
  await como(SA, (c) => c.query(`select portal.asignar($1, $2, 'colaborador')`, [X, LEC]));
  const id = randomUUID();
  D = await como(SA, async (c) => (await c.query(`insert into portal.documentos (id, solicitud_id, cliente_id, version, storage_key, nombre_original, mime, tamano, sha256, subido_por)
    values ($1, $2, $3, 0, $4, 'ficticio.pdf', 'application/pdf', 100, $5, $6) returning id`, [id, X, CX, `${X}/${id}`, 'c'.repeat(64), SA])).rows[0].id);
  await como(SA, (c) => c.query('update portal.documentos set visible_cliente = true where id = $1', [D]));
  await como(SA, (c) => c.query(`insert into portal.documentos_texto (documento_id, solicitud_id, estado, paginas) values ($1, $2, 'ok', '["texto ficticio"]')`, [D, X]));
});
after(async () => { await app.end(); await admin.end(); });

test('eliminan solo quienes escriben en el asunto; nunca el cliente, lectura ni otro abogado', async () => {
  for (const u of [LEC, E2, CX]) await assert.rejects(como(u, (c) => c.query('select portal.documento_eliminar($1, null)', [D])), /Sin permiso/);
  await assert.rejects(como(E, (c) => c.query(`update portal.documentos set eliminado_at = now() where id = $1`, [D])), /permission denied/, 'no se marca a mano');
  assert.equal(await ve(CX, D), 1);
  await como(E, (c) => c.query(`select portal.documento_eliminar($1, 'Subido por error (ficticio)')`, [D]));
  for (const u of [SA, E, LEC, CX]) assert.equal(await ve(u, D), 0, 'en la papelera no lo ve nadie por la vía normal');
  assert.equal((await como(E, (c) => c.query('select count(*)::int n from portal.documentos_texto t join portal.documentos d on d.id = t.documento_id where t.documento_id = $1', [D]))).rows[0].n, 0, 'ni la IA');
  const p = (await como(E, (c) => c.query('select * from portal.papelera($1)', [X]))).rows;
  assert.equal(p.length, 1); assert.equal(p[0].eliminado_por, 'Persona e'); assert.equal(p[0].motivo, 'Subido por error (ficticio)');
  assert.equal((await como(E2, (c) => c.query('select * from portal.papelera($1)', [X]))).rowCount, 0, 'otro abogado no ve la papelera');
  assert.equal((await como(CX, (c) => c.query('select * from portal.papelera($1)', [X]))).rowCount, 0, 'el cliente tampoco');
  const ev = await eventos('documento_eliminado');
  assert.equal(ev.length, 1); assert.equal(ev[0].visible_cliente, false); assert.equal(ev[0].actor_id, E);
  await assert.rejects(como(E, (c) => c.query('select portal.documento_eliminar($1, null)', [D])), /Sin permiso/, 'no se elimina dos veces');
});

test('se restaura dentro de los 30 días y vuelve a verse', async () => {
  await assert.rejects(como(LEC, (c) => c.query('select portal.documento_restaurar($1)', [D])), /Sin permiso/);
  await como(E, (c) => c.query('select portal.documento_restaurar($1)', [D]));
  assert.equal(await ve(CX, D), 1);
  assert.equal((await eventos('documento_restaurado')).length, 1);
});

test('pasados 30 días solo la tarea periódica lo purga: borra el texto y ya no se puede restaurar', async () => {
  await como(E, (c) => c.query('select portal.documento_eliminar($1, null)', [D]));
  assert.equal((await como(null, (c) => c.query('select * from portal.papelera_por_purgar(10) where id = $1', [D]))).rowCount, 0, 'antes de 30 días, no');
  await admin.query(`update portal.documentos set eliminado_at = now() - interval '31 days' where id = $1`, [D]);
  await assert.rejects(como(E, (c) => c.query('select portal.documento_restaurar($1)', [D])), /más de 30 días/);
  assert.equal((await como(SA, (c) => c.query('select * from portal.papelera_por_purgar(10)'))).rowCount, 0, 'una persona no obtiene la lista de purga');
  await assert.rejects(como(SA, (c) => c.query('select portal.papelera_marcar_purgado($1)', [D])), /Sin permiso/);
  const lista = (await como(null, (c) => c.query('select * from portal.papelera_por_purgar(10) where id = $1', [D]))).rows;
  assert.equal(lista.length, 1); assert.equal(lista[0].storage_key, `${X}/${D}`);
  await como(null, (c) => c.query('select portal.papelera_marcar_purgado($1)', [D]));
  const r = (await admin.query('select purgado_at, (select count(*)::int from portal.documentos_texto where documento_id = $1) textos from portal.documentos where id = $1', [D])).rows[0];
  assert.ok(r.purgado_at); assert.equal(r.textos, 0);
  assert.equal((await eventos('documento_purgado')).length, 1);
  assert.equal((await como(E, (c) => c.query('select purgado_at from portal.papelera($1)', [X]))).rows[0].purgado_at !== null, true, 'queda el registro');
});

test('cerrar y reabrir el expediente: quien escribe en el asunto, con rastro en la cronología', async () => {
  await assert.rejects(como(LEC, (c) => c.query('select portal.expediente_estado($1, true)', [X])), /Sin permiso/);
  await assert.rejects(como(E2, (c) => c.query('select portal.expediente_estado($1, true)', [X])), /Sin permiso/);
  await como(E, (c) => c.query('select portal.expediente_estado($1, true)', [X]));
  let e = (await admin.query('select estado, cerrado_at from portal.expedientes where solicitud_id = $1', [X])).rows[0];
  assert.equal(e.estado, 'cerrado'); assert.ok(e.cerrado_at);
  await como(E, (c) => c.query('select portal.expediente_estado($1, false)', [X]));
  e = (await admin.query('select estado, cerrado_at from portal.expedientes where solicitud_id = $1', [X])).rows[0];
  assert.equal(e.estado, 'activo'); assert.equal(e.cerrado_at, null);
  assert.equal((await eventos('expediente_cerrado')).length, 1);
  assert.equal((await eventos('expediente_reabierto')).length, 1);
});
