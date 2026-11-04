// Alta de clientes desde /admin, expediente abierto por el despacho, documentos privados/compartidos y notas.
// Rol real portal_app con RLS. Datos ficticios.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';

const admin = new pg.Client({ connectionString: process.env.DATABASE_URL_ADMIN });
const app = new pg.Pool({ connectionString: process.env.DATABASE_URL_APP, max: 4 });
const suf = randomUUID().slice(0, 8);
let L = '', A = '', B = '';

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
const subir = (uid: string, sid: string, nombre: string, extra: { requisito?: string; carpeta?: string } = {}) => como(uid, async (c) => {
  const id = randomUUID();
  const r = await c.query(`insert into portal.documentos (id, requisito_id, solicitud_id, cliente_id, version, storage_key, nombre_original, mime, tamano, sha256, subido_por, carpeta)
    values ($1, $2, $3, $4, 0, $5, $6, 'application/pdf', 100, $7, $4, $8) returning id, visible_cliente, carpeta, estado, version, sustituye_a`,
    [id, extra.requisito ?? null, sid, uid, `${sid}/${id}`, nombre, 'd'.repeat(64), extra.carpeta ?? null]);
  return r.rows[0];
});

before(async () => {
  await admin.connect();
  L = (await admin.query(`insert into identidad."user" (name, email, "emailVerified") values ('Letrada', $1, true) returning id`, [`l.${suf}@ejemplo.test`])).rows[0].id;
  await admin.query(`insert into portal.personal (user_id, rol, nombre_visible) values ($1, 'administrador', 'Letrada')`, [L]);
});
after(async () => { await app.end(); await admin.end(); });

test('el despacho da de alta clientes; un cliente no puede, y no se duplican correos', async () => {
  A = await como(L, async (c) => (await c.query(`select portal.crear_cliente($1, 'Ana Ficticia', 'particular', null, '600000000', '12345678Z') id`, [`ana.${suf}@ejemplo.test`])).rows[0].id);
  B = await como(L, async (c) => (await c.query(`select portal.crear_cliente($1, 'Bruno Ficticio', 'empresa', 'Empresa Ficticia SL', null, 'B12345678') id`, [`bruno.${suf}@ejemplo.test`])).rows[0].id);
  await assert.rejects(como(L, (c) => c.query(`select portal.crear_cliente($1, 'Otra', 'particular', null, null, null)`, [`ANA.${suf}@ejemplo.test`])), /Ya existe/);
  await assert.rejects(como(A, (c) => c.query(`select portal.crear_cliente($1, 'Intruso', 'particular', null, null, null)`, [`x.${suf}@ejemplo.test`])), /Sin permiso/);
  const p = (await como(L, (c) => c.query('select nif, tipo, version_privacidad, creado_por from portal.perfiles where user_id = $1', [A]))).rows[0];
  assert.deepEqual(p, { nif: '12345678Z', tipo: 'particular', version_privacidad: null, creado_por: L });
});

test('invitación del cliente: solo el despacho, nunca para personal, y la privacidad se acepta al canjearla', async () => {
  const token = randomBytes(32).toString('base64url');
  const sha = createHash('sha256').update(token).digest('hex');
  await assert.rejects(como(A, (c) => c.query('select portal.invitar_cliente($1, $2)', [A, sha])), /Sin permiso/);
  await assert.rejects(como(L, (c) => c.query('select portal.invitar_cliente($1, $2)', [L, sha])), /Solo para clientes/);
  await assert.rejects(como(null, (c) => c.query(`select portal.aceptar_privacidad($1, '2026-10-27')`, [A])), /Sin permiso/);
  await como(L, (c) => c.query('select portal.invitar_cliente($1, $2)', [A, sha]));
  assert.equal((await como(null, (c) => c.query('select portal.usar_invitacion($1) u', [sha]))).rows[0].u, A);
  await como(null, (c) => c.query(`select portal.aceptar_privacidad($1, '2026-10-27')`, [A]));
  const p = (await admin.query('select version_privacidad, acepta_privacidad_at from portal.perfiles where user_id = $1', [A])).rows[0];
  assert.equal(p.version_privacidad, '2026-10-27');
  assert.ok(p.acepta_privacidad_at);
});

