// Biblioteca jurídica (#92/#93): modelos privados hasta su aprobación, versiones inmutables y búsqueda.
// Rol real portal_app con RLS. Textos ficticios.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const admin = new pg.Client({ connectionString: process.env.DATABASE_URL_ADMIN });
const app = new pg.Pool({ connectionString: process.env.DATABASE_URL_APP, max: 4 });
const suf = randomUUID().slice(0, 8);
let SA = '', E = '', E2 = '', LEC = '', FAC = '', CLI = '', M = '', PROC = '';

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
const ve = async (uid: string, id: string) => (await como(uid, (c) => c.query('select 1 from portal.bib_modelos where id = $1', [id]))).rowCount;
const version = (uid: string, modelo: string, texto: string) => como(uid, (c) => c.query(
  `insert into portal.bib_versiones (modelo_id, version, origen, texto, subido_por) values ($1, 0, 'pegado', $2, $3) returning version`, [modelo, texto, uid]));

before(async () => {
  await admin.connect();
  SA = (await admin.query(`insert into identidad."user" (name, email, "emailVerified") values ('Titular', $1, true) returning id`, [`sa.bib.${suf}@ejemplo.test`])).rows[0].id;
  await admin.query(`insert into portal.personal (user_id, rol, nombre_visible) values ($1, 'administrador', 'Titular Bib')`, [SA]);
  const emp = async (rol: string, n: string) => como(SA, async (c) => (await c.query(`select portal.crear_empleado($1, $2, $3) id`, [`${n}.bib.${suf}@ejemplo.test`, `Persona ${n}`, rol])).rows[0].id as string);
  E = await emp('abogado', 'e'); E2 = await emp('abogado', 'e2'); LEC = await emp('lectura', 'lec'); FAC = await emp('facturacion', 'fac');
  CLI = await como(SA, async (c) => (await c.query(`select portal.crear_cliente($1, 'Cliente Bib', 'particular', null, null, null) id`, [`cli.bib.${suf}@ejemplo.test`])).rows[0].id);
  PROC = (await admin.query(`select id from portal.bib_procedimientos where nombre = 'Modificación de medidas'`)).rows[0].id;
});
after(async () => { await app.end(); await admin.end(); });

test('lo que sube un abogado es privado y pendiente; ni otro abogado, ni el cliente, ni facturación lo ven', async () => {
  M = await como(E, async (c) => (await c.query(`insert into portal.bib_modelos (titulo, procedimiento_id, clase, autor_id) values ('Demanda ficticia de modificación de medidas', $1, 'maestro', $2) returning id, estado, autor_id, materia_id`, [PROC, SA])).rows[0]).then((r) => {
    assert.equal(r.estado, 'pendiente'); assert.equal(r.autor_id, E, 'el autor lo fija la base de datos'); assert.equal(r.materia_id, 'familia', 'la materia sale del procedimiento');
    return r.id as string;
  });
  assert.equal((await version(E, M, 'TEXTO FICTICIO. Se solicita la modificación de medidas por cambio sustancial de circunstancias.')).rows[0].version, 1);
  assert.equal(await ve(E, M), 1);
  assert.equal(await ve(SA, M), 1);
  for (const otro of [E2, LEC, FAC, CLI]) assert.equal(await ve(otro, M), 0);
  assert.equal((await como(E2, (c) => c.query('select 1 from portal.bib_versiones where modelo_id = $1', [M]))).rowCount, 0);
  await assert.rejects(version(E2, M, 'intruso intentando añadir versión'), /row-level/);
  assert.equal((await como(CLI, (c) => c.query('select 1 from portal.bib_procedimientos'))).rowCount, 0, 'el cliente no ve ni el catálogo');
});

