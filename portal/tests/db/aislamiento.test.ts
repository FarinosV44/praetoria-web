// Pruebas de las reglas de la base de datos con el rol real de la aplicación (portal_app) y RLS.
// Datos 100 % ficticios. Requiere la pila local (scripts/dev-stack.sh) y las migraciones aplicadas.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const admin = new pg.Client({ connectionString: process.env.DATABASE_URL_ADMIN });
const app = new pg.Pool({ connectionString: process.env.DATABASE_URL_APP, max: 4 });
const sufijo = randomUUID().slice(0, 8);
let A = '', B = '', L = '';

async function como<T>(uid: string, fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await app.connect();
  try {
    await c.query('begin');
    await c.query("select set_config('app.user_id', $1, true)", [uid]);
    const r = await fn(c);
    await c.query('commit');
    return r;
  } catch (e) {
    await c.query('rollback');
    throw e;
  } finally { c.release(); }
}

async function usuario(nombre: string): Promise<string> {
  const r = await admin.query(`insert into identidad."user" (name, email, "emailVerified") values ($1, $2, true) returning id`,
    [nombre, `${nombre.toLowerCase()}.${sufijo}@ejemplo.test`]);
  return r.rows[0].id;
}

async function solicitudEnviada(uid: string): Promise<string> {
  return como(uid, async (c) => {
    const s = await c.query(`insert into portal.solicitudes (cliente_id, tipo_asunto_id, descripcion) values ($1, 'despido', $2) returning id`,
      [uid, 'Me despidieron ayer sin explicación y quiero saber qué hacer.']);
    await c.query(`update portal.solicitudes set estado = 'enviada' where id = $1`, [s.rows[0].id]);
    return s.rows[0].id as string;
  });
}

before(async () => {
  await admin.connect();
  A = await usuario('ClienteA'); B = await usuario('ClienteB'); L = await usuario('Letrada');
  await admin.query(`insert into portal.personal (user_id, rol, nombre_visible) values ($1, 'abogado', 'Letrada Ficticia')`, [L]);
});
after(async () => { await app.end(); await admin.end(); });

test('sin identidad no se ve nada, ni siquiera el catálogo', async () => {
  const c = await app.connect();
  try {
    const r = await c.query('select count(*)::int n from portal.solicitudes');
    assert.equal(r.rows[0].n, 0);
    const t = await c.query('select count(*)::int n from portal.tipos_asunto');
    assert.equal(t.rows[0].n, 0);
  } finally { c.release(); }
});

test('enviar una solicitud crea la lista documental de la plantilla y no crea expediente', async () => {
  const sid = await solicitudEnviada(A);
  const req = await como(A, (c) => c.query('select titulo, estado from portal.requisitos where solicitud_id = $1 order by orden', [sid]));
  assert.ok(req.rows.length >= 3);
  assert.ok(req.rows.some((r) => r.titulo === 'Carta de despido'));
  assert.ok(req.rows.every((r) => r.estado === 'pendiente'));
  const exp = await como(A, (c) => c.query('select count(*)::int n from portal.expedientes where solicitud_id = $1', [sid]));
  assert.equal(exp.rows[0].n, 0);
});

test('el cliente B no ve, no modifica y no aporta en la solicitud de A', async () => {
  const sid = await solicitudEnviada(A);
  const reqId = (await como(A, (c) => c.query('select id from portal.requisitos where solicitud_id = $1 limit 1', [sid]))).rows[0].id;
  await como(B, async (c) => {
    assert.equal((await c.query('select * from portal.solicitudes where id = $1', [sid])).rowCount, 0);
    assert.equal((await c.query('select * from portal.requisitos where solicitud_id = $1', [sid])).rowCount, 0);
    assert.equal((await c.query('select * from portal.eventos where solicitud_id = $1', [sid])).rowCount, 0);
    assert.equal((await c.query(`select id, email from identidad."user" where id = $1`, [A])).rowCount, 0);
    const u = await c.query(`update portal.solicitudes set descripcion = 'manipulada' where id = $1`, [sid]);
    assert.equal(u.rowCount, 0);
  });
  const docId = randomUUID();
  await assert.rejects(como(B, (c) => c.query(
    `insert into portal.documentos (id, requisito_id, solicitud_id, cliente_id, version, storage_key, nombre_original, mime, tamano, sha256, subido_por)
     values ($1, $2, $3, $4, 1, $5, 'x.pdf', 'application/pdf', 10, $6, $4)`,
    [docId, reqId, sid, B, `${sid}/${docId}`, 'a'.repeat(64)])), /Sin permiso|row-level security/);
  await assert.rejects(como(B, (c) => c.query(`insert into portal.mensajes (solicitud_id, autor_id, del_despacho, texto) values ($1, $2, false, 'hola')`, [sid, B])));
});

