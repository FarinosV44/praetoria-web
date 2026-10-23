// Pruebas de la función de recepción: node --test netlify/functions/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from './consulta.mts';

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

const recorder = (status = 200) => {
  const calls: { url: string; body: URLSearchParams }[] = [];
  const forward = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: new URLSearchParams(String(init.body)) });
    return new Response('', { status });
  }) as unknown as typeof fetch;
  return { calls, forward };
};

const post = (data: object, ctx: object, type = 'application/json') =>
  handler(
    new Request('https://ejemplo.netlify.app/api/consulta', {
      method: 'POST',
      headers: { 'Content-Type': type },
      body: type === 'application/json' ? JSON.stringify(data) : new URLSearchParams(data as Record<string, string>).toString(),
    }),
    ctx,
  );

test('consulta válida: se entrega a Netlify Forms y responde 200 con su id', async () => {
  const r = recorder();
  const res = await post(base(), r);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, id: 'abc12345-test' });
  assert.equal(r.calls.length, 1);
  assert.match(r.calls[0]!.url, /\/__forms\.html$/);
  const b = r.calls[0]!.body;
  assert.equal(b.get('form-name'), 'contacto');
  assert.equal(b.get('area'), 'Transporte y logística');
  assert.equal(b.get('responsable'), 'Juan José Farinós Ibáñez (607 527 719)');
});

test('laboral: el responsable es Lucía López', async () => {
  const r = recorder();
  await post({ ...base(), area: 'laboral', representa: 'trabajador' }, r);
  assert.equal(r.calls[0]!.body.get('responsable'), 'Lucía López (649 181 290)');
});

test('llamada sin teléfono: 422 con el error en el campo teléfono y sin entregar', async () => {
  const r = recorder();
  const res = await post({ ...base(), telefono: '' }, r);
  assert.equal(res.status, 422);
  const j = await res.json();
  assert.match(j.errores.telefono, /necesitamos tu teléfono/);
  assert.equal(r.calls.length, 0);
});

test('WhatsApp sin teléfono: 422', async () => {
  const res = await post({ ...base(), preferencia: 'whatsapp', telefono: '' }, recorder());
  assert.equal(res.status, 422);
});

test('correo sin email o con email inválido: 422', async () => {
  for (const email of ['', 'no-es-un-correo']) {
    const res = await post({ ...base(), preferencia: 'correo', email }, recorder());
    assert.equal(res.status, 422, email);
    assert.ok((await res.json()).errores.email);
  }
});

test('sin área elegida, sin privacidad o mensaje demasiado corto: 422 con cada error', async () => {
  const res = await post({ ...base(), area: '', privacidad: false, mensaje: 'Hola' }, recorder());
  const j = await res.json();
  assert.equal(res.status, 422);
  assert.ok(j.errores.area && j.errores.privacidad && j.errores.mensaje);
});

test('campos demasiado largos y cuerpo excesivo', async () => {
  assert.equal((await post({ ...base(), nombre: 'x'.repeat(101) }, recorder())).status, 422);
  assert.equal((await post({ ...base(), mensaje: 'x'.repeat(20_000) }, recorder())).status, 413);
});

test('campo trampa relleno o envío demasiado rápido: 200 sin entregar nada', async () => {
  for (const extra of [{ 'empresa-web': 'spam' }, { t: Date.now() }]) {
    const r = recorder();
    const res = await post({ ...base(), ...extra }, r);
    assert.equal(res.status, 200);
    assert.equal(r.calls.length, 0);
  }
});

test('si Netlify Forms falla, 502 (el navegador ofrece reintentar) y no se da por recibida', async () => {
  const res = await post(base(), recorder(500));
  assert.equal(res.status, 502);
  assert.equal((await res.json()).error, 'entrega');
  const caida = (async () => {
    throw new Error('red caída');
  }) as unknown as typeof fetch;
  assert.equal((await post(base(), { forward: caida })).status, 502);
});

