// Motor de avisos de la agenda de extremo a extremo SIN servicios externos: un servidor HTTPS local hace
// de servicio de push. Se comprueba que el aviso vencido se entrega una vez, cifrado (RFC 8291), con VAPID,
// y que el contenido descifrado es neutro (sin datos del evento).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createECDH, randomBytes, randomUUID } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:https';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
// @ts-expect-error sin tipos
import ece from 'http_ece';

const admin = new pg.Client({ connectionString: process.env.DATABASE_URL_ADMIN });
const dir = mkdtempSync(join(tmpdir(), 'push-'));
const recibidos: { auth: string; cuerpo: Buffer }[] = [];
let server: ReturnType<typeof createServer>; let puerto = 0;

before(async () => {
  await admin.connect();
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=localhost',
    '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1', '-keyout', join(dir, 'k.pem'), '-out', join(dir, 'c.pem')], { stdio: 'ignore' });
  const { readFileSync } = await import('node:fs');
  server = createServer({ key: readFileSync(join(dir, 'k.pem')), cert: readFileSync(join(dir, 'c.pem')) }, (req, res) => {
    const partes: Buffer[] = [];
    req.on('data', (p) => partes.push(p));
    req.on('end', () => { recibidos.push({ auth: String(req.headers.authorization), cuerpo: Buffer.concat(partes) }); res.statusCode = 201; res.end(); });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  puerto = (server.address() as { port: number }).port;
});
after(async () => { server.close(); await admin.end(); });

test('un aviso vencido llega cifrado y neutro al dispositivo, una sola vez', async () => {
  const sufijo = randomUUID().slice(0, 8);
  const uid = (await admin.query(`insert into identidad."user" (name, email, "emailVerified") values ('Letrada push', $1, true) returning id`, [`push.${sufijo}@ejemplo.test`])).rows[0].id;
  await admin.query(`insert into portal.personal (user_id, rol, nombre_visible) values ($1, 'abogado', 'Letrada push')`, [uid]);
  const ecdh = createECDH('prime256v1'); ecdh.generateKeys();
  const authSecret = randomBytes(16);
  await admin.query(`insert into portal.push_suscripciones (user_id, endpoint, p256dh, auth) values ($1, $2, $3, $4)`,
    [uid, `https://127.0.0.1:${puerto}/push/${sufijo}`, ecdh.getPublicKey().toString('base64url'), authSecret.toString('base64url')]);
  // Evento dentro de 58 min con aviso 1 h antes: el aviso ya está vencido.
  // El alta exige personal con identidad: se crea como portal_app con app.user_id, igual que la aplicación.
  const app = new pg.Client({ connectionString: process.env.DATABASE_URL_APP });
  await app.connect();
  await app.query('begin');
  await app.query("select set_config('app.user_id', $1, true)", [uid]);
  const ev = (await app.query(`insert into portal.agenda_eventos (propietario_id, titulo, tipo, inicio, avisos_min)
    values ($1, 'Vista judicial de Cliente Confidencial', 'vista', now() + interval '58 minutes', '{60}') returning id`, [uid])).rows[0].id;
  await app.query('commit');
  await app.end();
  const env = { ...process.env, NODE_EXTRA_CA_CERTS: join(dir, 'c.pem') };
  for (let i = 0; i < 2; i++) {
    // Asíncrono: el servidor de push de la prueba vive en este mismo proceso.
    const codigo = await new Promise<number>((ok) => {
      const p = spawn(process.execPath, ['--experimental-strip-types', 'portal/scripts/agenda.ts'], { env, stdio: 'ignore' });
      p.on('exit', (c) => ok(c ?? 1));
    });
    assert.equal(codigo, 0);
  }
  const mios = recibidos.filter(() => true);
  assert.equal(mios.length, 1, 'una sola entrega pese a dos ejecuciones');
  assert.match(mios[0]!.auth, /^vapid t=/);
  const claro = ece.decrypt(mios[0]!.cuerpo, { version: 'aes128gcm', privateKey: ecdh, authSecret: authSecret.toString('base64url') }).toString();
  const datos = JSON.parse(claro);
  assert.equal(datos.body, 'Tienes un aviso pendiente en Praetoria.');
  assert.ok(!claro.includes('Confidencial') && !claro.includes('Vista'), 'sin datos del evento en el aviso');
  const a = await admin.query(`select estado, canales from portal.agenda_avisos where evento_id = $1`, [ev]);
  assert.deepEqual(a.rows, [{ estado: 'enviado', canales: 'interno+push' }]);
  const b = await admin.query(`select count(*)::int n from portal.avisos_internos where evento_id = $1`, [ev]);
  assert.equal(b.rows[0].n, 1);
  writeFileSync(join(dir, 'ok'), '1');
});
