// Comprobaciones de calidad sobre la web generada (out/). Sustituye a check-links.mjs.
//   node scripts/qa/check-site.mjs [carpeta] [--src <raíz del repo>]
// Falla (código 1) si encuentra errores. Cada comprobación tiene su prueba negativa en check-site.test.mjs.
//
//  1. Enlaces y recursos internos: href, src, srcset, hojas de estilo, iconos y og:image existen.
//  2. Anclas: #id en la misma página o en otra (/ruta/#id) existe en el destino.
//  3. Cada página: un <title>, meta description, canonical, un único <h1>, alt en todas las imágenes, ids únicos.
//  4. JSON-LD: válido y con los campos que exige su tipo.
//  5. Idioma: <html lang> coincide con el del <article>; og:locale coherente.
//  6. Sitemap = páginas indexables (todas salvo /gracias/ y la 404), sin duplicados.
//  7. Borradores (draft: true) ausentes de la salida, del sitemap y del RSS.
//  8. Colisiones: ningún artículo usa el slug de una ruta propia (src/app/<carpeta>).
//  9. Presupuesto de peso (gzip) de HTML, CSS y JavaScript por página.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const args = process.argv.slice(2);
const dir = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--src') || 'out';
const srcRoot = args.includes('--src') ? args[args.indexOf('--src') + 1] : '.';
const SITE = 'https://praetoriaabogados.es';
const BUDGET = { html: 40_000, css: 20_000, js: 160_000 }; // bytes gzip por página (JS moderno, sin nomodule)

const errors = [];
const err = (page, msg) => errors.push(`${page}: ${msg}`);
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const files = walk(dir).map((f) => f.slice(dir.length).split('\\').join('/'));
const fileSet = new Set(files);
// Archivos HTML de sistema que no son páginas (ninguno desde que los formularios se reciben en Hostinger)
const SYSTEM = new Set([]);
const pages = files.filter((f) => f.endsWith('.html') && !SYSTEM.has(f));
const pageOf = (f) => (f.endsWith('/index.html') ? f.slice(0, -'index.html'.length) : f);
const read = (f) => readFileSync(join(dir, f), 'utf8');
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'");

// La salida servible: /x/ -> /x/index.html, /x.ext -> archivo
const resolveFile = (url) => {
  const p = decodeURI(url.split('#')[0].split('?')[0]);
  if (fileSet.has(p)) return p;
  const withIndex = (p.endsWith('/') ? p : p + '/') + 'index.html';
  return fileSet.has(withIndex) ? withIndex : null;
};