test('solo la superadministración aprueba, y exige revisar la anonimización; un caso privado no se comparte', async () => {
  await assert.rejects(como(E, (c) => c.query(`update portal.bib_modelos set estado = 'aprobado' where id = $1`, [M])), /Solo la superadministración/);
  await assert.rejects(como(SA, (c) => c.query(`update portal.bib_modelos set estado = 'aprobado' where id = $1`, [M])), /confirmación de anonimización/);
  await assert.rejects(como(E, (c) => c.query('select portal.bib_aprobar($1, true)', [M])), /Solo la superadministración/);
  await assert.rejects(como(SA, (c) => c.query('select portal.bib_aprobar($1, false)', [M])), /Confirma/);
  const priv = await como(E, async (c) => (await c.query(`insert into portal.bib_modelos (titulo, autor_id) values ('Escrito de caso ficticio', $1) returning id, clase`, [E])).rows[0]);
  assert.equal(priv.clase, 'caso_privado', 'por defecto, privado');
  await version(E, priv.id, 'Texto ficticio de un caso concreto que no debe compartirse.');
  await assert.rejects(como(SA, (c) => c.query('select portal.bib_aprobar($1, true)', [priv.id])), /caso privado no se comparte/);

  await como(SA, (c) => c.query('select portal.bib_aprobar($1, true)', [M]));
  const a = (await admin.query('select estado, aprobado_por, anonimizado_por from portal.bib_modelos where id = $1', [M])).rows[0];
  assert.deepEqual(a, { estado: 'aprobado', aprobado_por: SA, anonimizado_por: SA });
  for (const quien of [E2, LEC]) assert.equal(await ve(quien, M), 1, 'aprobado: lo ve el equipo jurídico');
  assert.equal(await ve(FAC, M), 0);
  assert.equal(await ve(CLI, M), 0);
  // El autor ya no puede cambiar un modelo aprobado
  assert.equal((await como(E, (c) => c.query(`update portal.bib_modelos set titulo = 'cambiado' where id = $1`, [M]))).rowCount, 0);
});

test('una versión nueva de un modelo aprobado lo devuelve a revisión; obsoleto deja de ofrecerse; la versión anterior se conserva', async () => {
  await version(SA, M, 'TEXTO FICTICIO v2. Modificación de medidas por traslado de residencia.');
  assert.equal((await admin.query('select estado from portal.bib_modelos where id = $1', [M])).rows[0].estado, 'revision');
  assert.equal(await ve(E2, M), 0, 'mientras se revisa, no se comparte');
  assert.deepEqual((await admin.query('select version from portal.bib_versiones where modelo_id = $1 order by version', [M])).rows.map((r) => r.version), [1, 2]);
  await assert.rejects(admin.query(`set role portal_app; update portal.bib_versiones set texto = 'x' where modelo_id = '${M}'; reset role`), /permission denied/);
  await admin.query('reset role');
  await como(SA, (c) => c.query('select portal.bib_aprobar($1, true)', [M]));
  await como(SA, (c) => c.query(`update portal.bib_modelos set estado = 'obsoleto' where id = $1`, [M]));
  assert.equal(await ve(E2, M), 0);
  assert.equal(await ve(SA, M), 1, 'el rastro se conserva');
});

test('la ruta del archivo en almacenamiento queda atada al modelo y a la versión', async () => {
  const id = randomUUID();
  await assert.rejects(como(SA, (c) => c.query(`insert into portal.bib_versiones (id, modelo_id, version, origen, storage_key, nombre_original, mime, tamano, sha256, texto, subido_por)
    values ($1, $2, 0, 'archivo', $3, 'x.pdf', 'application/pdf', 10, $4, '', $5)`, [id, M, `biblioteca/${randomUUID()}/${id}`, 'c'.repeat(64), SA])), /Ruta de almacenamiento/);
});

test('búsqueda de texto completo en español sobre el contenido', async () => {
  const r = await como(SA, (c) => c.query(`select m.id from portal.bib_modelos m join portal.bib_versiones v on v.modelo_id = m.id
    where to_tsvector('spanish', v.texto) @@ websearch_to_tsquery('spanish', 'traslado residencia')`));
  assert.ok(r.rows.some((x) => x.id === M));
});
