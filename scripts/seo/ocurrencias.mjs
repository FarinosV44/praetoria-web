// Informe de ocurrencias (#28): dónde aparecen El Puig / l'Horta Nord y los nombres propios en la web generada.
//   node scripts/seo/ocurrencias.mjs [out]
// Lee el texto visible de cada página (sin <script>) y separa título/descripción del cuerpo.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] || 'out';
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const BUSCAR = { 'El Puig': /El Puig/g, "l'Horta Nord": /l(?:'|’|&#x27;|&apos;)Horta Nord/gi, 'Juan José Farinós': /Juan José Farin[oó]s/g, 'Lucía López': /Lucía López/g };
const texto = (h) => h.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const filas = [];
for (const f of walk(dir).filter((x) => x.endsWith('.html') && !x.endsWith('__forms.html'))) {
  const html = readFileSync(f, 'utf8');
  const ruta = f.slice(dir.length).replace(/index\.html$/, '');
  const meta = [(html.match(/<title>([^<]*)/) || [])[1] ?? '', (html.match(/name="description" content="([^"]*)/) || [])[1] ?? ''].join(' ');
  const main = texto((html.match(/<main[\s\S]*?<\/main>/) || [''])[0]);
  for (const [k, re] of Object.entries(BUSCAR)) {
    const enMeta = (meta.match(re) || []).length;
    const enCuerpo = (main.match(re) || []).length;
    if (enMeta || enCuerpo) filas.push({ ruta, termino: k, enMeta, enCuerpo });
  }
}
filas.sort((a, b) => a.termino.localeCompare(b.termino) || a.ruta.localeCompare(b.ruta));
console.log('| Término | Página | En título/descr. | En el cuerpo |\n| --- | --- | ---: | ---: |');
for (const r of filas) console.log(`| ${r.termino} | \`${r.ruta}\` | ${r.enMeta} | ${r.enCuerpo} |`);