test('expediente abierto por el despacho: documentos privados hasta compartirlos; el cliente B no ve nada', async () => {
  await admin.query(`insert into identidad.account ("accountId", "providerId", "userId", password, "updatedAt") values ($1::text, 'credential', $1::uuid, 'x', now())`, [A]);
  const sid = await como(L, async (c) => (await c.query(`select portal.abrir_expediente($1, 'Reclamación de cantidad ficticia', 'salarios', null) id`, [A])).rows[0].id);
  const vista = await como(A, async (c) => (await c.query(`select s.estado, e.titulo from portal.solicitudes s join portal.expedientes e on e.solicitud_id = s.id where s.id = $1`, [sid])).rows[0]);
  assert.deepEqual(vista, { estado: 'aceptada', titulo: 'Reclamación de cantidad ficticia' });
  assert.equal((await como(B, (c) => c.query('select id from portal.solicitudes where id = $1', [sid]))).rowCount, 0);

  const d1 = await subir(L, sid, 'borrador-demanda.pdf', { carpeta: 'Escritos' });
  assert.equal(d1.visible_cliente, false);
  assert.equal(d1.carpeta, 'Escritos');
  assert.equal(d1.estado, 'valido');
  const d2 = await subir(L, sid, 'informe-para-cliente.pdf');
  assert.equal(d2.carpeta, 'Documentación del despacho');
  const ver = (uid: string) => como(uid, async (c) => (await c.query('select nombre_original from portal.documentos where solicitud_id = $1 order by 1', [sid])).rows.map((r) => r.nombre_original));
  assert.deepEqual(await ver(A), []);
  // El cliente no puede publicarse documentos a sí mismo
  assert.equal((await como(A, (c) => c.query('update portal.documentos set visible_cliente = true where id = $1', [d2.id]))).rowCount, 0);
  await como(L, (c) => c.query('update portal.documentos set visible_cliente = true where id = $1', [d2.id]));
  assert.deepEqual(await ver(A), ['informe-para-cliente.pdf']);
  assert.deepEqual(await ver(B), []);
  const ev = await como(A, async (c) => (await c.query(`select tipo from portal.eventos where solicitud_id = $1 order by id`, [sid])).rows.map((r) => r.tipo));
  assert.ok(ev.includes('documento_compartido'));
  assert.equal(ev.filter((t) => t === 'documento_aportado').length, 0, 'las subidas privadas del despacho no aparecen en el historial del cliente');
  const avisos = await admin.query(`select count(*)::int n from portal.notificaciones where solicitud_id = $1 and destino = 'cliente' and estado = 'pendiente'`, [sid]);
  assert.equal(avisos.rows[0].n, 1, 'compartir avisa al cliente una sola vez');

  // El cliente aporta sin requisito: visible para él, en su carpeta, y el despacho no puede ocultárselo
  const d3 = await subir(A, sid, 'nomina.pdf');
  assert.equal(d3.visible_cliente, true);
  assert.equal(d3.carpeta, 'Aportado por el cliente');
  await assert.rejects(como(L, (c) => c.query('update portal.documentos set visible_cliente = false where id = $1', [d3.id])), /siempre es visible/);
  // Versiones por nombre: subir de nuevo el mismo archivo crea la versión 2
  const d4 = await subir(A, sid, 'nomina.pdf');
  assert.equal(d4.version, 2);
  assert.equal(d4.sustituye_a, d3.id);
  assert.equal((await como(B, (c) => c.query('select id from portal.documentos where id = $1', [d3.id]))).rowCount, 0);
  await assert.rejects(subir(B, sid, 'intruso.pdf'), /Sin permiso|row-level/);

  // Notas internas con su origen: nunca visibles para el cliente
  await como(L, (c) => c.query(`insert into portal.notas_internas (solicitud_id, autor_id, texto, fuente) values ($1, $2, 'Texto pegado de la notificación', 'texto_aportado')`, [sid, L]));
  assert.equal((await como(A, (c) => c.query('select id from portal.notas_internas where solicitud_id = $1', [sid]))).rowCount, 0);
  // Recientes: solo del propio profesional y de asuntos que puede ver
  await como(L, (c) => c.query('insert into portal.recientes (user_id, solicitud_id) values ($1, $2)', [L, sid]));
  await assert.rejects(como(A, (c) => c.query('insert into portal.recientes (user_id, solicitud_id) values ($1, $2)', [A, sid])));
});

test('los avisos no se envían a clientes que aún no han activado su cuenta', async () => {
  const sid = await como(L, async (c) => (await c.query(`select portal.abrir_expediente($1, 'Asunto de empresa ficticia', null, null) id`, [B])).rows[0].id);
  const d = await subir(L, sid, 'contrato.pdf');
  await como(L, (c) => c.query('update portal.documentos set visible_cliente = true where id = $1', [d.id]));
  const n = await admin.query(`select count(*)::int n from portal.notificaciones where solicitud_id = $1 and destino = 'cliente'`, [sid]);
  assert.equal(n.rows[0].n, 0);
});
