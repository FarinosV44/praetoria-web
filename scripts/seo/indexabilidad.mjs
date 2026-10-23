// Decide si la web generada puede indexarse. Se ejecuta después del build:
//   node scripts/seo/indexabilidad.mjs <carpeta_salida>
//
// Por defecto la web NO es indexable (deploy previews, ramas, la dirección provisional *.netlify.app
// y cualquier build local). Solo es indexable si SITE_INDEXABLE=true, que se activa en Netlify
// el día del lanzamiento (ver docs/seo/LANZAMIENTO.md). Así un despliegue anticipado no compite
// con WordPress en Google.
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) throw new Error('Uso: node scripts/seo/indexabilidad.mjs <carpeta_salida>');
const indexable = process.env.SITE_INDEXABLE === 'true';

if (indexable) {
  console.log('Indexable: SITE_INDEXABLE=true (producción). Se mantienen robots.txt y sitemap.');
  process.exit(0);
}

const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
let n = 0;
for (const f of walk(dir).filter((f) => f.endsWith('.html'))) {
  let html = readFileSync(f, 'utf8');
  if (/<meta name="robots"[^>]*>/.test(html)) html = html.replace(/<meta name="robots"[^>]*>/, '<meta name="robots" content="noindex, nofollow">');
  else html = html.replace('<head>', '<head><meta name="robots" content="noindex, nofollow">');
  writeFileSync(f, html);
  n++;
}
const headersFile = join(dir, '_headers');
const prev = existsSync(headersFile) ? readFileSync(headersFile, 'utf8') : '';
writeFileSync(headersFile, prev + '\n# Añadido por scripts/seo/indexabilidad.mjs: build no indexable\n/*\n  X-Robots-Tag: noindex, nofollow\n');
// Sin "Disallow": Google necesita poder leer la etiqueta noindex para no indexar.
writeFileSync(join(dir, 'robots.txt'), '# Build no indexable (preview). En producción se publica el robots.txt con sitemap.\nUser-agent: *\nAllow: /\n');
console.log(`No indexable: noindex en ${n} páginas, cabecera X-Robots-Tag y robots.txt sin sitemap.`);
