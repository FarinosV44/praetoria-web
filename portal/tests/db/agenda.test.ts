// Agenda, avisos programados, invitaciones y suscripciones push con el rol real portal_app y RLS.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';

const admin = new pg.Client({ connectionString: process.env.DATABASE_URL_ADMIN });
const app = new pg.Pool({ connectionString: process.env.DATABASE_URL_APP, max: 4 });
const sufijo = randomUUID().slice(0, 8);
let L = '', L2 = '', C = '';

async function como<T>(uid: string | null, fn: (c: pg.PoolClient) => Promise<T>, proceso?: string): Promise<T> {
  const c = await app.connect();
  try {
    await c.query('begin');
    if (uid) await c.query("select set_config('app.user_id', $1, true)", [uid]);
    if (proceso) await c.query("select set_config('app.proceso', $1, true)", [proceso]);
    const r = await fn(c);
    await c.query('commit');
    return r;
  } catch (e) { await c.query('rollback'); throw e; } finally { c.release(); }
}
const usuario = async (n: string) => (await admin.query(`insert into identidad."user" (name, email, "emailVerified") values ($1, $2, true) returning id`, [n, `${n.toLowerCase()}.${sufijo}@ejemplo.test`])).rows[0].id as string;
const crearEvento = (uid: string, inicio: string, avisos: number[], extra = '') =>
  como(uid, async (c) => (await c.query(`insert into portal.agenda_eventos (propietario_id, titulo, tipo, inicio, avisos_min${extra ? ', repeticion, repetir_hasta' : ''})
    values ($1, 'Vista judicial ficticia', 'vista', $2, $3${extra ? `, ${extra}` : ''}) returning id`, [uid, inicio, avisos])).rows[0].id as string);
const avisos = (uid: string, ev: string) => como(uid, async (c) => (await c.query(
  `select antelacion_min, estado, disparo_at, ocurrencia from portal.agenda_avisos where evento_id = $1 order by ocurrencia, antelacion_min desc`, [ev])).rows);

before(async () => {
  await admin.connect();
  L = await usuario('Letrada'); L2 = await usuario('Letrado'); C = await usuario('Cliente');
  await admin.query(`insert into portal.personal (user_id, rol, nombre_visible) values ($1, 'administrador', 'Letrada'), ($2, 'abogado', 'Letrado')`, [L, L2]);
});
after(async () => { await app.end(); await admin.end(); });

test('una vista con avisos 1 semana, 24 h y 1 h antes programa tres avisos, uno por antelación', async () => {
  const inicio = new Date(Date.now() + 10 * 86400e3).toISOString();
  const ev = await crearEvento(L, inicio, [10080, 1440, 60]);
  const a = await avisos(L, ev);
  assert.deepEqual(a.map((x) => x.antelacion_min), [10080, 1440, 60]);
  assert.ok(a.every((x) => x.estado === 'programado'));
  assert.equal(new Date(a[2].disparo_at).getTime(), new Date(inicio).getTime() - 3600e3);
});

test('reprogramar cancela los avisos antiguos y crea los nuevos sin duplicar', async () => {
  const ev = await crearEvento(L, new Date(Date.now() + 5 * 86400e3).toISOString(), [1440, 60]);
  const nuevo = new Date(Date.now() + 6 * 86400e3).toISOString();
  await como(L, (c) => c.query('update portal.agenda_eventos set inicio = $2 where id = $1', [ev, nuevo]));
  await como(L, (c) => c.query(`update portal.agenda_eventos set titulo = 'Otro título' where id = $1`, [ev])); // sin cambio de fecha: no replanifica
  const a = await avisos(L, ev);
  assert.equal(a.filter((x) => x.estado === 'programado').length, 2);
  assert.equal(a.filter((x) => x.estado === 'cancelado').length, 2);
  assert.ok(a.filter((x) => x.estado === 'programado').every((x) => new Date(x.ocurrencia).toISOString() === nuevo));
  await como(L, (c) => c.query(`update portal.agenda_eventos set estado = 'completado' where id = $1`, [ev]));
  assert.equal((await avisos(L, ev)).filter((x) => x.estado === 'programado').length, 0, 'completar cancela los avisos');
});

test('la repetición semanal respeta el cambio de hora (10:00 en Madrid antes y después del 25 de octubre)', async () => {
  const ev = await crearEvento(L, '2026-10-19T10:00:00+02:00', [60], `'semanal', date '2026-12-31'`);
  const a = (await avisos(L, ev)).filter((x) => x.estado === 'programado');
  assert.ok(a.length >= 3);
  for (const x of a) {
    const h = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' }).format(new Date(x.ocurrencia));
    assert.equal(h, '10:00');
  }
});

test('cada profesional solo ve su agenda; el cliente no puede crear eventos', async () => {
  const ev = await crearEvento(L, new Date(Date.now() + 86400e3).toISOString(), [60]);
  assert.equal((await como(L2, (c) => c.query('select id from portal.agenda_eventos where id = $1', [ev]))).rowCount, 0);
  assert.equal((await como(L2, (c) => c.query('select id from portal.agenda_avisos where evento_id = $1', [ev]))).rowCount, 0);
  assert.equal((await como(L2, (c) => c.query(`update portal.agenda_eventos set titulo = 'x' where id = $1`, [ev]))).rowCount, 0);
  await assert.rejects(crearEvento(C, new Date(Date.now() + 86400e3).toISOString(), [60]));
});

