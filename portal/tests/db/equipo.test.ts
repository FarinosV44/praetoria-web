// Equipo y asignaciones (#81): cada profesional ve solo los asuntos que tiene asignados.
// Rol real portal_app con RLS. Datos ficticios.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const admin = new pg.Client({ connectionString: process.env.DATABASE_URL_ADMIN });
const app = new pg.Pool({ connectionString: process.env.DATABASE_URL_APP, max: 4 });
const suf = randomUUID().slice(0, 8);
let SA = '', E1 = '', E2 = '', LEC = '', C = '', D = '', X = '', Y = '', DOCX = '', NUEVA = '';

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
const uno = async (uid: string, sql: string, p: unknown[] = []) => (await como(uid, (c) => c.query(sql, p))).rows[0];
const filas = async (uid: string, sql: string, p: unknown[] = []) => (await como(uid, (c) => c.query(sql, p))).rowCount;

// Todo lo que un profesional podría consultar de un asunto, por identificador directo.
async function alcance(uid: string, sid: string, doc: string, cliente: string) {
  return {
    solicitud: await filas(uid, 'select 1 from portal.solicitudes where id = $1', [sid]),
    expediente: await filas(uid, 'select 1 from portal.expedientes where solicitud_id = $1', [sid]),
    documento: await filas(uid, 'select 1 from portal.documentos where id = $1', [doc]),
    notas: await filas(uid, 'select 1 from portal.notas_internas where solicitud_id = $1', [sid]),
    mensajes: await filas(uid, 'select 1 from portal.mensajes where solicitud_id = $1', [sid]),
    eventos: await filas(uid, 'select 1 from portal.eventos where solicitud_id = $1', [sid]),
    tareas: await filas(uid, 'select 1 from portal.agenda_eventos where solicitud_id = $1', [sid]),
    perfil: await filas(uid, 'select 1 from portal.perfiles where user_id = $1', [cliente]),
    cuenta: await filas(uid, 'select 1 from identidad."user" where id = $1', [cliente]),
  };
}
const nada = { solicitud: 0, expediente: 0, documento: 0, notas: 0, mensajes: 0, eventos: 0, tareas: 0, perfil: 0, cuenta: 0 };

before(async () => {
  await admin.connect();
  SA = (await admin.query(`insert into identidad."user" (name, email, "emailVerified") values ('Titular', $1, true) returning id`, [`sa.${suf}@ejemplo.test`])).rows[0].id;
  await admin.query(`insert into portal.personal (user_id, rol, nombre_visible) values ($1, 'administrador', 'Titular')`, [SA]);
});
after(async () => { await app.end(); await admin.end(); });

test('solo la superadministración da de alta empleados', async () => {
  E1 = (await uno(SA, `select portal.crear_empleado($1, 'Elena Ficticia', 'abogado') id`, [`e1.${suf}@ejemplo.test`])).id;
  E2 = (await uno(SA, `select portal.crear_empleado($1, 'Esteban Ficticio', 'abogado') id`, [`e2.${suf}@ejemplo.test`])).id;
  LEC = (await uno(SA, `select portal.crear_empleado($1, 'Lucía Lectura', 'lectura') id`, [`lec.${suf}@ejemplo.test`])).id;
  await assert.rejects(como(E1, (c) => c.query(`select portal.crear_empleado($1, 'Intruso', 'administrador')`, [`x.${suf}@ejemplo.test`])), /Sin permiso/);
  await assert.rejects(como(SA, (c) => c.query(`select portal.crear_empleado($1, 'Raro', 'cliente')`, [`r.${suf}@ejemplo.test`])), /Rol no válido/);
  await assert.rejects(como(SA, (c) => c.query(`select portal.cambiar_empleado($1, 'abogado', false)`, [SA])), /propio acceso/);
  await assert.rejects(como(LEC, (c) => c.query(`select portal.crear_cliente($1, 'X', 'particular', null, null, null)`, [`y.${suf}@ejemplo.test`])), /Sin permiso/);

  C = (await uno(SA, `select portal.crear_cliente($1, 'Clara Ficticia', 'particular', null, null, null) id`, [`c.${suf}@ejemplo.test`])).id;
  D = (await uno(SA, `select portal.crear_cliente($1, 'Diego Ficticio', 'particular', null, null, null) id`, [`d.${suf}@ejemplo.test`])).id;
  X = (await uno(SA, `select portal.abrir_expediente($1, 'Asunto X ficticio', null, null) id`, [C])).id;
  Y = (await uno(SA, `select portal.abrir_expediente($1, 'Asunto Y ficticio', null, null) id`, [D])).id;
  for (const sid of [X, Y]) {
    await como(SA, (c) => c.query(`insert into portal.notas_internas (solicitud_id, autor_id, texto) values ($1, $2, 'Nota ficticia')`, [sid, SA]));
    await como(SA, (c) => c.query(`insert into portal.mensajes (solicitud_id, autor_id, texto) values ($1, $2, 'Mensaje ficticio')`, [sid, SA]));
    await como(SA, (c) => c.query(`insert into portal.agenda_eventos (titulo, tipo, inicio, solicitud_id) values ('Revisar', 'tarea', now() + interval '1 day', $1)`, [sid]));
  }
  const doc = (sid: string, cli: string) => { const id = randomUUID(); return como(SA, async (c) => (await c.query(`insert into portal.documentos (id, solicitud_id, cliente_id, version, storage_key, nombre_original, mime, tamano, sha256, subido_por)
    values ($6, $1, $2, 0, $3, 'ficticio.pdf', 'application/pdf', 100, $4, $5) returning id`, [sid, cli, `${sid}/${id}`, 'e'.repeat(64), SA, id])).rows[0].id); };
  DOCX = await doc(X, C);
  await doc(Y, D);
});

