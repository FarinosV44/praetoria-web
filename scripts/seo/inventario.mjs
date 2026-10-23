// Valida la migración SEO sobre la web ya construida y genera la matriz de URLs.
//
//   node scripts/seo/inventario.mjs [carpeta_salida] [--write]
//
// - Comprueba las reglas de _redirects: destinos existentes, reglas tapadas por páginas, cadenas y bucles.
// - Resuelve cada URL conocida de WordPress (sitemap en vivo, export de la API, categorías, etiquetas,
//   imágenes) contra la web nueva y decide si el resultado es el esperado.
// - Comprueba el sitemap nuevo, las canonical y la indexabilidad según SITE_INDEXABLE.
// - Con --write escribe docs/seo/inventario-urls.csv.
// Sale con código 1 si hay errores, para que la CI falle.
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { listOutput, readRedirects, resolve, servesFile } from './redirects-lib.mjs';
import { createEngine } from './netlify-engine.mjs';

const root = new URL('../../', import.meta.url).pathname;
const args = process.argv.slice(2);
const outDir = join(root, args.find((a) => !a.startsWith('--')) || 'out');
const write = args.includes('--write');
const SITE = 'https://praetoriaabogados.es';
const indexable = process.env.SITE_INDEXABLE === 'true';

const files = listOutput(outDir);
const rules = readRedirects(outDir);
const errors = [];
const engine = await createEngine(outDir, join(root, 'netlify.toml'));
engine.parseErrors.forEach((e) => errors.push(`Motor de Netlify: regla no válida: ${e}`));
const warn = [];

const wp = JSON.parse(readFileSync(join(root, 'docs/seo/fuentes/wordpress-export-2026-10-23.json'), 'utf8'));
const crawl = JSON.parse(readFileSync(join(root, 'docs/seo/fuentes/wordpress-rastreo-2026-10-23.json'), 'utf8')).filas;

const htmlFor = (path) => {
  const p = path.endsWith('/') ? path + 'index.html' : path;
  const f = join(outDir, decodeURI(p));
  return existsSync(f) ? readFileSync(f, 'utf8') : null;
};
const meta = (html) => {
  if (!html) return {};
  const pick = (re) => (html.match(re) || [])[1]?.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'") || '';
  return {
    title: pick(/<title>([^<]*)<\/title>/),
    description: pick(/<meta name="description" content="([^"]*)"/),
    canonical: pick(/<link rel="canonical" href="([^"]*)"/),
    robots: pick(/<meta name="robots" content="([^"]*)"/),
    lang: pick(/<html[^>]* lang="([^"]+)"/),
  };
};

// 1. Reglas de redirección -------------------------------------------------------------------
for (const r of rules) {
  const sample = r.from.replace(/\/\*$/, '/').replace(/:[a-z]+/gi, 'x');
  if (!r.force && servesFile(files, sample) && !r.from.includes(':')) {
    errors.push(`Regla tapada por una página existente (línea ${r.line}): ${r.from}`);
  }
  if (r.status >= 300 && r.status < 400 && !r.to.includes(':') && r.to.startsWith('/')) {
    const res = resolve(files, rules, r.to);
    if (res.status !== 200) errors.push(`Destino que no responde 200 (línea ${r.line}): ${r.from} -> ${r.to} (${res.status})`);
    else if (res.hops.length) errors.push(`Cadena de redirecciones (línea ${r.line}): ${r.from} -> ${r.to} -> ${res.final}`);
  }
}

// 2. Inventario de URLs antiguas -----------------------------------------------------------------
const rows = new Map();
const add = (path, data) => {
  const key = path;
  rows.set(key, { ...(rows.get(key) || {}), ...data, ruta_antigua: path });
};
const pathOf = (u) => decodeURI(new URL(u, SITE).pathname);