test('sin JavaScript (formulario clásico): éxito redirige a /gracias/ y los errores muestran una página', async () => {
  const ok = await post({ nombre: 'Persona', email: '', telefono: '600000000', area: 'civil', mensaje: 'Consulta sobre una herencia sin repartir.', preferencia: 'llamada', privacidad: 'on' }, recorder(), 'application/x-www-form-urlencoded');
  assert.equal(ok.status, 303);
  assert.equal(ok.headers.get('location'), '/gracias/');
  const ko = await post({ nombre: 'Persona', preferencia: 'llamada' }, recorder(), 'application/x-www-form-urlencoded');
  assert.equal(ko.status, 422);
  assert.match(await ko.text(), /Revisa tu consulta/);
});

test('servicio preseleccionado: se entrega con su nombre; si no existe o no es del área, 422', async () => {
  const r = recorder();
  const ok = await post({ ...base(), servicio: 'transporte-portes-impagados' }, r);
  assert.equal(ok.status, 200);
  assert.equal(r.calls[0]!.body.get('servicio'), 'Reclamación de portes impagados');
  assert.equal((await post({ ...base(), servicio: 'no-existe' }, recorder())).status, 422);
  const mal = await post({ ...base(), area: 'familia', servicio: 'transporte-portes-impagados' }, recorder());
  assert.equal(mal.status, 422);
  assert.match((await mal.json()).errores.servicio, /no corresponde al área/);
});

test('transporte: papel, incidencia, importe y fecha se entregan con su etiqueta; en otra área se descartan', async () => {
  const r = recorder();
  const ok = await post({ ...base(), papel: 'transportista', incidencia: 'impago', importe: '3000-15000', fecha: '2026-09-15' }, r);
  assert.equal(ok.status, 200);
  const b = r.calls[0]!.body;
  assert.equal(b.get('papel'), 'Transportista (hago el porte)');
  assert.equal(b.get('incidencia'), 'Porte o factura impagada');
  assert.equal(b.get('importe'), 'Entre 3.000 y 15.000 €');
  assert.equal(b.get('fecha'), '2026-09-15');

  const r2 = recorder();
  await post({ ...base(), area: 'familia', papel: 'transportista', incidencia: 'impago', fecha: '2026-09-15' }, r2);
  assert.equal(r2.calls[0]!.body.get('papel'), '');
  assert.equal(r2.calls[0]!.body.get('fecha'), '');
});

test('transporte: valores fuera de lista o fechas imposibles o futuras dan 422', async () => {
  const r = recorder();
  for (const extra of [{ papel: 'pirata' }, { incidencia: 'x' }, { importe: '1000000' }, { fecha: '2026-02-31' }, { fecha: '15/09/2026' }, { fecha: '2999-01-01' }]) {
    const res = await post({ ...base(), ...extra }, r);
    assert.equal(res.status, 422, JSON.stringify(extra));
    const k = Object.keys(extra)[0]!;
    assert.ok((await res.json()).errores[k], k);
  }
  assert.equal(r.calls.length, 0);
});

test('laboral: «representa» es obligatorio; problema, situación y fecha llegan con su etiqueta y responsable Lucía', async () => {
  const r = recorder();
  const sin = await post({ ...base(), area: 'laboral' }, r);
  assert.equal(sin.status, 422);
  assert.ok((await sin.json()).errores.representa);
  const ok = await post({ ...base(), area: 'laboral', representa: 'trabajador', problema: 'despido', situacion: 'fuera', fecha: '2026-10-20', servicio: 'laboral-despidos' }, r);
  assert.equal(ok.status, 200);
  const b = r.calls[0]!.body;
  assert.equal(b.get('representa'), 'Soy la persona trabajadora');
  assert.equal(b.get('problema'), 'Despido o fin de contrato');
  assert.equal(b.get('situacion'), 'Ya no trabajo en la empresa');
  assert.equal(b.get('fecha'), '2026-10-20');
  assert.equal(b.get('servicio'), 'Despidos e impugnación');
  assert.equal(b.get('responsable'), 'Lucía López (649 181 290)');
  // En otra área, los datos laborales se descartan y no se exige «representa»
  const r2 = recorder();
  await post({ ...base(), representa: 'pirata', problema: 'despido' }, r2);
  assert.equal(r2.calls[0]!.body.get('representa'), '');
});

test('solo acepta POST', async () => {
  assert.equal((await handler(new Request('https://x/api/consulta'), recorder())).status, 405);
});