test('un empleado sin asignar no ve nada; asignado ve exactamente su expediente', async () => {
  assert.deepEqual(await alcance(E1, X, DOCX, C), nada);
  await assert.rejects(como(E1, (c) => c.query('select portal.asignar($1, $2, null)', [X, E1])), /Sin permiso/);
  await como(SA, (c) => c.query(`select portal.asignar($1, $2, 'colaborador')`, [X, E1]));
  const ve = await alcance(E1, X, DOCX, C);
  assert.deepEqual(ve, { solicitud: 1, expediente: 1, documento: 1, notas: 1, mensajes: 1, eventos: ve.eventos, tareas: 1, perfil: 1, cuenta: 1 });
  assert.ok((ve.eventos ?? 0) > 0);
  // El otro asunto y su cliente siguen fuera de su alcance, también por búsqueda
  const docY = (await admin.query('select id from portal.documentos where solicitud_id = $1', [Y])).rows[0].id;
  assert.deepEqual(await alcance(E1, Y, docY, D), nada);
  assert.equal(await filas(E1, `select 1 from portal.perfiles p join identidad."user" u on u.id = p.user_id where u.email ilike $1`, [`%${suf}%`]), 1);
  // No puede escribir en el asunto ajeno
  await assert.rejects(como(E1, (c) => c.query(`insert into portal.notas_internas (solicitud_id, autor_id, texto) values ($1, $2, 'x')`, [Y, E1])), /row-level/);
  await assert.rejects(como(E1, (c) => c.query(`select portal.invitar_cliente($1, $2)`, [D, 'f'.repeat(64)])), /Sin permiso/);
  // El aviso de asignación es neutro (solo tipo y asunto, sin contenido)
  const av = await admin.query(`select tipo from portal.notificaciones where destinatario_id = $1 and solicitud_id = $2`, [E1, X]);
  assert.deepEqual(av.rows.map((r) => r.tipo), ['aviso_interno']);
});

test('tareas: se encargan, se completan con resultado y quedan en la cronología', async () => {
  await assert.rejects(como(SA, (c) => c.query(`insert into portal.agenda_eventos (titulo, tipo, inicio, solicitud_id, propietario_id) values ('Imposible', 'tarea', now(), $1, $2)`, [Y, E1])), /no tiene asignado/);
  const t = (await uno(SA, `insert into portal.agenda_eventos (titulo, tipo, inicio, solicitud_id, propietario_id) values ('Preparar demanda', 'tarea', now() + interval '2 days', $1, $2) returning id, propietario_id, asignada_por`, [X, E1]));
  assert.equal(t.propietario_id, E1);
  assert.equal(t.asignada_por, SA);
  const r = await uno(E1, `update portal.agenda_eventos set estado = 'completado', resultado = 'Borrador listo; siguiente paso: revisar con la clienta' where id = $1 returning completada_por`, [t.id]);
  assert.equal(r.completada_por, E1);
  const ev = (await como(E1, (c) => c.query(`select tipo, detalle, actor_id from portal.eventos where solicitud_id = $1 and tipo like 'tarea_%' order by id`, [X]))).rows;
  assert.deepEqual(ev.map((e) => e.tipo), ['tarea_encargada', 'tarea_completada']);
  assert.equal(ev[1].actor_id, E1);
  assert.match(ev[1].detalle.resultado, /siguiente paso/);
  // El cliente no ve el historial interno de tareas
  assert.equal(await filas(C, `select 1 from portal.eventos where solicitud_id = $1 and tipo like 'tarea_%'`, [X]), 0);
});