for (const c of crawl) {
  add(c.ruta, {
    tipo: c.en_sitemap ? 'sitemap WordPress' : 'control',
    en_sitemap_wp: c.en_sitemap ? 'sí' : 'no',
    estado_wp: c.redirige_a ? `301 -> ${c.redirige_a}` : String(c.estado),
    title_wp: c.title,
    description_wp: c.meta_description,
    robots_wp: c.robots,
  });
}
for (const pg of wp.pages) {
  const path = pathOf(pg.link);
  add(path, { tipo: rows.get(path)?.tipo || 'página (export)', wp_id: pg.id });
}
for (const ps of wp.posts) {
  const path = pathOf(ps.link);
  add(path, { tipo: rows.get(path)?.tipo === 'sitemap WordPress' ? 'artículo' : 'artículo (export)', wp_id: ps.id });
}
for (const r of rows.values()) if (r.tipo === 'sitemap WordPress') r.tipo = 'página';
for (const c of wp.categories) {
  const parent = c.parent ? wp.categories.find((x) => x.id === c.parent).slug + '/' : '';
  add(`/category/${parent}${c.slug}/`, { tipo: 'categoría', wp_id: c.id, notas: `${c.count} artículos` });
}
for (const t of wp.tags) add(decodeURI(`/tag/${t.slug}/`), { tipo: 'etiqueta', wp_id: t.id, notas: `${t.count} artículos` });
for (const m of wp.media) add(pathOf(m.source_url), { tipo: 'imagen/archivo', wp_id: m.id });
// Variantes de URL que deben comportarse igual
add('/sobre-mi', { tipo: 'variante sin barra' });
add('/derecho-civil', { tipo: 'variante sin barra' });
add('/feed/', { tipo: 'feed' });

const expected = (r, res) => {
  if (r.tipo === 'imagen/archivo') return res.status === 200 ? 'migrada' : 'no migrada (404)';
  if (r.tipo === 'etiqueta' && /^0 /.test(r.notas || '')) return '404 (sin artículos)';
  if (r.ruta_antigua === '/gracias/') return '200 noindex (página de confirmación nueva; en WordPress era 404)';
  if (r.ruta_antigua.startsWith('/author/')) return '404 (ya era 404 en WordPress)';
  if (r.ruta_antigua === '/wp-login.php' || r.ruta_antigua === '/sitemap_index.xml') return '404 (sistema WordPress)';
  if (r.ruta_antigua === '/' && r.tipo === 'control') return '200';
  return res.status === 200 ? '200' : '301 a equivalente';
};

for (const r of rows.values()) {
  const res = resolve(files, rules, encodeURI(r.ruta_antigua));
  const off = engine.resolve(files, encodeURI(r.ruta_antigua));
  const same = String(off.status) === String(res.status) && off.final === res.final && off.hops.length === res.hops.length;
  if (!same) errors.push(`${r.ruta_antigua}: la simulación (${res.status} ${res.final}) y el motor de Netlify (${off.status} ${off.final}) no coinciden`);
  const via = res.hops.map((h) => `${h.status}`).join('>');
  const final = res.status === 200 ? res.final : res.final;
  const m = res.status === 200 ? meta(htmlFor(final)) : {};
  const exp = expected(r, res);
  let resultado = 'ok';
  if (res.status === 'bucle' || res.status === 'cadena') resultado = 'ERROR: ' + res.status;
  else if (res.hops.filter((h) => !h.reason).length > 1) resultado = 'ERROR: cadena de redirecciones';
  else if (res.status === 404 && !exp.startsWith('404') && !exp.startsWith('no migrada')) resultado = 'ERROR: se pierde (404)';
  else if (res.status === 200 && exp.startsWith('404')) resultado = 'revisar: esperado 404';
  if (resultado.startsWith('ERROR')) errors.push(`${r.ruta_antigua}: ${resultado} (${res.status} ${final})`);
  Object.assign(r, {
    estado_nuevo: res.status === 200 ? (via ? `${via}>200` : '200') : String(res.status),
    url_nueva: res.status === 200 || res.status === 404 ? final : final,
    decision: exp,
    resultado,
    title_nuevo: m.title || '',
    description_nueva: m.description || '',
    canonical_nueva: m.canonical || '',
    motor_netlify: same ? 'coincide' : `difiere: ${off.status} ${off.final}`,
    trafico: 'sin datos: falta export de Search Console / DinoRANK',
  });
}

// 3. Páginas nuevas sin equivalente antiguo ------------------------------------------------------
const htmlPages = [...files].filter((f) => f.endsWith('/index.html')).map((f) => f.replace(/index\.html$/, ''));
for (const p of htmlPages) {
  if (rows.has(p)) continue;
  const m = meta(htmlFor(p));
  rows.set(p, {
    ruta_antigua: '', tipo: 'nueva', estado_nuevo: '200', url_nueva: p, decision: 'nueva página', resultado: 'ok',
    title_nuevo: m.title, description_nueva: m.description, canonical_nueva: m.canonical, trafico: '',
  });
}

