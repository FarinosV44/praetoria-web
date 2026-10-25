// Pruebas de la solicitud de llamada (#33): node --test netlify/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from './functions/llamada.mts';
import { validarLlamada } from '../src/lib/llamada.ts';

const enUnMes = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
const base = () => ({
  nombre: 'Persona de prueba',
  telefono: '600 000 000',
  area: 'penal',
  motivo: 'citacion',
  privacidad: true,
  id: 'llam1234-test',
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
    new Request('https://ejemplo.netlify.app/api/llamada', {
      method: 'POST',
      headers: { 'Content-Type': type },
      body: type === 'application/json' ? JSON.stringify(data) : new URLSearchParams(data as Record<string, string>).toString(),
    }),
    ctx,
  );

test('solicitud válida: llega a «llamada-urgente» con prioridad URGENTE y en el mismo despliegue', async () => {
  const r = recorder();
  const res = await post({ ...base(), fecha: enUnMes, servicio: 'penal-citacion', seguro: 'sin-mensajes' }, r);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, id: 'llam1234-test' });
  assert.equal(r.calls[0]!.url, 'https://ejemplo.netlify.app/__forms.html');
  const b = r.calls[0]!.body;
  assert.equal(b.get('form-name'), 'llamada-urgente');
  assert.equal(b.get('prioridad'), 'URGENTE');
  assert.equal(b.get('area'), 'Penal');
  assert.equal(b.get('servicio'), 'Citaciones y juicios rápidos');
  assert.equal(b.get('motivo'), 'Citación del juzgado o de la policía');
  assert.equal(b.get('seguro'), 'Solo llamada: sin mensajes, SMS ni WhatsApp');
  assert.equal(b.get('responsable'), 'Juan José Farinós Ibáñez (607 527 719)');
});

test('laboral: formulario propio y responsable del área laboral', async () => {
  const r = recorder();
  await post({ ...base(), area: 'laboral', motivo: 'plazo' }, r);
  assert.equal(r.calls[0]!.body.get('form-name'), 'llamada-urgente-laboral');
  assert.equal(r.calls[0]!.body.get('responsable'), 'Lucía López (649 181 290)');
});

test('teléfono obligatorio y motivo de la lista; nada se entrega si no valida', async () => {
  const r = recorder();
  const res = await post({ ...base(), telefono: '', motivo: 'inventado' }, r);
  assert.equal(res.status, 422);
  const body = await res.json();
  assert.ok(body.errores.telefono && body.errores.motivo);
  assert.equal(r.calls.length, 0);
});

test('la fecha de una citación puede ser futura; un servicio de otra área se descarta sin bloquear', () => {
  const v = validarLlamada({ ...base(), fecha: enUnMes, servicio: 'laboral-despidos' });
  assert.ok(v.ok);
  if (v.ok) assert.equal(v.data.servicio, '');
  assert.equal(validarLlamada({ ...base(), fecha: '2099-01-01' }).ok, false); // más de dos años: no es una fecha plausible
});

test('si Netlify Forms falla, 502 y el navegador ofrece reintentar (no se confirma)', async () => {
  const res = await post(base(), recorder(500));
  assert.equal(res.status, 502);
  assert.equal((await res.json()).ok, false);
});

test('envío automático (campo trampa): 200 silencioso sin entregar', async () => {
  const r = recorder();
  const res = await post({ ...base(), 'empresa-web': 'spam' }, r);
  assert.equal(res.status, 200);
  assert.equal(r.calls.length, 0);
});
