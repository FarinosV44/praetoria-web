// Copiloto Jurídico (0017): aislamiento de fragmentos, conversaciones, ejecuciones, consumo y configuración. Datos ficticios.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const admin = new pg.Client({ connectionString: process.env.DATABASE_URL_ADMIN });
const app = new pg.Pool({ connectionString: process.env.DATABASE_URL_APP, max: 4 });
const suf = randomUUID().slice(0, 8);
let SA = '', E1 = '', E2 = '', F = '', CX = '', X = '', Y = '', DX = '', DY = '', MOD = '', VER = '', PRIV = '', VPRIV = '';

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
const filas = async (uid: string | null, sql: string, p: unknown[] = []) => (await como(uid, (c) => c.query(sql, p))).rowCount ?? 0;

before(async () => {
  await admin.connect();
  SA = (await admin.query(`insert into identidad."user" (name, email, "emailVerified") values ('Titular', $1, true) returning id`, [`sa.cop.${suf}@ejemplo.test`])).rows[0].id;
  await admin.query(`insert into portal.personal (user_id, rol, nombre_visible) values ($1, 'administrador', 'Titular Copiloto')`, [SA]);
  const alta = (n: string, rol: string) => como(SA, async (c) => (await c.query(`select portal.crear_empleado($1, $2, $3) id`, [`${n}.cop.${suf}@ejemplo.test`, n, rol])).rows[0].id as string);
  E1 = await alta('abogada1', 'abogado'); E2 = await alta('abogada2', 'abogado'); F = await alta('facturacion', 'facturacion');
  CX = await como(SA, async (c) => (await c.query(`select portal.crear_cliente($1, 'Cliente X', 'particular', null, null, null) id`, [`cx.cop.${suf}@ejemplo.test`])).rows[0].id);
  const cy = await como(SA, async (c) => (await c.query(`select portal.crear_cliente($1, 'Cliente Y', 'particular', null, null, null) id`, [`cy.cop.${suf}@ejemplo.test`])).rows[0].id);
  X = await como(SA, async (c) => (await c.query(`select portal.abrir_expediente($1, 'Asunto X', null, null) id`, [CX])).rows[0].id);
  Y = await como(SA, async (c) => (await c.query(`select portal.abrir_expediente($1, 'Asunto Y', null, null) id`, [cy])).rows[0].id);
  await como(SA, (c) => c.query(`select portal.asignar($1, $2, 'colaborador')`, [X, E1]));
  await como(SA, (c) => c.query(`select portal.asignar($1, $2, 'colaborador')`, [Y, E2]));
  const doc = async (sid: string, cli: string, n: string) => { const id = randomUUID(); return como(SA, async (c) => (await c.query(`insert into portal.documentos (id, solicitud_id, cliente_id, version, storage_key, nombre_original, mime, tamano, sha256, subido_por)
    values ($1, $2, $3, 0, $4, $5, 'application/pdf', 100, $6, $7) returning id`, [id, sid, cli, `${sid}/${id}`, n, 'c'.repeat(64), SA])).rows[0].id as string); };
  DX = await doc(X, CX, 'x.pdf'); DY = await doc(Y, cy, 'y.pdf');
  const modelo = async (titulo: string, clase: string) => como(SA, async (c) => {
    const m = (await c.query(`insert into portal.bib_modelos (titulo, clase, autor_id) values ($1, $2, $3) returning id`, [titulo, clase, SA])).rows[0].id as string;
    const v = (await c.query(`insert into portal.bib_versiones (modelo_id, version, origen, texto, subido_por) values ($1, 0, 'pegado', 'Texto ficticio del modelo', $2) returning id`, [m, SA])).rows[0].id as string;
    return [m, v] as const;
  });
  [MOD, VER] = await modelo(`Modelo común ${suf}`, 'maestro');
  [PRIV, VPRIV] = await modelo(`Caso privado ${suf}`, 'caso_privado');
  await como(SA, async (c) => {
    await c.query('select portal.bib_aprobar($1, true)', [MOD]);
    await c.query(`insert into portal.doc_fragmentos (documento_id, solicitud_id, orden, texto) values ($1, $2, 0, 'Contrato de arrendamiento de la parte X'), ($3, $4, 0, 'Secreto del arrendamiento de la parte Y')`, [DX, X, DY, Y]);
    await c.query(`insert into portal.bib_fragmentos (version_id, modelo_id, orden, texto) values ($1, $2, 0, 'Fundamentos comunes'), ($3, $4, 0, 'Datos de un caso privado')`, [VER, MOD, VPRIV, PRIV]);
  });
});
after(async () => { await app.end(); await admin.end(); });