test('el motor entrega cada aviso vencido una sola vez aunque haya dos ejecuciones a la vez', async () => {
  const ev = await crearEvento(L, new Date(Date.now() + 58 * 60e3).toISOString(), [60]);
  const tomar = () => como(null, async (c) => (await c.query('select * from portal.tomar_avisos_agenda(50)')).rows.filter((r) => r.evento_id === ev), 'notificador');
  const [a, b] = await Promise.all([tomar(), tomar()]);
  assert.equal(a.length + b.length, 1);
  const aviso = (a[0] ?? b[0]).aviso_id;
  await como(null, (c) => c.query(`select portal.cerrar_aviso($1, true, 'interno', null)`, [aviso]), 'notificador');
  assert.equal((await tomar()).length, 0);
  const bandeja = await como(L, (c) => c.query('select * from portal.avisos_internos where aviso_id = $1', [aviso]));
  assert.equal(bandeja.rowCount, 1);
  // Sin el proceso notificador, la aplicación no puede tomar avisos.
  await assert.rejects(como(L, (c) => c.query('select * from portal.tomar_avisos_agenda(5)')));
  // Posponer crea un aviso nuevo de la misma letrada; otro profesional no puede posponerlo.
  await assert.rejects(como(L2, (c) => c.query('select portal.posponer_aviso($1, 60)', [aviso])));
  await como(L, (c) => c.query('select portal.posponer_aviso($1, 60)', [aviso]));
  assert.equal((await avisos(L, ev)).filter((x) => x.estado === 'programado').length, 1);
});

test('un plazo cambiado de fecha pierde la verificación del abogado', async () => {
  const id = await como(L, async (c) => (await c.query(`insert into portal.agenda_eventos (propietario_id, titulo, tipo, inicio, avisos_min, plazo_fuente, plazo_verificado_at)
    values ($1, 'Vencimiento ficticio', 'plazo', now() + interval '9 days', '{1440}', 'Notificación ficticia', now()) returning id`, [L])).rows[0].id);
  const v1 = (await como(L, (c) => c.query('select plazo_verificado_por from portal.agenda_eventos where id = $1', [id]))).rows[0];
  assert.equal(v1.plazo_verificado_por, L);
  await como(L, (c) => c.query(`update portal.agenda_eventos set inicio = inicio + interval '1 day' where id = $1`, [id]));
  const v2 = (await como(L, (c) => c.query('select plazo_verificado_por from portal.agenda_eventos where id = $1', [id]))).rows[0];
  assert.equal(v2.plazo_verificado_por, null);
});

test('suscripciones push: propias, invisibles para otros, y 410 las revoca', async () => {
  const endpoint = `https://push.ejemplo.test/${randomUUID()}`;
  const sid = await como(L, async (c) => (await c.query(`insert into portal.push_suscripciones (user_id, endpoint, p256dh, auth) values ($1, $2, $3, $4) returning id`,
    [L, endpoint, 'B'.repeat(87), 'a'.repeat(22)])).rows[0].id);
  assert.equal((await como(L2, (c) => c.query('select id from portal.push_suscripciones where id = $1', [sid]))).rowCount, 0);
  await assert.rejects(como(L2, (c) => c.query(`insert into portal.push_suscripciones (user_id, endpoint, p256dh, auth) values ($1, $2, $3, $4)`, [L, endpoint + 'x', 'B'.repeat(87), 'a'.repeat(22)])));
  await como(null, (c) => c.query(`select portal.registrar_entrega(null, $1, 'gone', 410)`, [sid]), 'notificador');
  const s = await como(L, (c) => c.query('select revocada_at from portal.push_suscripciones where id = $1', [sid]));
  assert.ok(s.rows[0].revocada_at);
});

test('invitación: un solo uso, caduca y solo se guarda el hash', async () => {
  const token = randomBytes(32).toString('base64url');
  const sha = createHash('sha256').update(token).digest('hex');
  await admin.query(`insert into portal.invitaciones (user_id, token_sha256, expira_at) values ($1, $2, now() + interval '1 day')`, [L2, sha]);
  assert.equal((await como(null, (c) => c.query('select portal.invitacion_valida($1) u', [sha]))).rows[0].u, L2);
  assert.equal((await como(null, (c) => c.query('select portal.usar_invitacion($1) u', [sha]))).rows[0].u, L2);
  await assert.rejects(como(null, (c) => c.query('select portal.usar_invitacion($1)', [sha])), /no válida/);
  await assert.rejects(como(L2, (c) => c.query('select * from portal.invitaciones')), /permission denied/, 'nadie lee la tabla');
  const sha2 = createHash('sha256').update('caducada' + sufijo).digest('hex');
  await admin.query(`insert into portal.invitaciones (user_id, token_sha256, expira_at) values ($1, $2, now() - interval '1 minute')`, [L2, sha2]);
  assert.equal((await como(null, (c) => c.query('select portal.invitacion_valida($1) u', [sha2]))).rows[0].u, null);
});
