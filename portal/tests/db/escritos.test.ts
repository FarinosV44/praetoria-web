// Borradores de escritos (#94/#48): del asunto, con versiones inmutables, y solo con modelos utilizables.
// Rol real portal_app con RLS. Datos ficticios.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const admin = new pg.Client({ connectionString: process.env.DATABASE_URL_ADMIN });
const app = new pg.Pool({ connectionString: process.env.DATABASE_URL_APP, max: 4 });
const suf = randomUUID().slice(0, 8);
let SA = '', E = '', E2 = '', LEC = '', X = '', Y = '', HX = '', HY = '';
let VAPROBADA = '', VPENDIENTE = '', VPRIV_E2 = '', ESC = '', V1 = '', VY = '';

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
const modelo = async (uid: string, titulo: string, clase: string, texto: string) => como(uid, async (c) => {
  const m = (await c.query(`insert into portal.bib_modelos (titulo, clase, autor_id) values ($1, $2, $3) returning id`, [titulo, clase, uid])).rows[0].id as string;
  const v = (await c.query(`insert into portal.bib_versiones (modelo_id, version, origen, texto, subido_por) values ($1, 0, 'pegado', $2, $3) returning id`, [m, texto, uid])).rows[0].id as string;
  return { m, v };
});
const usable = async (uid: string, v: string) => (await como(uid, (c) => c.query('select portal.bib_usable($1) ok', [v]))).rows[0].ok as boolean;
const nuevaVersion = (uid: string, escrito: string, sid: string, texto: string) => como(uid, async (c) => (await c.query(
  `insert into portal.escrito_versiones (escrito_id, solicitud_id, version, texto, origen, autor_id) values ($1, $2, 99, $3, 'manual', $4) returning id, version, solicitud_id, autor_id`,
  [escrito, sid, texto, SA])).rows[0]);

before(async () => {
  await admin.connect();
  SA = (await admin.query(`insert into identidad."user" (name, email, "emailVerified") values ('Titular', $1, true) returning id`, [`sa.esc.${suf}@ejemplo.test`])).rows[0].id;
  await admin.query(`insert into portal.personal (user_id, rol, nombre_visible) values ($1, 'administrador', 'Titular Esc')`, [SA]);
  const emp = async (rol: string, n: string) => como(SA, async (c) => (await c.query(`select portal.crear_empleado($1, $2, $3) id`, [`${n}.esc.${suf}@ejemplo.test`, `Persona ${n}`, rol])).rows[0].id as string);
  E = await emp('abogado', 'e'); E2 = await emp('abogado', 'e2'); LEC = await emp('lectura', 'lec');
  const cx = await como(SA, async (c) => (await c.query(`select portal.crear_cliente($1, 'Cliente X', 'particular', null, null, null) id`, [`cx.esc.${suf}@ejemplo.test`])).rows[0].id);
  const cy = await como(SA, async (c) => (await c.query(`select portal.crear_cliente($1, 'Cliente Y', 'particular', null, null, null) id`, [`cy.esc.${suf}@ejemplo.test`])).rows[0].id);
  X = await como(SA, async (c) => (await c.query(`select portal.abrir_expediente($1, 'Divorcio ficticio X', null, null) id`, [cx])).rows[0].id);
  Y = await como(SA, async (c) => (await c.query(`select portal.abrir_expediente($1, 'Divorcio ficticio Y', null, null) id`, [cy])).rows[0].id);
  await como(SA, (c) => c.query(`select portal.asignar($1, $2, 'colaborador')`, [X, E]));
  await como(SA, (c) => c.query(`select portal.asignar($1, $2, 'colaborador')`, [X, LEC]));
  HX = await como(SA, async (c) => (await c.query(`insert into portal.ia_hilos (solicitud_id, titulo, creado_por) values ($1, 'Redacción', $2) returning id`, [X, SA])).rows[0].id);
  HY = await como(SA, async (c) => (await c.query(`insert into portal.ia_hilos (solicitud_id, titulo, creado_por) values ($1, 'Redacción Y', $2) returning id`, [Y, SA])).rows[0].id);
});
after(async () => { await app.end(); await admin.end(); });

test('solo se pueden usar modelos aprobados, en su versión vigente y visibles para quien redacta', async () => {
  const a = await modelo(E, 'Demanda de divorcio ficticia (maestro)', 'maestro', 'HECHOS. PRIMERO.- Texto ficticio de modelo.');
  await como(SA, (c) => c.query('select portal.bib_aprobar($1, true)', [a.m]));
  VAPROBADA = a.v;
  VPENDIENTE = (await modelo(E, 'Modelo ficticio pendiente', 'maestro', 'Texto ficticio pendiente.')).v;
  VPRIV_E2 = (await modelo(E2, 'Escrito privado ficticio de E2', 'caso_privado', 'Texto privado ficticio de otro asunto.')).v;
  assert.equal(await usable(E, VAPROBADA), true);
  assert.equal(await usable(LEC, VAPROBADA), true, 'lectura puede ver modelos aprobados (no redacta: lo impide el asunto)');
  assert.equal(await usable(E, VPENDIENTE), false, 'pendiente: no se usa ni siquiera por su autor');
  assert.equal(await usable(SA, VPENDIENTE), false, 'ni por la superadministración');
  assert.equal(await usable(E, VPRIV_E2), false, 'un escrito privado de otro abogado no es utilizable');
  assert.equal(await usable(SA, VPRIV_E2), false, 'ni siquiera por la superadministración: los privados nunca alimentan la redacción');
  // Una versión nueva devuelve el modelo a revisión: la aprobada deja de ser utilizable.
  const otra = await como(SA, async (c) => (await c.query(`insert into portal.bib_versiones (modelo_id, version, origen, texto, subido_por) values ($1, 0, 'pegado', 'v2 ficticia', $2) returning id`, [a.m, SA])).rows[0].id);
  assert.equal(await usable(E, VAPROBADA), false);
  assert.equal(await usable(E, otra), false, 'la nueva versión tampoco hasta que se apruebe');
  await como(SA, (c) => c.query('select portal.bib_aprobar($1, true)', [a.m]));
  assert.equal(await usable(E, otra), true);
  assert.equal(await usable(E, VAPROBADA), false, 'una aprobación no pasa a otra versión: solo vale la vigente');
  VAPROBADA = otra;
});