test('el cliente no puede cambiar campos del despacho ni editar tras enviar', async () => {
  const sid = await solicitudEnviada(A);
  const u = await como(A, (c) => c.query(`update portal.solicitudes set descripcion = 'otra cosa distinta y larga' where id = $1`, [sid]));
  assert.equal(u.rowCount, 0, 'una solicitud enviada no la modifica el cliente');
  await assert.rejects(como(A, (c) => c.query(`select image from identidad."user" where id = $1`, [A])), /permission denied/);
  await assert.rejects(como(A, (c) => c.query(`insert into portal.requisitos (solicitud_id, titulo, explicacion) values ($1, 'Falso', 'Inventado')`, [sid])));
  await assert.rejects(como(A, (c) => c.query(`select portal.convertir_en_expediente($1, 'Despido', $2)`, [sid, L])), /Sin permiso/);
  const n = await como(A, (c) => c.query('select count(*)::int n from portal.notas_internas where solicitud_id = $1', [sid]));
  assert.equal(n.rows[0].n, 0);
});

test('versiones: nunca se borra un documento y la nueva versión sustituye a la anterior', async () => {
  const sid = await solicitudEnviada(A);
  const reqId = (await como(A, (c) => c.query(`select id from portal.requisitos where solicitud_id = $1 and titulo = 'Carta de despido'`, [sid]))).rows[0].id;
  const subir = (uid: string) => como(uid, async (c) => {
    const id = randomUUID();
    const r = await c.query(
      `insert into portal.documentos (id, requisito_id, solicitud_id, cliente_id, version, storage_key, nombre_original, mime, tamano, sha256, subido_por)
       values ($1, $2, $3, $4, 0, $5, 'carta.pdf', 'application/pdf', 1000, $6, $4) returning version, sustituye_a, estado`,
      [id, reqId, sid, uid, `${sid}/${id}`, 'b'.repeat(64)]);
    return { id, ...r.rows[0] };
  });
  const v1 = await subir(A);
  assert.equal(v1.version, 1);
  const est = await como(A, (c) => c.query('select estado from portal.requisitos where id = $1', [reqId]));
  assert.equal(est.rows[0].estado, 'recibido');
  await como(L, async (c) => {
    await c.query(`update portal.documentos set estado = 'rechazado', motivo = 'No se lee' where id = $1`, [v1.id]);
    await c.query(`update portal.requisitos set estado = 'subsanacion', comentario = 'No se lee' where id = $1`, [reqId]);
  });
  const v2 = await subir(A);
  assert.equal(v2.version, 2);
  assert.equal(v2.sustituye_a, v1.id);
  await assert.rejects(como(L, (c) => c.query('delete from portal.documentos where id = $1', [v1.id])));
  await assert.rejects(como(L, (c) => c.query(`update portal.documentos set storage_key = $2 where id = $1`, [v1.id, `${sid}/${randomUUID()}`])));
  await como(L, (c) => c.query(`update portal.requisitos set estado = 'validado' where id = $1`, [reqId]));
  await assert.rejects(subir(A), /validado/);
  const docs = await como(A, (c) => c.query('select count(*)::int n from portal.documentos where requisito_id = $1', [reqId]));
  assert.equal(docs.rows[0].n, 2);
});

