// node --test src/lib/medicion.test.mts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatoDescarga, limpiarParametros, profundidadesNuevas, tiemposNuevos, tipoDePagina } from './medicion.ts';
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

test('cada umbral de desplazamiento se cuenta una sola vez', () => {
  const vistas = new Set<number>();
  assert.deepEqual(profundidadesNuevas(10, vistas), []);
  assert.deepEqual(profundidadesNuevas(60, vistas), [25, 50]);
  assert.deepEqual(profundidadesNuevas(60, vistas), []);
  assert.deepEqual(profundidadesNuevas(100, vistas), [75, 100]);
});

test('los parámetros nuevos pasan por la misma lista cerrada', () => {
  assert.deepEqual(limpiarParametros({ profundidad: '50', categoria: 'laboral', herramienta: 'calculadora_despido' }), { categoria: 'laboral', profundidad: '50', herramienta: 'calculadora_despido' });
  assert.deepEqual(limpiarParametros({ herramienta: 'ana@example.com', categoria: 'con espacios', importe: '12000' }), {});
});

test('parámetros de la ampliación y value numérico', () => {
  assert.deepEqual(limpiarParametros({ campo: 'nombre-telefono', tipo: 'llamada', tiempo: '60', metrica: 'lcp', valoracion: 'good', value: 1234.56789 }), {
    tipo: 'llamada', campo: 'nombre-telefono', tiempo: '60', metrica: 'lcp', valoracion: 'good', value: 1234.568,
  });
  assert.deepEqual(limpiarParametros({ value: Number.NaN, campo: 'Juan Pérez' }), {});
  assert.deepEqual(limpiarParametros({ value: '12' }), {});
});

test('tiempos de lectura una sola vez y formatos de descarga', () => {
  const vistos = new Set<number>();
  assert.deepEqual(tiemposNuevos(31, vistos), [15, 30]);
  assert.deepEqual(tiemposNuevos(65, vistos), [60]);
  assert.deepEqual(tiemposNuevos(65, vistos), []);
  assert.equal(formatoDescarga('/docs/modelo.PDF?v=2'), 'pdf');
  assert.equal(formatoDescarga('/blog/articulo/'), null);
});

test('tipo de página por su ruta', () => {
  assert.equal(tipoDePagina('/'), 'portada');
  assert.equal(tipoDePagina('/blog/categoria/familia/'), 'blog');
  assert.equal(tipoDePagina('/contacto/'), 'contacto');
  assert.equal(tipoDePagina('/aviso-legal/'), 'legal');
  assert.equal(tipoDePagina('/el-despacho/'), 'otra');
});
