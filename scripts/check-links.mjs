// Comprueba que todos los enlaces internos de la web construida (dist/) apuntan a una página existente.
// Uso: npm run build && npm run check-links
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const html = walk(dist).filter((f) => f.endsWith('.html'));
const exists = (p) => {
  const clean = decodeURI(p.split('#')[0].split('?')[0]);
  if (clean === '' ) return true;
  return existsSync(join(dist, clean)) && statSync(join(dist, clean)).isFile()
    || existsSync(join(dist, clean, 'index.html'));
};
let bad = 0;
for (const file of html) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const url = m[1];
    if (!url.startsWith('/') || url.startsWith('//')) continue;
    if (!exists(url)) {
      bad++;
      console.log(`${file.replace(dist, '')}  ->  ${url}`);
    }
  }
}
console.log(bad ? `\n${bad} enlaces internos rotos` : `OK: ${html.length} páginas, sin enlaces internos rotos`);
process.exit(bad ? 1 : 0);