// HTML visible: sin <script> ni <template> (Next incluye una copia serializada de la página en scripts)
const visible = (html) => html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<template[\s\S]*?<\/template>/g, '');
const idsCache = new Map();
const idsOf = (f) => {
  if (!idsCache.has(f)) idsCache.set(f, [...visible(read(f)).matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  return idsCache.get(f);
};

for (const f of pages) {
  const page = pageOf(f);
  const html = read(f);
  const vis = visible(html);
  const isError = f === '/404.html';

  // 1. Recursos internos
  const refs = [
    ...[...vis.matchAll(/\s(?:href|src)="([^"]+)"/g)].map((m) => decode(m[1])),
    ...[...vis.matchAll(/\ssrcset="([^"]+)"/g)].flatMap((m) => m[1].split(',').map((c) => c.trim().split(/\s+/)[0])),
  ];
  const og = (html.match(/<meta property="og:image" content="([^"]+)"/) || [])[1];
  if (og) refs.push(og.startsWith(SITE) ? og.slice(SITE.length) : og);
  for (const url of refs) {
    if (!url.startsWith('/') || url.startsWith('//')) continue;
    if (!resolveFile(url)) err(page, `recurso o enlace interno inexistente: ${url}`);
  }

  // 2. Anclas
  for (const m of vis.matchAll(/\shref="([^"]*#[^"]+)"/g)) {
    const href = decode(m[1]);
    if (!href.startsWith('/') && !href.startsWith('#')) continue;
    const [path, id] = href.split('#');
    const target = path ? resolveFile(path) : f;
    if (target && !idsOf(target).includes(decodeURIComponent(id))) err(page, `ancla inexistente: ${href}`);
  }

  // 3. Estructura de la página
  const titles = html.match(/<title>[^<]*<\/title>/g) || [];
  if (titles.length !== 1 || titles[0] === '<title></title>') err(page, `debe tener un único <title> no vacío (tiene ${titles.length})`);
  const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1];
  if (!desc || desc.length < 50) err(page, `meta description ausente o demasiado corta (${desc?.length ?? 0} caracteres)`);
  if (!isError) {
    const canon = (html.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
    if (canon !== SITE + page) err(page, `canonical ${canon} ≠ ${SITE + page}`);
  }
  const main = (vis.match(/<main[^>]*>([\s\S]*?)<\/main>/) || [])[1] ?? '';
  const h1 = (main.match(/<h1[\s>]/g) || []).length;
  if (h1 !== 1) err(page, `debe tener un único <h1> en <main> (tiene ${h1})`);
  for (const m of vis.matchAll(/<img\b([^>]*)>/g)) if (!/\salt="/.test(m[1])) err(page, `imagen sin alt: ${m[0].slice(0, 80)}`);
  const ids = idsOf(f);
  const dupIds = ids.filter((x, i) => ids.indexOf(x) !== i);
  if (dupIds.length) err(page, `ids duplicados: ${[...new Set(dupIds)].join(', ')}`);

  // 4. JSON-LD
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let data;
    try {
      data = JSON.parse(m[1]);
    } catch (e) {
      err(page, `JSON-LD no válido: ${e.message}`);
      continue;
    }
    const need = {
      LegalService: ['name', 'url', 'telephone', 'address'],
      BlogPosting: ['headline', 'datePublished', 'author', 'mainEntityOfPage'],
      BreadcrumbList: ['itemListElement'],
      FAQPage: ['mainEntity'],
      Person: ['name'],
    }[data['@type']];
    if (!need) err(page, `JSON-LD de tipo no previsto: ${data['@type']}`);
    else for (const k of need) if (data[k] == null || (Array.isArray(data[k]) && !data[k].length)) err(page, `JSON-LD ${data['@type']} sin ${k}`);
  }

  // 5. Idioma
  const docLang = (html.match(/<html[^>]* lang="([^"]+)"/) || [])[1];
  const artLang = (vis.match(/<article lang="([^"]+)"/) || [])[1] ?? 'es';
  if (docLang !== artLang) err(page, `<html lang="${docLang}"> no coincide con el contenido (${artLang})`);
  const locale = (html.match(/<meta property="og:locale" content="([^"]+)"/) || [])[1];
  if (locale && !locale.startsWith(artLang + '_')) err(page, `og:locale ${locale} no coincide con el idioma ${artLang}`);
}

// 6. Sitemap
const sitemapXml = fileSet.has('/sitemap.xml') ? read('/sitemap.xml') : '';
const locs = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(SITE, ''));
if (!locs.length) errors.push('sitemap.xml ausente o vacío');
const dupLocs = locs.filter((x, i) => locs.indexOf(x) !== i);
if (dupLocs.length) errors.push(`sitemap con URLs duplicadas: ${dupLocs.join(', ')}`);
// Páginas pendientes de revisión jurídica y marcadas como no indexables (#32): fuera del sitemap hasta su validación
const pendienteNoindex = (f) => /<meta name="revision-juridica" content="pendiente-noindex"/.test(read(f));
const indexable = pages.filter((f) => !pendienteNoindex(f)).map(pageOf).filter((p) => p !== '/404.html' && p !== '/gracias/');
for (const p of indexable) if (!locs.includes(p)) errors.push(`página indexable fuera del sitemap: ${p}`);
for (const p of locs) if (!indexable.includes(p)) errors.push(`el sitemap incluye una URL que no es una página indexable: ${p}`);

// 7 y 8. Fuentes: borradores y colisiones de rutas
const blogDir = join(srcRoot, 'src/content/blog');
if (existsSync(blogDir)) {
  const rss = fileSet.has('/rss.xml') ? read('/rss.xml') : '';
  const appDirs = readdirSync(join(srcRoot, 'src/app')).filter((d) => statSync(join(srcRoot, 'src/app', d)).isDirectory() && !/^[[(_]/.test(d));
  for (const md of readdirSync(blogDir).filter((x) => x.endsWith('.md'))) {
    const slug = md.slice(0, -3);
    const fm = readFileSync(join(blogDir, md), 'utf8').split('---')[1] ?? '';
    if (/^draft:\s*true\s*$/m.test(fm)) {
      if (fileSet.has(`/${slug}/index.html`)) errors.push(`borrador publicado: /${slug}/`);
      if (locs.includes(`/${slug}/`)) errors.push(`borrador en el sitemap: /${slug}/`);
      if (rss.includes(`/${slug}/`)) errors.push(`borrador en el RSS: /${slug}/`);
    }
    if (appDirs.includes(slug)) errors.push(`colisión de ruta: el artículo «${slug}» tiene el mismo slug que src/app/${slug}/`);
  }
}

// 7 bis. Landings (#34): los borradores no se generan ni van al sitemap
const landDir = join(srcRoot, 'src/content/landings');
if (existsSync(landDir)) {
  for (const md of readdirSync(landDir).filter((x) => x.endsWith('.md'))) {
    const slug = md.slice(0, -3);
    const fm = readFileSync(join(landDir, md), 'utf8').split('---')[1] ?? '';
    if (/^draft:\s*true\s*$/m.test(fm) && (fileSet.has(`/${slug}/index.html`) || locs.includes(`/${slug}/`))) errors.push(`landing en borrador publicada: /${slug}/`);
    if (/^revision:\s*pendiente\s*$/m.test(fm) && locs.includes(`/${slug}/`)) errors.push(`landing pendiente de revisión en el sitemap: /${slug}/`);
  }
}

// 9. Presupuesto de peso por página
const gz = (f) => gzipSync(readFileSync(join(dir, f))).length;
const assetCache = new Map();
const assetSize = (u) => {
  const f = resolveFile(u);
  if (!f) return 0;
  if (!assetCache.has(f)) assetCache.set(f, gz(f));
  return assetCache.get(f);
};
let heaviest = { page: '', js: 0 };
for (const f of pages) {
  const page = pageOf(f);
  const html = read(f);
  const htmlGz = gz(f);
  const js = [...html.matchAll(/<script\b([^>]*)\ssrc="([^"]+)"[^>]*>/g)].filter((m) => !/nomodule/i.test(m[1] + m[0])).reduce((t, m) => t + assetSize(m[2]), 0);
  const css = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].reduce((t, m) => t + assetSize(m[1]), 0);
  if (htmlGz > BUDGET.html) err(page, `HTML ${htmlGz} B gzip > presupuesto ${BUDGET.html}`);
  if (css > BUDGET.css) err(page, `CSS ${css} B gzip > presupuesto ${BUDGET.css}`);
  if (js > BUDGET.js) err(page, `JavaScript ${js} B gzip > presupuesto ${BUDGET.js}`);
  if (js > heaviest.js) heaviest = { page, js, css, htmlGz };
}

console.log(`${pages.length} páginas · ${locs.length} URLs en el sitemap · página con más JS: ${heaviest.page} (JS ${Math.round(heaviest.js / 1024)} KB, CSS ${Math.round((heaviest.css ?? 0) / 1024)} KB, HTML ${Math.round((heaviest.htmlGz ?? 0) / 1024)} KB, gzip)`);
if (errors.length) {
  console.error(`\n${errors.length} errores:`);
  errors.forEach((e) => console.error(' - ' + e));
  process.exit(1);
}
console.log('OK: enlaces, anclas, recursos, estructura, JSON-LD, idioma, sitemap, borradores, rutas y peso');
