// node --test src/lib/medicion.test.mts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { limpiarParametros } from './medicion.ts';
import { rutaLimpia, utmLimpio } from './atribucion.ts';
import { validarConsulta } from './consulta.ts';

test('los parámetros de analítica solo admiten claves de la lista y valores seguros', () => {
  const p = limpiarParametros({
    area: 'Laboral',
    servicio: 'laboral-despidos',
    landing: '/impugnar-despido/',
    nombre: 'Ana Pérez',
    email: 'ana@example.com',
    telefono: '600000000',
    mensaje: 'Me han despedido',
    ubicacion: 'ana@example.com',
    destino: 'tel con espacios',
  });
  assert.deepEqual(p, { area: 'laboral', servicio: 'laboral-despidos', landing: '/impugnar-despido/' });
});

test('atribución: rutas sin consulta y UTM cortos y seguros', () => {
  assert.equal(rutaLimpia('/impugnar-despido/?email=a@b.c#x'), '/impugnar-despido/');
  assert.equal(rutaLimpia('https://otro.es/'), '');
  assert.equal(utmLimpio(' Google '), 'google');
  assert.equal(utmLimpio('ana@example.com'), '');
  assert.equal(utmLimpio('x'.repeat(61)), '');
});

test('la consulta descarta (sin bloquear) atribución no válida', () => {
  const base = { nombre: 'Persona', area: 'civil', mensaje: 'Una consulta de prueba suficientemente larga.', preferencia: 'correo', email: 'p@example.com', privacidad: true, id: 'abc12345-x' };
  const ok = validarConsulta({ ...base, origen: '/derecho-civil/', landing: '/herencia-que-hacer/?utm_source=x', utm_source: 'Newsletter', utm_campaign: 'otoño 2026', utm_medium: 'a@b.c' });
  assert.ok(ok.ok);
  if (ok.ok) {
    assert.equal(ok.data.origen, '/derecho-civil/');
    assert.equal(ok.data.landing, '/herencia-que-hacer/');
    assert.equal(ok.data.utm_source, 'newsletter');
    assert.equal(ok.data.utm_campaign, '');
    assert.equal(ok.data.utm_medium, '');
  }
});
