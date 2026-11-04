// Cuarentena de documentos y correcciones de la auditoría de seguridad (migración 0006). Datos ficticios.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const admin = new pg.Client({ connectionString: process.env.DATABASE_URL_ADMIN });
const app = new pg.Pool({ connectionString: process.env.DATABASE_URL_APP, max: 2 });
const sufijo = randomUUID().slice(0, 8);
let A = '', L = '', sid = '', doc = '';

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
  const u = async (n: string) => (await admin.query(`insert into identidad."user" (name, email, "emailVerified") values ($1, $2, true) returning id`,
    [n, `${n.toLowerCase()}.${sufijo}@ejemplo.test`])).rows[0].id as string;
  A = await u('ClienteCuarentena'); L = await u('LetradaCuarentena');
  await admin.query(`insert into portal.personal (user_id, rol, nombre_visible) values ($1, 'abogado', 'Letrada Ficticia')`, [L]);
  sid = await como(A, async (c) => {
    const s = await c.query(`insert into portal.solicitudes (cliente_id, tipo_asunto_id, descripcion) values ($1, 'despido', $2) returning id`,
      [A, 'Me despidieron ayer sin explicación y quiero saber qué hacer.']);
    await c.query(`update portal.solicitudes set estado = 'enviada' where id = $1`, [s.rows[0].id]);
    return s.rows[0].id as string;
  });
  doc = randomUUID();
  await como(A, async (c) => {
    const r = await c.query('select id from portal.requisitos where solicitud_id = $1 limit 1', [sid]);
    await c.query(`insert into portal.documentos (id, requisito_id, solicitud_id, cliente_id, version, storage_key, nombre_original, mime, tamano, sha256, subido_por)
      values ($1, $2, $3, $4, 0, $5, 'carta.pdf', 'application/pdf', 100, $6, $4)`, [doc, r.rows[0].id, sid, A, `${sid}/${doc}`, 'a'.repeat(64)]);
  });
});
after(async () => { await admin.query(`delete from portal.ajustes where clave = 'antivirus_obligatorio'`); await app.end(); await admin.end(); });

test('la aplicación (ni el personal) puede escribir el resultado del antivirus', async () => {
  await assert.rejects(como(L, (c) => c.query(`update portal.documentos set analisis = 'limpio' where id = $1`, [doc])), /permission denied/);
});

test('un documento infectado no se puede validar', async () => {
  await admin.query(`set role portal_scan; update portal.documentos set analisis = 'infectado' where id = '${doc}'; reset role`);
  await assert.rejects(como(L, (c) => c.query(`update portal.documentos set estado = 'valido' where id = $1`, [doc])), /antivirus/);
  const ev = await admin.query(`select count(*)::int n from portal.eventos where tipo = 'documento_analizado' and solicitud_id = $1`, [sid]);
  assert.equal(ev.rows[0].n, 1);
});

test('con antivirus obligatorio, un documento sin analizar no se puede validar; uno limpio sí', async () => {
  await admin.query(`insert into portal.ajustes (clave, valor) values ('antivirus_obligatorio', 'true') on conflict (clave) do update set valor = 'true'`);
  await admin.query(`set role portal_scan; update portal.documentos set analisis = 'no_analizado' where id = '${doc}'; reset role`);
  await assert.rejects(como(L, (c) => c.query(`update portal.documentos set estado = 'valido' where id = $1`, [doc])), /análisis antivirus/);
  await admin.query(`set role portal_scan; update portal.documentos set analisis = 'limpio' where id = '${doc}'; reset role`);
  await como(L, (c) => c.query(`update portal.documentos set estado = 'valido' where id = $1`, [doc]));
});

test('el despacho no reescribe la descripción que envió el cliente', async () => {
  await assert.rejects(como(L, (c) => c.query(`update portal.solicitudes set descripcion = 'otra cosa' where id = $1`, [sid])), /no modifica lo que escribió el cliente/);
});

test('el rol de autenticación tiene su propio search_path (compatible con el pooler)', async () => {
  const r = await admin.query(`select setconfig from pg_db_role_setting s join pg_roles r on r.oid = s.setrole where r.rolname = 'portal_auth'`);
  assert.ok(r.rows.some((x) => (x.setconfig as string[]).includes('search_path=identidad')));
});
