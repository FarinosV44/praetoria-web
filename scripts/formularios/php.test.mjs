// Pruebas de la recepción de formularios en Hostinger (public/api/*.php), ejecutada con PHP de línea de órdenes.
// La entrega por correo se sustituye por un registro local (PRAETORIA_ENTREGA_URL), como en las pruebas en navegador.
//   node --test scripts/formularios/
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PHP = process.env.PHP_BIN || 'php';
const hayPhp = spawnSync(PHP, ['-v']).status === 0;
const API = fileURLToPath(new URL('../../public/api/', import.meta.url));

let registro = [];
let respuestaRegistro = 200;
let servidor;
let destino = '';

before(async () => {
  servidor = createServer((req, res) => {
    const partes = [];
    req.on('data', (c) => partes.push(c));
    req.on('end', () => {
      if (respuestaRegistro === 200) registro.push(Object.fromEntries(new URLSearchParams(Buffer.concat(partes).toString())));
      res.writeHead(respuestaRegistro);
      res.end();
    });
  });
  await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
  destino = `http://127.0.0.1:${servidor.address().port}/`;
});
after(() => servidor?.close());

/** Ejecuta el endpoint y devuelve { status, headers, body, json() } */
function post(archivo, datos, { tipo = 'application/json', entrega = destino, env = {}, args = [] } = {}) {
  const cuerpo = tipo === 'application/json' ? JSON.stringify(datos) : new URLSearchParams(datos).toString();
  return new Promise((resolve, reject) => {
    const entorno = { ...process.env, REQUEST_METHOD: 'POST', CONTENT_TYPE: tipo, CONTENT_LENGTH: String(Buffer.byteLength(cuerpo)), PRAETORIA_ENTREGA_URL: entrega, ...env };
    if (!entorno.PRAETORIA_ENTREGA_URL) delete entorno.PRAETORIA_ENTREGA_URL;
    const hijo = spawn(PHP, [...args, API + archivo], { env: entorno });
    const salida = [];
    hijo.stdout.on('data', (c) => salida.push(c));
    hijo.on('error', reject);
    hijo.on('close', () => {
      const r = JSON.parse(Buffer.concat(salida).toString());
      resolve({ ...r, json: () => JSON.parse(r.body) });
    });
    hijo.stdin.end(cuerpo);
  });
}
const consulta = (d, o) => post('consulta.php', d, o);
const llamada = (d, o) => post('llamada.php', d, o);

const base = () => ({
  nombre: 'Persona de prueba',
  email: 'prueba@example.com',
  telefono: '600 000 000',
  area: 'transporte',
  mensaje: 'Un cliente no me paga dos portes desde hace tres meses.',
  preferencia: 'llamada',
  privacidad: true,
  id: 'abc12345-test',
  t: Date.now() - 10_000,
  'empresa-web': '',
});

const t = (nombre, fn) => test(nombre, { skip: !hayPhp && 'PHP no está instalado' }, async () => {
  registro = [];
  respuestaRegistro = 200;
  await fn();
});

t('consulta válida: se entrega con área y responsable y responde 200 con su id', async () => {
  const r = await consulta(base());
  assert.equal(r.status, 200);
  assert.deepEqual(r.json(), { ok: true, id: 'abc12345-test' });
  assert.equal(registro.length, 1);
  assert.equal(registro[0]['form-name'], 'contacto');
  assert.equal(registro[0].area, 'Transporte y logística');
  assert.equal(registro[0].responsable, 'Juan José Farinós Ibáñez (607 527 719)');
  assert.equal(registro[0].preferencia, 'Llamada');
});

t('laboral: se marca como área laboral y la responsable es Lucía López', async () => {
  await consulta({ ...base(), area: 'laboral', representa: 'trabajador' });
  assert.equal(registro[0]['form-name'], 'contacto-laboral');
  assert.equal(registro[0].responsable, 'Lucía López (649 181 290)');
});

