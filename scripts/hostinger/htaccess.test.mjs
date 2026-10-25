import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reglas } from './htaccess.mjs';

test('traduce las reglas de Netlify a mod_rewrite', () => {
  const r = reglas(['# comentario', '/sobre-mi/  /el-despacho/  301', '/tag/x/*  /blog/  301', '/:slug/feed/  /:slug/  301', '/tag/%D8%A7/*  /ar/  301'].join('\n'));
  assert.ok(r.includes('RewriteRule ^sobre-mi/?$ /el-despacho/ [R=301,L,NE]'));
  assert.ok(r.includes('RewriteRule ^tag/x(?:/.*)?$ /blog/ [R=301,L,NE]'));
  assert.ok(r.includes('RewriteRule ^([^/]+)/feed/?$ /$1/ [R=301,L,NE]'));
  assert.equal(r.filter((l) => l.includes('%D8')).length, 0); // el duplicado codificado no se traslada
  assert.equal(r.filter((l) => l.startsWith('RewriteCond')).length, 6); // no pisa archivos ni carpetas existentes
});