test('relevo: otra persona asume el asunto y recupera todo el contexto; al retirar, nada', async () => {
  assert.equal(await filas(E2, 'select 1 from portal.notas_internas where solicitud_id = $1', [X]), 0);
  await como(SA, (c) => c.query('select portal.cambiar_responsable($1, $2)', [X, E2]));
  assert.equal((await uno(E2, 'select responsable_id from portal.solicitudes where id = $1', [X])).responsable_id, E2);
  assert.equal(await filas(E2, 'select 1 from portal.notas_internas where solicitud_id = $1', [X]), 1);
  assert.equal(await filas(E2, `select 1 from portal.eventos where solicitud_id = $1 and tipo = 'tarea_completada'`, [X]), 1);
  // El nuevo responsable ya gestiona el equipo del asunto; no puede retirarse a sí mismo sin relevo
  await como(E2, (c) => c.query('select portal.retirar_asignacion($1, $2)', [X, E1]));
  assert.deepEqual(await alcance(E1, X, DOCX, C), nada);
  await assert.rejects(como(E2, (c) => c.query('select portal.retirar_asignacion($1, $2)', [X, E2])), /otro responsable/);
});

test('lectura limitada: consulta lo asignado, no escribe', async () => {
  await como(SA, (c) => c.query(`select portal.asignar($1, $2, 'colaborador')`, [X, LEC]));
  assert.equal(await filas(LEC, 'select 1 from portal.documentos where id = $1', [DOCX]), 1);
  await assert.rejects(como(LEC, (c) => c.query(`insert into portal.notas_internas (solicitud_id, autor_id, texto) values ($1, $2, 'x')`, [X, LEC])), /row-level/);
  await assert.rejects(como(LEC, (c) => c.query(`insert into portal.mensajes (solicitud_id, autor_id, texto) values ($1, $2, 'x')`, [X, LEC])), /row-level/);
  assert.equal(await filas(LEC, `update portal.documentos set carpeta = 'Otra' where id = $1`, [DOCX]), 0);
});

test('bandeja común: las solicitudes nuevas sin responsable las ven abogados, no lectura', async () => {
  const tipo = (await admin.query('select id from portal.tipos_asunto limit 1')).rows[0].id;
  NUEVA = await como(D, async (c) => {
    const id = (await c.query(`insert into portal.solicitudes (cliente_id, tipo_asunto_id, descripcion) values ($1, $2, 'Consulta ficticia sobre un despido inventado') returning id`, [D, tipo])).rows[0].id;
    await c.query(`update portal.solicitudes set estado = 'enviada' where id = $1`, [id]);
    return id as string;
  });
  assert.equal(await filas(E1, 'select 1 from portal.solicitudes where id = $1', [NUEVA]), 1);
  assert.equal(await filas(LEC, 'select 1 from portal.solicitudes where id = $1', [NUEVA]), 0);
  // Una vez repartida, solo la ve su responsable (y la superadministración)
  await como(SA, (c) => c.query('select portal.cambiar_responsable($1, $2)', [NUEVA, E2]));
  assert.equal(await filas(E1, 'select 1 from portal.solicitudes where id = $1', [NUEVA]), 0);
  assert.equal(await filas(SA, 'select 1 from portal.solicitudes where id = $1', [NUEVA]), 1);
});

test('desactivar a un empleado corta su acceso de inmediato', async () => {
  await admin.query(`insert into identidad.session (id, "expiresAt", token, "userId", "createdAt", "updatedAt") values ($1, now() + interval '1 day', $2, $3, now(), now())`, [randomUUID(), randomUUID(), E2]);
  await como(SA, (c) => c.query(`select portal.cambiar_empleado($1, 'abogado', false)`, [E2]));
  assert.equal((await admin.query('select count(*)::int n from identidad.session where "userId" = $1', [E2])).rows[0].n, 0);
  assert.equal(await filas(E2, 'select 1 from portal.solicitudes where id = $1', [X]), 0);
  assert.equal(await filas(E2, 'select 1 from portal.documentos where id = $1', [DOCX]), 0);
  // Y la clienta C sigue viendo su asunto, nunca el de D
  assert.equal(await filas(C, 'select 1 from portal.solicitudes where id = $1', [X]), 1);
  assert.equal(await filas(C, 'select 1 from portal.solicitudes where id = $1', [Y]), 0);
});