t('errores de validación: 422 con cada campo y sin entregar', async () => {
  const sinTel = await consulta({ ...base(), telefono: '' });
  assert.equal(sinTel.status, 422);
  assert.match(sinTel.json().errores.telefono, /necesitamos tu teléfono/);
  for (const email of ['', 'no-es-un-correo']) assert.ok((await consulta({ ...base(), preferencia: 'correo', email })).json().errores.email, email);
  const varios = (await consulta({ ...base(), area: '', privacidad: false, mensaje: 'Hola' })).json().errores;
  assert.ok(varios.area && varios.privacidad && varios.mensaje);
  assert.equal((await consulta({ ...base(), nombre: 'x'.repeat(101) })).status, 422);
  assert.equal(registro.length, 0);
});

t('cuerpo excesivo: 413', async () => {
  assert.equal((await consulta({ ...base(), mensaje: 'x'.repeat(20_000) })).status, 413);
});

t('campo trampa relleno o envío demasiado rápido: 200 sin entregar nada', async () => {
  for (const extra of [{ 'empresa-web': 'spam' }, { t: Date.now() }]) assert.equal((await consulta({ ...base(), ...extra })).status, 200);
  assert.equal(registro.length, 0);
});

t('si la entrega falla, 502 (el navegador ofrece reintentar)', async () => {
  respuestaRegistro = 500;
  const r = await consulta(base());
  assert.equal(r.status, 502);
  assert.equal(r.json().error, 'entrega');
  assert.equal((await consulta(base(), { entrega: 'http://127.0.0.1:9/' })).status, 502);
});

t('sin JavaScript: éxito redirige a /gracias/ y los errores muestran una página', async () => {
  const ok = await consulta({ nombre: 'Persona', telefono: '600000000', area: 'civil', mensaje: 'Consulta sobre una herencia sin repartir.', preferencia: 'llamada', privacidad: 'on' }, { tipo: 'application/x-www-form-urlencoded' });
  assert.equal(ok.status, 303);
  assert.equal(ok.headers.Location, '/gracias/');
  assert.match(registro[0].id, /^[0-9a-f-]{36}$/);
  const ko = await consulta({ nombre: 'Persona', preferencia: 'llamada' }, { tipo: 'application/x-www-form-urlencoded' });
  assert.equal(ko.status, 422);
  assert.match(ko.body, /Revisa tu consulta/);
});

t('servicio, datos de transporte y fecha: se entregan con su etiqueta; en otra área se descartan', async () => {
  assert.equal((await consulta({ ...base(), servicio: 'transporte-portes-impagados', papel: 'transportista', incidencia: 'impago', importe: '3000-15000', fecha: '2026-09-15' })).status, 200);
  assert.equal(registro[0].servicio, 'Reclamación de portes impagados');
  assert.equal(registro[0].papel, 'Transportista (hago el porte)');
  assert.equal(registro[0].incidencia, 'Porte o factura impagada');
  assert.equal(registro[0].fecha, '2026-09-15');
  assert.equal((await consulta({ ...base(), servicio: 'no-existe' })).status, 422);
  assert.match((await consulta({ ...base(), area: 'familia', servicio: 'transporte-portes-impagados' })).json().errores.servicio, /no corresponde al área/);
  await consulta({ ...base(), area: 'civil', papel: 'transportista', fecha: '2026-09-15' });
  assert.equal(registro[1].papel ?? '', '');
  assert.equal(registro[1].fecha ?? '', '');
  assert.equal((await consulta({ ...base(), fecha: '2026-02-31' })).status, 422);
});

t('atribución: rutas internas y utm válidos se conservan; lo demás se descarta sin error', async () => {
  await consulta({ ...base(), origen: '/impugnar-despido/?x=1', landing: 'https://otro.com/', utm_source: 'Google', utm_campaign: '<script>' });
  assert.equal(registro[0].origen, '/impugnar-despido/');
  assert.equal(registro[0].landing ?? '', '');
  assert.equal(registro[0].utm_source, 'google');
  assert.equal(registro[0].utm_campaign ?? '', '');
});

