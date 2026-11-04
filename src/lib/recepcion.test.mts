// Pruebas de la recepción de formularios, contra un registro local y una API de Resend simulada.
// Heredan los casos de las antiguas pruebas de public/api/*.php.
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MAX_CONSULTA, atender, cuerpoCorreo, recibirConsulta, recibirLlamada } from './recepcion.ts';

let registro: Record<string, string>[] = [];
let resend: { auth?: string; cuerpo: Record<string, unknown> }[] = [];
let estado = 200;
let servidor: Server;
let base = '';

before(async () => {
  servidor = createServer((req, res) => {
    const partes: Buffer[] = [];
    req.on('data', (c) => partes.push(c));
    req.on('end', () => {
      const texto = Buffer.concat(partes).toString();
      if (estado === 200) {
        if (req.url === '/resend') resend.push({ auth: req.headers.authorization, cuerpo: JSON.parse(texto) });
        else registro.push(Object.fromEntries(new URLSearchParams(texto)));
      }
      res.writeHead(estado);
      res.end('{}');
    });
  });
  await new Promise<void>((r) => servidor.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});
after(() => servidor.close());
beforeEach(() => {
  registro = [];
  resend = [];
  estado = 200;
  process.env.PRAETORIA_ENTREGA_URL = `${base}/registro`;
  delete process.env.RESEND_API_KEY;
});

const hace = (ms: number) => Date.now() - ms;
const consulta = (extra: Record<string, unknown> = {}) => ({
  id: 'prueba-12345678', nombre: 'Ana Ficticia', email: 'ana@example.test', telefono: '600000000', area: 'civil',
  mensaje: 'Necesito ayuda con una herencia pendiente.', preferencia: 'correo', privacidad: true, t: hace(10_000), ...extra,
});
const llamada = (extra: Record<string, unknown> = {}) => ({
  id: 'llamada-12345678', nombre: 'Ana Ficticia', telefono: '600000000', area: 'penal', motivo: 'citacion', privacidad: true, t: hace(10_000), ...extra,
});
const JSON_T = 'application/json';
const FORM_T = 'application/x-www-form-urlencoded';
const enviar = (d: object) => recibirConsulta(JSON_T, JSON.stringify(d));

test('una consulta válida se entrega y responde con su identificador', async () => {
  const r = await enviar(consulta());
  assert.equal(r.status, 200);
  assert.deepEqual(JSON.parse(r.body), { ok: true, id: 'prueba-12345678' });
  assert.equal(registro.length, 1);
  assert.equal(registro[0]!.area, 'Civil, herencias y vivienda');
  assert.match(registro[0]!.responsable!, /\(/);
  assert.equal(registro[0]!['form-name'], 'contacto');
});

test('laboral se asigna a su responsable y a su canal', async () => {
  const r = await enviar(consulta({ area: 'laboral', representa: 'trabajador' }));
  assert.equal(r.status, 200);
  assert.equal(registro[0]!['form-name'], 'contacto-laboral');
  assert.match(registro[0]!.responsable!, /Lucía López/);
});

test('los errores de validación responden 422 por campo y no se entregan', async () => {
  const casos: [Record<string, unknown>, string][] = [
    [{ preferencia: 'llamada', telefono: '' }, 'telefono'],
    [{ preferencia: 'correo', email: '' }, 'email'],
    [{ email: 'no-valido' }, 'email'],
    [{ area: '' }, 'area'],
    [{ privacidad: false }, 'privacidad'],
    [{ mensaje: 'corto' }, 'mensaje'],
    [{ nombre: 'x'.repeat(101) }, 'nombre'],
    [{ servicio: 'no-existe' }, 'servicio'],
  ];
  for (const [extra, campo] of casos) {
    const r = await enviar(consulta(extra));
    assert.equal(r.status, 422, campo);
    assert.ok(JSON.parse(r.body).errores[campo], campo);
  }
  assert.equal(registro.length, 0);
});

test('el campo trampa y el envío demasiado rápido no se entregan, sin avisar al bot', async () => {
  for (const extra of [{ 'empresa-web': 'spam' }, { t: hace(100) }, { t: 'x' }]) {
    const r = await enviar(consulta(extra));
    assert.equal(r.status, 200);
    assert.deepEqual(JSON.parse(r.body), { ok: true });
  }
  assert.equal(registro.length, 0);
});

test('un fallo de la entrega responde 502 y nunca éxito', async () => {
  estado = 500;
  const r = await enviar(consulta());
  assert.equal(r.status, 502);
  assert.equal(JSON.parse(r.body).error, 'entrega');
});

test('JSON roto o que no es un objeto responde 400', async () => {
  assert.equal((await recibirConsulta(JSON_T, '{roto')).status, 400);
  assert.equal((await recibirConsulta(JSON_T, '[1]')).status, 400);
});

test('el cuerpo excesivo responde 413', async () => {
  const req = new Request('http://x/api/consulta', { method: 'POST', headers: { 'content-type': JSON_T }, body: 'x'.repeat(MAX_CONSULTA + 1) });
  const r = await atender(req, MAX_CONSULTA, recibirConsulta);
  assert.equal(r.status, 413);
});

test('sin JavaScript: redirige a /gracias/ o muestra los errores escapados', async () => {
  const campos = { nombre: 'Ana Ficticia', email: 'ana@example.test', area: 'civil', mensaje: 'Necesito ayuda con una herencia pendiente.', preferencia: 'correo', privacidad: 'on' };
  const ok = await recibirConsulta(FORM_T, new URLSearchParams(campos).toString());
  assert.equal(ok.status, 303);
  assert.equal(ok.headers.Location, '/gracias/');
  assert.equal(registro.length, 1);
  assert.match(registro[0]!.id!, /^[a-f0-9-]{36}$/);
  const mal = await recibirConsulta(FORM_T, new URLSearchParams({ ...campos, privacidad: '' }).toString());
  assert.equal(mal.status, 422);
  assert.match(mal.body, /<li>Necesitamos que aceptes/);
});

test('sin JavaScript el campo trampa redirige sin entregar', async () => {
  const r = await recibirConsulta(FORM_T, new URLSearchParams({ 'empresa-web': 'spam' }).toString());
  assert.equal(r.status, 303);
  assert.equal(registro.length, 0);
});

test('los datos de otra área se descartan y la atribución se sanea', async () => {
  await enviar(consulta({ papel: 'agencia', origen: '/contacto/?x=1', utm_source: 'Google', utm_medium: 'no válido!' }));
  assert.equal(registro[0]!.papel, '');
  assert.equal(registro[0]!.origen, '/contacto/');
  assert.equal(registro[0]!.utm_source, 'google');
  assert.equal(registro[0]!.utm_medium, '');
});

test('la solicitud de llamada se entrega como urgente', async () => {
  const r = await recibirLlamada(JSON_T, JSON.stringify(llamada()));
  assert.equal(r.status, 200);
  assert.equal(registro[0]!.prioridad, 'URGENTE');
  assert.equal(registro[0]!['form-name'], 'llamada-urgente');
  assert.equal(registro[0]!.seguro, 'Podéis llamarme y dejar mensaje');
  const mal = await recibirLlamada(JSON_T, JSON.stringify(llamada({ telefono: '' })));
  assert.equal(mal.status, 422);
});

test('un servicio que no encaja nunca bloquea una llamada urgente', async () => {
  const r = await recibirLlamada(JSON_T, JSON.stringify(llamada({ servicio: 'no-existe' })));
  assert.equal(r.status, 200);
  assert.equal(registro[0]!.servicio, '');
});

test('por Resend: remitente del dominio, responder a quien consulta, y copia fuera de la web', async () => {
  delete process.env.PRAETORIA_ENTREGA_URL;
  process.env.RESEND_API_KEY = 're_prueba';
  process.env.PRAETORIA_RESEND_URL = `${base}/resend`;
  const dir = mkdtempSync(join(tmpdir(), 'consultas-'));
  process.env.CONSULTAS_COPIA_DIR = dir;
  const r = await enviar(consulta());
  assert.equal(r.status, 200);
  assert.equal(resend[0]!.auth, 'Bearer re_prueba');
  assert.match(String(resend[0]!.cuerpo.from), /<info@praetoriaabogados\.es>$/);
  assert.deepEqual(resend[0]!.cuerpo.to, ['info@praetoriaabogados.es']);
  assert.equal(resend[0]!.cuerpo.reply_to, 'ana@example.test');
  assert.match(String(resend[0]!.cuerpo.subject), /^Nueva consulta web · /);
  const [archivo] = readdirSync(dir);
  assert.match(archivo!, /^\d{4}-\d{2}\.jsonl$/);
  assert.equal(JSON.parse(readFileSync(join(dir, archivo!), 'utf8')).tipo, 'consulta');
});

test('sin clave de Resend no se finge el envío', async () => {
  delete process.env.PRAETORIA_ENTREGA_URL;
  process.env.CONSULTAS_COPIA_DIR = mkdtempSync(join(tmpdir(), 'consultas-'));
  assert.equal((await enviar(consulta())).status, 502);
});

test('el correo incluye solo los campos con valor y la fecha en hora de Madrid', () => {
  const t = cuerpoCorreo({ nombre: 'Ana', mensaje: 'línea 1\nlínea 2', fecha: '' }, new Date('2026-07-01T10:00:00Z'));
  assert.match(t, /Nombre: Ana/);
  assert.match(t, /Mensaje:\nlínea 1\nlínea 2/);
  assert.doesNotMatch(t, /Fecha relevante/);
  assert.match(t, /el 01\/07\/2026 12:00\./);
});