test('el escrito es del asunto: lo crea y lo ve quien tiene el asunto asignado; nadie más', async () => {
  ESC = await como(E, async (c) => (await c.query(`insert into portal.escritos (solicitud_id, titulo, hilo_id, creado_por) values ($1, 'Demanda ficticia', $2, $3) returning id, creado_por`, [X, HX, SA])).rows[0]).then((r) => {
    assert.equal(r.creado_por, E, 'el autor lo fija la base de datos'); return r.id as string;
  });
  await assert.rejects(como(E, (c) => c.query(`insert into portal.escritos (solicitud_id, titulo, creado_por) values ($1, 'Intruso', $2)`, [Y, E])), /row-level/, 'asunto no asignado');
  await assert.rejects(como(SA, (c) => c.query(`insert into portal.escritos (solicitud_id, titulo, hilo_id, creado_por) values ($1, 'Mezcla', $2, $3)`, [X, HY, SA])), /no es de ese asunto/);
  await assert.rejects(como(LEC, (c) => c.query(`insert into portal.escritos (solicitud_id, titulo, creado_por) values ($1, 'Lectura', $2)`, [X, LEC])), /row-level/, 'lectura no redacta');
  assert.equal((await como(LEC, (c) => c.query('select 1 from portal.escritos where id = $1', [ESC]))).rowCount, 1, 'lectura sí lo ve');
  assert.equal((await como(E2, (c) => c.query('select 1 from portal.escritos where id = $1', [ESC]))).rowCount, 0, 'otro abogado sin asignar no lo ve');
});

test('las versiones las numera el servidor, son del asunto del escrito y no se pueden cambiar ni borrar', async () => {
  const v1 = await nuevaVersion(E, ESC, X, 'BORRADOR ficticio v1');
  assert.equal(v1.version, 1); assert.equal(v1.autor_id, E);
  V1 = v1.id;
  const v2 = await nuevaVersion(E, ESC, X, 'BORRADOR ficticio v2');
  assert.equal(v2.version, 2);
  // Declarar otro asunto no cuela: el trigger fija el del escrito, y la RLS se comprueba sobre él.
  const v3 = await nuevaVersion(SA, ESC, Y, 'BORRADOR ficticio v3');
  assert.equal(v3.solicitud_id, X);
  await assert.rejects(nuevaVersion(E2, ESC, X, 'intruso'), /row-level/);
  await assert.rejects(nuevaVersion(LEC, ESC, X, 'lectura'), /row-level/);
  await assert.rejects(como(E, (c) => c.query(`update portal.escrito_versiones set texto = 'reescrito' where id = $1`, [V1])), /permission denied/);
  await assert.rejects(como(SA, (c) => c.query(`delete from portal.escrito_versiones where id = $1`, [V1])), /permission denied/);
  assert.equal((await admin.query('select texto from portal.escrito_versiones where id = $1', [V1])).rows[0].texto, 'BORRADOR ficticio v1', 'la v1 sigue intacta');
  // Una versión no puede enlazar una respuesta de IA de otro asunto.
  const my = await como(SA, async (c) => (await c.query(`insert into portal.ia_mensajes (hilo_id, solicitud_id, rol, texto, autor_id) values ($1, $2, 'asistente', 'respuesta Y', $3) returning id`, [HY, Y, SA])).rows[0].id);
  await assert.rejects(como(SA, (c) => c.query(`insert into portal.escrito_versiones (escrito_id, solicitud_id, version, texto, origen, mensaje_id, autor_id) values ($1, $2, 0, 'x', 'ia', $3, $4)`, [ESC, X, my, SA])), /no es de ese asunto/);
});

test('el uso de un modelo solo se registra si es utilizable, para quien redacta y para una versión del mismo asunto', async () => {
  const uso = (uid: string, version: string, sid: string, ev: string | null, user = uid) => como(uid, (c) => c.query(
    `insert into portal.bib_usos (version_id, solicitud_id, user_id, escrito_version_id) values ($1, $2, $3, $4)`, [version, sid, user, ev]));
  await uso(E, VAPROBADA, X, V1);
  await assert.rejects(uso(E, VPENDIENTE, X, V1), /row-level/, 'modelo no aprobado');
  await assert.rejects(uso(SA, VPRIV_E2, X, V1), /row-level/, 'escrito privado');
  await assert.rejects(uso(E, VAPROBADA, X, V1, SA), /row-level/, 'no se registra en nombre de otro');
  const escY = await como(SA, async (c) => (await c.query(`insert into portal.escritos (solicitud_id, titulo, creado_por) values ($1, 'Escrito Y', $2) returning id`, [Y, SA])).rows[0].id);
  VY = (await nuevaVersion(SA, escY, Y, 'BORRADOR Y')).id;
  await assert.rejects(uso(SA, VAPROBADA, X, VY), /row-level/, 'versión de escrito de otro asunto');
  assert.equal((await como(E, (c) => c.query('select 1 from portal.bib_usos where solicitud_id = $1', [X]))).rowCount, 1);
  assert.equal((await como(E2, (c) => c.query('select 1 from portal.bib_usos where solicitud_id = $1', [X]))).rowCount, 0);
});