test('los fragmentos de un expediente solo los recupera quien tiene el asunto, ni otro empleado ni el cliente', async () => {
  const buscar = `select texto from portal.doc_fragmentos where tsv @@ plainto_tsquery('spanish', 'arrendamiento') and documento_id = any($1)`;
  assert.equal(await filas(E1, buscar, [[DX, DY]]), 1, 'solo el de su asunto');
  assert.equal((await como(E1, (c) => c.query(buscar, [[DX, DY]]))).rows[0].texto.includes('parte X'), true);
  assert.equal(await filas(E2, buscar, [[DX]]), 0, 'la consulta directa a otro asunto no devuelve nada');
  assert.equal(await filas(CX, 'select 1 from portal.doc_fragmentos'), 0, 'el cliente nunca, ni los de su propio asunto');
  assert.equal(await filas(null, 'select 1 from portal.doc_fragmentos'), 0, 'sin identidad, nada');
  assert.equal(await filas(F, 'select 1 from portal.doc_fragmentos where documento_id = $1', [DX]), 0, 'facturación sin asignación, nada');
});

test('al retirar la asignación o eliminar el documento deja de poder recuperarse', async () => {
  await como(SA, (c) => c.query(`select portal.asignar($1, $2, 'colaborador')`, [Y, E1]));
  assert.equal(await filas(E1, 'select 1 from portal.doc_fragmentos where documento_id = $1', [DY]), 1);
  await como(SA, (c) => c.query('select portal.retirar_asignacion($1, $2)', [Y, E1]));
  assert.equal(await filas(E1, 'select 1 from portal.doc_fragmentos where documento_id = $1', [DY]), 0);
  await como(SA, (c) => c.query(`select portal.documento_eliminar($1, 'prueba')`, [DX]));
  assert.equal(await filas(E1, 'select 1 from portal.doc_fragmentos where documento_id = $1', [DX]), 0, 'en la papelera no se recupera');
  await como(SA, (c) => c.query('select portal.documento_restaurar($1)', [DX]));
  assert.equal(await filas(E1, 'select 1 from portal.doc_fragmentos where documento_id = $1', [DX]), 1, 'restaurado vuelve');
});

test('la purga borra los fragmentos del documento', async () => {
  const d = randomUUID();
  await como(SA, (c) => c.query(`insert into portal.documentos (id, solicitud_id, cliente_id, version, storage_key, nombre_original, mime, tamano, sha256, subido_por)
    values ($1, $2, $3, 0, $4, 'p.pdf', 'application/pdf', 1, $5, $6)`, [d, X, CX, `${X}/${d}`, 'd'.repeat(64), SA]));
  await admin.query(`insert into portal.doc_fragmentos (documento_id, solicitud_id, orden, texto) values ($1, $2, 0, 'a purgar')`, [d, X]);
  await admin.query(`update portal.documentos set purgado_at = now() where id = $1`, [d]);
  assert.equal((await admin.query('select 1 from portal.doc_fragmentos where documento_id = $1', [d])).rowCount, 0);
  assert.equal((await admin.query(`select 1 from portal.ia_indexacion where origen_id = $1`, [d])).rowCount, 0);
});

test('la biblioteca: lo aprobado lo ve el equipo; el caso privado, no; bib_usable sigue mandando', async () => {
  assert.equal(await filas(E1, 'select 1 from portal.bib_fragmentos where modelo_id = $1', [MOD]), 1);
  assert.equal(await filas(E1, 'select 1 from portal.bib_fragmentos where modelo_id = $1', [PRIV]), 0);
  assert.equal(await filas(F, 'select 1 from portal.bib_fragmentos'), 0, 'facturación no accede a la biblioteca');
  assert.equal(await filas(CX, 'select 1 from portal.bib_fragmentos'), 0);
  assert.equal(await filas(SA, 'select 1 from portal.bib_fragmentos where modelo_id = $1 and portal.bib_usable(version_id)', [PRIV]), 0, 'ni siquiera la superadministración usa un caso privado como modelo');
});