// 4. Sitemap, canonical e indexabilidad -----------------------------------------------------------
const sitemapFiles = [...files].filter((f) => /sitemap.*\.xml$/.test(f));
const sitemapLocs = sitemapFiles
  .flatMap((f) => [...readFileSync(join(outDir, f), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]))
  .filter((u) => !u.endsWith('.xml'));
if (!sitemapLocs.length) errors.push('No se encuentra ningún sitemap con URLs en la salida');
for (const loc of sitemapLocs) {
  const path = new URL(loc).pathname;
  const res = resolve(files, rules, path);
  if (res.status !== 200 || res.hops.length) errors.push(`Sitemap con URL que no responde 200 directo: ${loc}`);
  if (/\/(gracias|404)\//.test(path)) errors.push(`Sitemap incluye una página que no debe indexarse: ${loc}`);
}
for (const p of htmlPages) {
  const m = meta(htmlFor(p));
  if (p === '/404/' || p === '/gracias/') {
    if (!/noindex/.test(m.robots)) errors.push(`${p} debe llevar noindex`);
    continue;
  }
  if (m.canonical && m.canonical !== SITE + p) errors.push(`Canonical incorrecta en ${p}: ${m.canonical}`);
  if (!indexable && !/noindex/.test(m.robots)) errors.push(`Build no indexable pero ${p} no lleva noindex (SITE_INDEXABLE != true)`);
  if (indexable && /noindex/.test(m.robots)) errors.push(`Build de producción con noindex en ${p}`);
}
const robotsTxt = files.has('/robots.txt') ? readFileSync(join(outDir, 'robots.txt'), 'utf8') : '';
if (indexable && !/Sitemap:/.test(robotsTxt)) errors.push('robots.txt de producción sin línea Sitemap');
if (!indexable) {
  const headers = files.has('/_headers') ? readFileSync(join(outDir, '_headers'), 'utf8') : '';
  if (!/X-Robots-Tag:\s*noindex/i.test(headers)) errors.push('Build no indexable sin cabecera X-Robots-Tag: noindex en _headers');
}

// 5. Salida ----------------------------------------------------------------------------------------
const cols = ['ruta_antigua', 'tipo', 'wp_id', 'en_sitemap_wp', 'estado_wp', 'title_wp', 'description_wp', 'robots_wp',
  'url_nueva', 'estado_nuevo', 'decision', 'resultado', 'motor_netlify', 'canonical_nueva', 'title_nuevo', 'description_nueva', 'trafico', 'notas'];
const csvCell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const order = { 'página': 0, 'artículo': 1, 'categoría': 2, 'etiqueta': 3, feed: 4, 'variante sin barra': 5, control: 6, 'imagen/archivo': 7, nueva: 8 };
const sorted = [...rows.values()].sort((a, b) => (order[a.tipo] ?? 9) - (order[b.tipo] ?? 9) || (a.ruta_antigua || a.url_nueva).localeCompare(b.ruta_antigua || b.url_nueva));
if (write) {
  const csv = [cols.join(','), ...sorted.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n') + '\n';
  writeFileSync(join(root, 'docs/seo/inventario-urls.csv'), csv);
}

const count = (fn) => sorted.filter(fn).length;
console.log(`Motor oficial de Netlify: ${engine.rules} reglas cargadas, contraste con la simulación en cada URL`);
console.log(`Salida analizada: ${outDir.replace(root, '')} (${htmlPages.length} páginas HTML, ${rules.length} reglas, ${sitemapLocs.length} URLs en sitemap)`);
console.log(`Indexable: ${indexable ? 'sí (SITE_INDEXABLE=true)' : 'no (preview/por defecto)'}`);
console.log(`URLs antiguas inventariadas: ${count((r) => r.ruta_antigua)} · nuevas: ${count((r) => r.tipo === 'nueva')}`);
console.log(`  200 directo: ${count((r) => r.ruta_antigua && r.estado_nuevo === '200')} · redirigidas: ${count((r) => r.ruta_antigua && /^30/.test(r.estado_nuevo))} · 404 previstos: ${count((r) => r.ruta_antigua && r.estado_nuevo === '404' && r.resultado === 'ok')}`);
warn.forEach((w) => console.log('AVISO ' + w));
if (errors.length) {
  console.error(`\n${errors.length} errores:`);
  errors.forEach((e) => console.error(' - ' + e));
  engine.close();
  process.exit(1);
}
engine.close();
console.log('OK: migración SEO sin errores detectables en local' + (write ? ' · CSV actualizado' : ''));
