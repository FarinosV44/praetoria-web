// Compara página a página dos builds (Astro antes, Next después) para demostrar la paridad de la migración (#18).
//   node scripts/migracion/paridad.mjs <salida_astro> <salida_next>
// Compara: title, description, canonical, robots, lang, H1, texto visible de <main>, enlaces internos,
// imágenes, tipos de JSON-LD y formularios. Informa de cada diferencia; sale con 1 si hay diferencias.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const [a, b] = process.argv.slice(2);
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const pages = (dir) => walk(dir).filter((f) => f.endsWith('/index.html')).map((f) => f.slice(dir.length).replace(/index\.html$/, ''));

const decode = (s) =>
  s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n));
const pick = (h, re) => decode((h.match(re) || [])[1] || '');
function info(html) {
  const main = (html.match(/<main[^>]*>([\s\S]*?)<\/main>/) || [])[1] || '';
  const text = decode(
    main
      .replace(/<script[\s\S]*?<\/script>/g, ' ')
      .replace(/<style[\s\S]*?<\/style>/g, ' ')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
  const links = [...main.matchAll(/<a\b[^>]*href="([^"#]*)[^"]*"/g)].map((m) => decode(m[1])).filter((h) => h.startsWith('/'));
  const imgs = [...main.matchAll(/<img\b[^>]*src="([^"]+)"/g)].map((m) => m[1]);
  const ld = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => {
    try {
      return JSON.parse(m[1].replace(/\\u003c/g, '<'))['@type'];
    } catch {
      return 'JSON inválido';
    }
  });
  const forms = [...main.matchAll(/<form\b([^>]*)>/g)].map((m) => (m[1].match(/name="([^"]+)"/) || m[1].match(/id="([^"]+)"/) || [])[1]);
  return {
    title: pick(html, /<title>([^<]*)<\/title>/),
    description: pick(html, /<meta name="description" content="([^"]*)"/),
    canonical: pick(html, /<link rel="canonical" href="([^"]*)"/),
    robots: pick(html, /<meta name="robots" content="([^"]*)"/),
    lang: pick(html, /<html[^>]* lang="([^"]+)"/),
    ogTitle: pick(html, /<meta property="og:title" content="([^"]*)"/),
    ogDescription: pick(html, /<meta property="og:description" content="([^"]*)"/),
    ogImage: pick(html, /<meta property="og:image" content="([^"]*)"/),
    h1: decode((main.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(),
    text,
    links: [...new Set(links)].sort(),
    imgs: [...new Set(imgs)].sort(),
    ld: [...new Set(ld)].sort(),
    forms: forms.sort(),
  };
}

const pa = new Set(pages(a));
const pb = new Set(pages(b));
let diffs = 0;
const report = (p, k, x, y) => {
  diffs++;
  const show = (v) => (Array.isArray(v) ? JSON.stringify(v) : JSON.stringify(v.length > 160 ? v.slice(0, 160) + '…' : v));
  console.log(`DIFERENCIA ${p} [${k}]\n   antes:   ${show(x)}\n   después: ${show(y)}`);
};
for (const p of pa) if (!pb.has(p)) report(p, 'página', 'existe', 'falta');
for (const p of pb) if (!pa.has(p)) report(p, 'página', 'no existía', 'nueva');

let same = 0;
for (const p of [...pa].filter((x) => pb.has(x)).sort()) {
  const x = info(readFileSync(join(a, p, 'index.html'), 'utf8'));
  const y = info(readFileSync(join(b, p, 'index.html'), 'utf8'));
  let ok = true;
  for (const k of Object.keys(x)) {
    const vx = Array.isArray(x[k]) ? JSON.stringify(x[k]) : x[k];
    const vy = Array.isArray(y[k]) ? JSON.stringify(y[k]) : y[k];
    if (vx !== vy) {
      ok = false;
      if (k === 'text') {
        // localizar la primera divergencia del texto
        let i = 0;
        while (i < x.text.length && x.text[i] === y.text[i]) i++;
        report(p, 'texto', '…' + x.text.slice(Math.max(0, i - 60), i + 80), '…' + y.text.slice(Math.max(0, i - 60), i + 80));
      } else report(p, k, x[k], y[k]);
    }
  }
  if (ok) same++;
}
const extra = ['/rss.xml', '/robots.txt', '/_redirects', '/404.html'].map((f) => `${f}: ${existsSync(join(b, f)) ? 'sí' : 'NO'}`);
console.log(`\n${same} de ${[...pa].filter((x) => pb.has(x)).length} páginas idénticas en todos los campos · ${diffs} diferencias`);
console.log('Archivos en la salida nueva: ' + extra.join(' · '));
process.exit(diffs ? 1 : 0);