test('solo la superadministración escribe fragmentos', async () => {
  await assert.rejects(como(E1, (c) => c.query(`insert into portal.doc_fragmentos (documento_id, solicitud_id, orden, texto) values ($1, $2, 99, 'inyectado')`, [DX, X])), /row-level/);
  await assert.rejects(como(E1, (c) => c.query(`insert into portal.bib_fragmentos (version_id, modelo_id, orden, texto) values ($1, $2, 99, 'inyectado')`, [VER, MOD])), /row-level/);
  assert.equal(await filas(E1, 'delete from portal.doc_fragmentos where documento_id = $1', [DX]), 0);
});

test('las conversaciones de despacho son de quien las crea', async () => {
  const h = await como(E1, async (c) => (await c.query(`insert into portal.ia_hilos (titulo, ambito, creado_por) values ('General', 'despacho', $1) returning id`, [E1])).rows[0].id as string);
  await como(E1, (c) => c.query(`insert into portal.ia_mensajes (hilo_id, rol, texto, autor_id) values ($1, 'usuario', 'Hola', $2)`, [h, E1]));
  assert.equal(await filas(E1, 'select 1 from portal.ia_mensajes where hilo_id = $1', [h]), 1);
  assert.equal(await filas(E2, 'select 1 from portal.ia_hilos where id = $1', [h]), 0, 'otra abogada no la ve');
  assert.equal(await filas(E2, 'select 1 from portal.ia_mensajes where hilo_id = $1', [h]), 0);
  assert.equal(await filas(SA, 'select 1 from portal.ia_mensajes where hilo_id = $1', [h]), 0, 'tampoco la superadministración');
  assert.equal(await filas(CX, 'select 1 from portal.ia_hilos where id = $1', [h]), 0);
  await assert.rejects(como(E2, (c) => c.query(`insert into portal.ia_mensajes (hilo_id, rol, texto, autor_id) values ($1, 'usuario', 'x', $2)`, [h, E2])), /row-level|no pertenece/, 'tampoco puede escribir en ella');
  await assert.rejects(como(F, (c) => c.query(`insert into portal.ia_hilos (titulo, ambito, creado_por) values ('x', 'despacho', $1)`, [F])), /row-level/, 'facturación no usa el asistente de biblioteca');
  await assert.rejects(como(E1, (c) => c.query(`insert into portal.ia_mensajes (hilo_id, solicitud_id, rol, texto, autor_id) values ($1, $2, 'usuario', 'x', $3)`, [h, X, E1])), /no pertenece/, 'un mensaje no salta de hilo a asunto');
});

test('una ejecución es de su autor y del asunto; otro empleado no la ve ni la toca', async () => {
  const id = await como(E1, async (c) => (await c.query(`insert into portal.ia_ejecuciones (tipo, solicitud_id, creado_por) values ('chat', $1, $2) returning id, creado_por`, [X, SA])).rows[0]);
  assert.equal(id.creado_por, E1, 'el autor lo fija la base de datos');
  assert.equal(await filas(E2, 'select 1 from portal.ia_ejecuciones where id = $1', [id.id]), 0);
  assert.equal(await filas(E2, `update portal.ia_ejecuciones set parcial = 'x' where id = $1`, [id.id]), 0);
  await assert.rejects(como(E2, (c) => c.query(`insert into portal.ia_ejecuciones (tipo, solicitud_id, creado_por) values ('chat', $1, $2)`, [X, E2])), /row-level/);
  assert.equal(await filas(E1, `update portal.ia_ejecuciones set estado = 'listo', parcial = 'hecho' where id = $1`, [id.id]), 1);
});

test('consumo: cada cual ve el suyo y la superadministración todo; el gasto total solo da una suma', async () => {
  const ins = `insert into portal.ia_consumo (user_id, tarea, proveedor, modelo_pedido, coste_usd, estado) values ($1, 'chat', 'anthropic', 'claude-opus-5-5', 1.5, 'ok')`;
  await como(E1, (c) => c.query(ins, [SA]));
  assert.equal(await filas(E2, 'select 1 from portal.ia_consumo where user_id = $1', [E1]), 0);
  assert.equal(await filas(SA, 'select 1 from portal.ia_consumo where user_id = $1', [E1]), 1, 'el autor real, aunque se indique otro');
  const gasto = async (u: string) => Number((await como(u, (c) => c.query(`select portal.ia_gasto(now() - interval '1 hour') g`))).rows[0].g);
  assert.ok(await gasto(E2) >= 1.5);
  assert.equal(await gasto(CX), 0, 'el cliente no obtiene la suma');
  await assert.rejects(como(E1, (c) => c.query('delete from portal.ia_consumo')), /permission denied/, 'el registro no se puede borrar');
});

