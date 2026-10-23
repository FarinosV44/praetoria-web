// Pruebas del intérprete de _redirects: node --test scripts/seo/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRedirects, resolve } from './redirects-lib.mjs';

const files = new Set(['/index.html', '/blog/index.html', '/el-despacho/index.html', '/blog/categoria/transporte/index.html', '/rss.xml']);
const rules = parseRedirects(`
# comentario
/sobre-mi/            /el-despacho/   301
/category/x/          /blog/categoria/transporte/ 301
/category/x/*         /blog/categoria/transporte/ 301
/:slug/feed/          /:slug/         301
/blog/                /el-despacho/   301
/a/                   /b/             301
/b/                   /el-despacho/   301
/bucle1/              /bucle2/        301
/bucle2/              /bucle1/        301
`);

test('barra final opcional en el origen', () => {
  assert.equal(resolve(files, rules, '/sobre-mi').final, '/el-despacho/');
  assert.equal(resolve(files, rules, '/sobre-mi/').final, '/el-despacho/');
});
test('comodín y paginación de categorías', () => {
  const r = resolve(files, rules, '/category/x/page/3/');
  assert.equal(r.status, 200);
  assert.equal(r.final, '/blog/categoria/transporte/');
});
test('marcador :slug', () => {
  assert.equal(resolve(files, rules, '/el-despacho/feed/').final, '/el-despacho/');
});
test('una página existente tapa la regla no forzada', () => {
  const r = resolve(files, rules, '/blog/');
  assert.equal(r.status, 200);
  assert.equal(r.hops.length, 0);
});
test('detecta cadenas', () => {
  const r = resolve(files, rules, '/a/');
  assert.equal(r.hops.length, 2);
});
test('detecta bucles', () => {
  assert.equal(resolve(files, rules, '/bucle1/').status, 'bucle');
});
test('404 cuando no hay archivo ni regla', () => {
  assert.equal(resolve(files, rules, '/wp-login.php').status, 404);
});
test('carpeta sin barra recibe 301 a la versión con barra', () => {
  const r = resolve(files, rules, '/el-despacho');
  assert.equal(r.status, 200);
  assert.equal(r.final, '/el-despacho/');
});
test('rutas codificadas en mayúsculas o minúsculas son equivalentes', () => {
  const rr = parseRedirects('/tag/%d8%a7/  /blog/  301');
  assert.equal(resolve(files, rr, '/tag/%D8%A7/').final, '/blog/');
});