t('solicitud de llamada: URGENTE con motivo y contacto seguro; validación y antispam', async () => {
  const datos = { nombre: 'Persona', telefono: '600 000 000', area: 'penal', motivo: 'citacion', seguro: 'discreto', fecha: '2026-12-01', privacidad: true, id: 'abc12345-llam', t: Date.now() - 10_000 };
  const ok = await llamada(datos);
  assert.equal(ok.status, 200);
  assert.equal(registro[0]['form-name'], 'llamada-urgente');
  assert.equal(registro[0].prioridad, 'URGENTE');
  assert.equal(registro[0].motivo, 'Citación del juzgado o de la policía');
  assert.equal(registro[0].seguro, 'Otra persona puede ver mi teléfono: llamad con discreción');
  await llamada({ ...datos, area: 'laboral' });
  assert.equal(registro[1]['form-name'], 'llamada-urgente-laboral');
  const ko = await llamada({ ...datos, telefono: '', motivo: 'x' });
  assert.equal(ko.status, 422);
  assert.ok(ko.json().errores.telefono && ko.json().errores.motivo);
  assert.equal((await llamada({ ...datos, 'empresa-web': 'spam' })).status, 200);
  assert.equal(registro.length, 2);
});

t('las piezas internas no se ejecutan por sí solas', async () => {
  for (const archivo of ['comun.php', 'catalogo.php']) {
    const r = spawnSync(PHP, [API + archivo]);
    assert.equal(r.stdout.toString(), '', archivo);
  }
});

/** Simula la API de Resend: guarda lo recibido y responde con el código indicado. */
async function conResend(codigo, fn) {
  const recibidos = [];
  const srv = createServer((req, res) => {
    const partes = [];
    req.on('data', (c) => partes.push(c));
    req.on('end', () => {
      recibidos.push({ auth: req.headers.authorization, cuerpo: JSON.parse(Buffer.concat(partes).toString()) });
      res.writeHead(codigo, { 'Content-Type': 'application/json' });
      res.end(codigo === 200 ? '{"id":"x"}' : '{"message":"error"}');
    });
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const dir = mkdtempSync(join(tmpdir(), 'praetoria-conf-'));
  const conf = join(dir, 'praetoria-config.php');
  writeFileSync(conf, "<?php return ['resend_api_key' => 're_prueba'];\n");
  try {
    await fn({ recibidos, env: { PRAETORIA_ENTREGA_URL: '', PRAETORIA_CONFIG: conf, PRAETORIA_RESEND_URL: `http://127.0.0.1:${srv.address().port}/emails` } });
  } finally {
    srv.close();
  }
}

t('con clave de Resend: envía por su API al despacho, con asunto, «Responder a» y el texto de la consulta', async () => {
  await conResend(200, async ({ recibidos, env }) => {
    const r = await consulta({ ...base(), area: 'laboral', representa: 'trabajador' }, { env });
    assert.equal(r.status, 200);
    assert.equal(recibidos.length, 1);
    const { auth, cuerpo } = recibidos[0];
    assert.equal(auth, 'Bearer re_prueba');
    assert.deepEqual(cuerpo.to, ['info@praetoriaabogados.es']);
    assert.match(cuerpo.from, /<web@praetoriaabogados\.es>$/);
    assert.match(cuerpo.subject, /^Nueva consulta web · Laboral \(Lucía López\) · Persona de prueba$/);
    assert.equal(cuerpo.reply_to, 'prueba@example.com');
    assert.match(cuerpo.text, /Responsable: Lucía López \(649 181 290\)/);
  });
});

t('si Resend falla y mail() también, 502: no se da por recibida', async () => {
  await conResend(500, async ({ recibidos, env }) => {
    const r = await consulta(base(), { env, args: ['-d', 'sendmail_path=/bin/false'] });
    assert.equal(recibidos.length, 1);
    assert.equal(r.status, 502);
  });
});
