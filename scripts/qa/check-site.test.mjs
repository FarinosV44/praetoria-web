// Pruebas negativas del comprobador: cada defecto debe detectarse y una web sana debe pasar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';

const SITE = 'https://praetoriaabogados.es';
const script = new URL('./check-site.mjs', import.meta.url).pathname;

const page = (path, { title = 'Título', body = '<h1>Uno</h1>', desc = 'Una descripción suficientemente larga para pasar la comprobación de longitud.', lang = 'es', extra = '' } = {}) =>
  `<!DOCTYPE html><html lang="${lang}"><head><title>${title}</title><meta name="description" content="${desc}"/><link rel="canonical" href="${SITE}${path}"/>${extra}</head><body><main>${body}</main></body></html>`;

function site(files, { sitemap, blog = {}, appDirs = [] } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'qa-'));
  const out = join(root, 'out');
  const all = { '/index.html': page('/'), '/404.html': page('/404.html', { extra: '' }), ...files };
  for (const [p, c] of Object.entries(all)) {
    mkdirSync(dirname(join(out, p)), { recursive: true });
    writeFileSync(join(out, p), c);
  }
  const pages = Object.keys(all).filter((p) => p.endsWith('/index.html')).map((p) => p.replace(/index\.html$/, ''));
  const locs = sitemap ?? pages.filter((p) => p !== '/gracias/');
  writeFileSync(join(out, 'sitemap.xml'), `<urlset>${locs.map((l) => `<url><loc>${SITE}${l}</loc></url>`).join('')}</urlset>`);
  writeFileSync(join(out, 'rss.xml'), '<rss></rss>');
  mkdirSync(join(root, 'src/content/blog'), { recursive: true });
  for (const d of ['blog', ...appDirs]) mkdirSync(join(root, 'src/app', d), { recursive: true });
  for (const [slug, fm] of Object.entries(blog)) writeFileSync(join(root, 'src/content/blog', slug + '.md'), `---\n${fm}\n---\n\nTexto`);
  return root;
}

const run = (root) => {
  const r = spawnSync(process.execPath, [script, join(root, 'out'), '--src', root], { encoding: 'utf8' });
  return { code: r.status, out: r.stdout + r.stderr };
};

test('una web sana pasa', () => {
  const r = run(site({ '/a/index.html': page('/a/', { body: '<h1>A</h1><a href="/">Inicio</a><a href="#x">ir</a><p id="x"></p>' }) }));
  assert.equal(r.code, 0, r.out);
});

const cases = [
  ['enlace interno roto', { '/a/index.html': page('/a/', { body: '<h1>A</h1><a href="/no-existe/">x</a>' }) }, 'enlace interno inexistente: /no-existe/'],
  ['imagen de srcset inexistente', { '/a/index.html': page('/a/', { body: '<h1>A</h1><img alt="" srcset="/media/x-800.webp 800w, /media/x.webp 1600w">' }) }, '/media/x-800.webp'],
  ['ancla inexistente en la misma página', { '/a/index.html': page('/a/', { body: '<h1>A</h1><a href="#nada">x</a>' }) }, 'ancla inexistente: #nada'],
  ['ancla inexistente en otra página', { '/a/index.html': page('/a/', { body: '<h1>A</h1><a href="/#nada">x</a>' }) }, 'ancla inexistente: /#nada'],
  ['dos h1', { '/a/index.html': page('/a/', { body: '<h1>A</h1><h1>B</h1>' }) }, 'único <h1>'],
  ['imagen sin alt', { '/a/index.html': page('/a/', { body: '<h1>A</h1><img src="/index.html">' }) }, 'imagen sin alt'],
  ['ids duplicados', { '/a/index.html': page('/a/', { body: '<h1 id="x">A</h1><p id="x"></p>' }) }, 'ids duplicados: x'],
  ['descripción corta', { '/a/index.html': page('/a/', { desc: 'Corta' }) }, 'meta description ausente o demasiado corta'],
  ['canonical incorrecta', { '/a/index.html': page('/a/').replace(`${SITE}/a/`, `${SITE}/b/`) }, 'canonical'],
  ['JSON-LD inválido', { '/a/index.html': page('/a/', { extra: '<script type="application/ld+json">{roto</script>' }) }, 'JSON-LD no válido'],
  ['JSON-LD sin campos obligatorios', { '/a/index.html': page('/a/', { extra: '<script type="application/ld+json">{"@type":"BlogPosting","headline":"x"}</script>' }) }, 'BlogPosting sin datePublished'],
  ['idioma del documento distinto del artículo', { '/a/index.html': page('/a/', { body: '<article lang="fr"><h1>A</h1></article>' }) }, 'no coincide con el contenido (fr)'],
];
for (const [name, files, expected] of cases) {
  test(`detecta: ${name}`, () => {
    const r = run(site(files));
    assert.equal(r.code, 1, r.out);
    assert.ok(r.out.includes(expected), `esperaba «${expected}» en:\n${r.out}`);
  });
}

test('detecta: página indexable fuera del sitemap', () => {
  const r = run(site({ '/a/index.html': page('/a/') }, { sitemap: ['/'] }));
  assert.ok(r.out.includes('página indexable fuera del sitemap: /a/'), r.out);
});
test('detecta: sitemap con una URL que no es página', () => {
  const r = run(site({}, { sitemap: ['/', '/fantasma/'] }));
  assert.ok(r.out.includes('no es una página indexable: /fantasma/'), r.out);
});
test('detecta: borrador publicado', () => {
  const r = run(site({ '/borrador/index.html': page('/borrador/') }, { blog: { borrador: 'title: x\ndraft: true' } }));
  assert.ok(r.out.includes('borrador publicado: /borrador/'), r.out);
});
test('detecta: colisión de un artículo con una ruta propia', () => {
  const r = run(site({}, { blog: { contacto: 'title: x' }, appDirs: ['contacto'] }));
  assert.ok(r.out.includes('colisión de ruta'), r.out);
});
test('detecta: JavaScript por encima del presupuesto', () => {
  const big = Array.from({ length: 60000 }, (_, i) => `var v${i}=${Math.random()};`).join('');
  const r = run(site({ '/a/index.html': page('/a/', { extra: '<script src="/big.js" async></script>' }), '/big.js': big }));
  assert.ok(r.out.includes('JavaScript') && r.out.includes('presupuesto'), r.out);
});
