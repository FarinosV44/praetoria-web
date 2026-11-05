// node --test src/lib/agentes/mcp.test.mts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarRuta, responderMcp, type FuenteMcp } from './mcp.ts';

const SITIO = 'https://praetoriaabogados.es';
const paginas: Record<string, string> = {
  '/contacto/': '# Contacto\n\nLlámanos.',
  '/impugnar-despido/': '# Impugnar un despido\n\nPlazo de veinte días.',
  '/deca/': '# DECA\n\nTambién habla de despido de pasada.',
};
const lecturas: string[] = [];
const fuente: FuenteMcp = {
  indice: () => [
    { ruta: '/contacto/', titulo: 'Contacto', descripcion: 'Habla con el despacho' },
    { ruta: '/deca/', titulo: 'DECA', descripcion: 'Documento de control' },
    { ruta: '/impugnar-despido/', titulo: 'Impugnar un despido', descripcion: 'Cómo reclamar' },
  ],
  leer: (r) => {
    lecturas.push(r);
    return paginas[r] ?? null;
  },
  contacto: { telefono: '+34960382362' },
  sitio: SITIO,
};
type Rpc = { result: { protocolVersion: string; capabilities: object; tools: { name: string; annotations: { readOnlyHint: boolean } }[]; content: [{ text: string }]; isError?: boolean }; error: { code: number } };
const rpc = (method: string, params?: object, id: number | undefined = 1) => responderMcp({ jsonrpc: '2.0', id, method, params }, fuente) as Rpc;
const llamar = (name: string, args: object) => rpc('tools/call', { name, arguments: args }).result;

test('initialize respeta una versión admitida y si no ofrece la última', () => {
  assert.equal(rpc('initialize', { protocolVersion: '2025-06-18' }).result.protocolVersion, '2025-06-18');
  assert.equal(rpc('initialize', { protocolVersion: '1999-01-01' }).result.protocolVersion, '2025-11-25');
  assert.deepEqual(rpc('initialize', {}).result.capabilities, { tools: { listChanged: false } });
});

test('las herramientas se anuncian como de solo lectura', () => {
  const { tools } = rpc('tools/list').result;
  assert.deepEqual(tools.map((t: { name: string }) => t.name), ['buscar_contenido', 'leer_pagina', 'datos_contacto']);
  for (const t of tools) assert.equal(t.annotations.readOnlyHint, true);
});

test('la búsqueda ignora acentos y prioriza el título sobre el cuerpo', () => {
  const r = JSON.parse(llamar('buscar_contenido', { consulta: 'DESPÍDO' }).content[0].text);
  assert.deepEqual(r.map((x: { ruta: string }) => x.ruta), ['/impugnar-despido/', '/deca/']);
  assert.equal(r[0].url, `${SITIO}/impugnar-despido/`);
});

test('la búsqueda respeta el límite y rechaza consultas no válidas', () => {
  assert.equal(JSON.parse(llamar('buscar_contenido', { consulta: 'despido', limite: 1 }).content[0].text).length, 1);
  assert.equal(llamar('buscar_contenido', { consulta: 'x' }).isError, true);
  assert.equal(llamar('buscar_contenido', {}).isError, true);
});

test('leer_pagina acepta ruta o URL del sitio', () => {
  assert.match(llamar('leer_pagina', { ruta: '/contacto' }).content[0].text, /Llámanos/);
  assert.match(llamar('leer_pagina', { ruta: `${SITIO}/contacto/?a=1` }).content[0].text, /Llámanos/);
});

test('leer_pagina no sale del índice: ni traversal, ni portal, ni otros dominios', () => {
  lecturas.length = 0;
  for (const ruta of ['../../.env.local', '/admin/', '/gracias/', 'https://evil.example/contacto/', 'http://[malformada']) {
    assert.equal(llamar('leer_pagina', { ruta }).isError, true, ruta);
  }
  assert.deepEqual(lecturas, []);
});

test('normalizarRuta', () => {
  assert.equal(normalizarRuta('contacto', SITIO), '/contacto/');
  assert.equal(normalizarRuta('/', SITIO), '/');
  assert.equal(normalizarRuta(`${SITIO}/blog/#a`, SITIO), '/blog/');
  assert.equal(normalizarRuta('https://otro.es/blog/', SITIO), null);
});

test('errores JSON-RPC y notificaciones', () => {
  assert.equal(rpc('no/existe').error.code, -32601);
  assert.equal(rpc('tools/call', { name: 'enviar_formulario' }).error.code, -32602);
  assert.equal((responderMcp({ id: 1 }, fuente) as { error: { code: number } }).error.code, -32600);
  assert.equal((responderMcp([], fuente) as { error: { code: number } }).error.code, -32600);
  assert.equal(responderMcp({ jsonrpc: '2.0', method: 'notifications/initialized' }, fuente), null);
});