test('la ruta de almacenamiento debe pertenecer a la solicitud', async () => {
  const sa = await solicitudEnviada(A);
  const sb = await solicitudEnviada(B);
  const reqA = (await como(A, (c) => c.query('select id from portal.requisitos where solicitud_id = $1 limit 1', [sa]))).rows[0].id;
  const id = randomUUID();
  await assert.rejects(como(A, (c) => c.query(
    `insert into portal.documentos (id, requisito_id, solicitud_id, cliente_id, version, storage_key, nombre_original, mime, tamano, sha256, subido_por)
     values ($1, $2, $3, $4, 0, $5, 'x.pdf', 'application/pdf', 10, $6, $4)`, [id, reqA, sa, A, `${sb}/${id}`, 'c'.repeat(64)])), /Ruta/);
});

test('aceptar exige revisar conflictos y conserva solicitud, documentos e historial', async () => {
  const sid = await solicitudEnviada(A);
  await assert.rejects(como(L, (c) => c.query(`select portal.convertir_en_expediente($1, 'Despido de A', $2)`, [sid, L])), /conflictos/);
  const eid = await como(L, async (c) => {
    await c.query(`update portal.solicitudes set conflictos_revisados_at = now() where id = $1`, [sid]);
    return (await c.query(`select portal.convertir_en_expediente($1, 'Despido de A', $2) id`, [sid, L])).rows[0].id;
  });
  const vista = await como(A, async (c) => ({
    exp: (await c.query('select referencia, estado from portal.expedientes where id = $1', [eid])).rows[0],
    sol: (await c.query('select estado from portal.solicitudes where id = $1', [sid])).rows[0],
    ev: (await c.query(`select tipo from portal.eventos where solicitud_id = $1 order by id`, [sid])).rows.map((r) => r.tipo),
  }));
  assert.match(vista.exp.referencia, /^EXP-\d{4}-\d{5}$/);
  assert.equal(vista.sol.estado, 'aceptada');
  assert.ok(vista.ev.includes('solicitud_enviada') && vista.ev.includes('expediente_abierto'));
  assert.ok(!vista.ev.includes('conflictos_revisados'), 'los eventos internos no son visibles al cliente');
  assert.equal((await como(B, (c) => c.query('select * from portal.expedientes where id = $1', [eid]))).rowCount, 0);
});

test('el registro de eventos es inalterable', async () => {
  const sid = await solicitudEnviada(A);
  await assert.rejects(admin.query(`update portal.eventos set tipo = 'x' where solicitud_id = $1`, [sid]), /no se modifica/);
  await assert.rejects(admin.query(`delete from portal.eventos where solicitud_id = $1`, [sid]), /no se modifica/);
});

test('los avisos se agrupan: varios cambios seguidos generan un único aviso pendiente', async () => {
  const sid = await solicitudEnviada(A);
  await como(L, async (c) => {
    await c.query(`insert into portal.requisitos (solicitud_id, titulo, explicacion) values ($1, 'Documento extra uno', 'Lo necesitamos')`, [sid]);
    await c.query(`insert into portal.requisitos (solicitud_id, titulo, explicacion) values ($1, 'Documento extra dos', 'También')`, [sid]);
    await c.query(`insert into portal.mensajes (solicitud_id, autor_id, del_despacho, texto) values ($1, $2, true, 'Hola')`, [sid, L]);
  });
  const n = await admin.query(`select count(*)::int n from portal.notificaciones where solicitud_id = $1 and destino = 'cliente' and estado = 'pendiente'`, [sid]);
  assert.equal(n.rows[0].n, 1);
});

test('contacto autorizado: ve y aporta mientras el acceso está vigente; al revocarlo, nada', async () => {
  const sid = await solicitudEnviada(A);
  const acc = await como(L, (c) => c.query(`insert into portal.accesos (solicitud_id, user_id, permiso, concedido_por) values ($1, $2, 'lectura', $3) returning id`, [sid, B, L]));
  assert.equal((await como(B, (c) => c.query('select id from portal.solicitudes where id = $1', [sid]))).rowCount, 1);
  await como(L, (c) => c.query(`update portal.accesos set revocado_at = now(), revocado_por = $2 where id = $1`, [acc.rows[0].id, L]));
  assert.equal((await como(B, (c) => c.query('select id from portal.solicitudes where id = $1', [sid]))).rowCount, 0);
});