test('la configuración la cambia solo la superadministración, queda auditada y no hay ninguna clave', async () => {
  assert.equal(await filas(E1, `update portal.ia_ajustes set openai_autorizado = true`), 0);
  await assert.rejects(como(E1, (c) => c.query(`update portal.ia_ajustes set id = false`)), /permission denied|row-level/);
  await assert.rejects(como(E1, (c) => c.query(`select * from portal.ia_auditoria for update`)), /permission denied/);
  const antes = (await como(SA, (c) => c.query(`select limite_hora_usuario l from portal.ia_ajustes`))).rows[0].l;
  await como(SA, (c) => c.query(`update portal.ia_ajustes set limite_hora_usuario = 77`));
  const a = (await como(SA, (c) => c.query(`select user_id from portal.ia_auditoria where accion = 'ajustes_ia' order by at desc limit 1`))).rows[0];
  assert.equal(a.user_id, SA);
  await como(SA, (c) => c.query(`update portal.ia_ajustes set limite_hora_usuario = $1`, [antes]));
  const cols = (await admin.query(`select column_name from information_schema.columns where table_schema = 'portal' and table_name = 'ia_ajustes'`)).rows.map((r) => r.column_name as string);
  assert.equal(cols.some((c) => /clave|key|secret|token/.test(c)), false, 'las claves viven solo en el entorno del servidor');
  assert.equal(await filas(E2, 'select 1 from portal.ia_auditoria'), 0);
});

test('la cola: se llena sola, la tarea periódica no ve contenido y las personas no pueden tomar trabajo', async () => {
  assert.equal((await admin.query(`select 1 from portal.ia_indexacion where tipo = 'documento' and origen_id = $1`, [DX])).rowCount, 1);
  assert.equal((await admin.query(`select 1 from portal.ia_indexacion where tipo = 'biblioteca' and origen_id = $1`, [VER])).rowCount, 1);
  assert.equal(await filas(E1, 'select * from portal.ia_indexacion_tomar(5)'), 0, 'una persona no toma trabajo');
  assert.equal((await como(E1, (c) => c.query('select portal.ia_ejecutor() e'))).rows[0].e, null);
  assert.ok((await como(null, (c) => c.query('select portal.ia_ejecutor() e'))).rows[0].e, 'la tarea periódica obtiene la persona con la que actuar');
  const cols = (await como(null, (c) => c.query('select * from portal.ia_indexacion_tomar(1)'))).fields.map((f) => f.name);
  assert.deepEqual(cols.sort(), ['id', 'origen_id', 'solicitud_id', 'tipo']);
  await assert.rejects(como(E2, (c) => c.query(`select portal.ia_reindexar('documento', $1)`, [DX])), /Sin permiso/);
  await como(E1, (c) => c.query(`select portal.ia_reindexar('documento', $1)`, [DX]));
  assert.equal(await filas(E1, 'select 1 from portal.ia_indexacion where origen_id = $1', [DX]), 1);
  assert.equal(await filas(E2, 'select 1 from portal.ia_indexacion where origen_id = $1', [DX]), 0);
});

test('al aprobar un modelo se reprocesa su última versión', async () => {
  const [m, v] = await como(SA, async (c) => {
    const id = (await c.query(`insert into portal.bib_modelos (titulo, clase, autor_id) values ($1, 'clausula', $2) returning id`, [`Cláusula ${suf}`, SA])).rows[0].id as string;
    const ver = (await c.query(`insert into portal.bib_versiones (modelo_id, version, origen, texto, subido_por) values ($1, 0, 'pegado', 'Texto', $2) returning id`, [id, SA])).rows[0].id as string;
    return [id, ver];
  });
  await admin.query(`update portal.ia_indexacion set estado = 'ok' where tipo = 'biblioteca' and origen_id = $1`, [v]);
  await como(SA, (c) => c.query('select portal.bib_aprobar($1, true)', [m]));
  assert.equal((await admin.query(`select estado from portal.ia_indexacion where tipo = 'biblioteca' and origen_id = $1`, [v])).rows[0].estado, 'pendiente');
});
