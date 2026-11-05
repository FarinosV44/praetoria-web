// Genera la versión Markdown de cada página pública a partir de la copia final (out/), ya con los ajustes de HTML.
// La sirven /api/markdown (si la petición pide Accept: text/markdown) y el servidor MCP (/mcp/).
//   node scripts/agentes/generar.mjs out .next/server/app/__markdown
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { htmlAMarkdown } from './markdown.mjs';

const [origen = 'out', destino = '.next/server/app/__markdown'] = process.argv.slice(2);
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));

// Solo lo que está en el sitemap es consultable por el servidor MCP: nada de pendientes de revisión jurídica ni /gracias/
const enSitemap = new Set(
  [...readFileSync(join(origen, 'sitemap.xml'), 'utf8').matchAll(/<loc>https:\/\/praetoriaabogados\.es([^<]*)<\/loc>/g)].map((m) => decodeURI(m[1])),
);

rmSync(destino, { recursive: true, force: true });
const indice = [];
for (const f of walk(origen).filter((x) => x.endsWith('index.html'))) {
  const rel = relative(origen, dirname(f)).split(sep).join('/');
  const ruta = rel ? `/${rel}/` : '/';
  const { titulo, descripcion, markdown } = htmlAMarkdown(readFileSync(f, 'utf8'));
  const salida = join(destino, rel, 'index.md');
  mkdirSync(dirname(salida), { recursive: true });
  writeFileSync(salida, markdown);
  if (enSitemap.has(ruta)) indice.push({ ruta, titulo, descripcion });
}
if (!indice.length) throw new Error('Índice de agentes vacío: revisa out/sitemap.xml');
indice.sort((a, b) => a.ruta.localeCompare(b.ruta));
writeFileSync(join(destino, 'indice.json'), JSON.stringify(indice));
console.log(`Markdown para agentes: ${indice.length} páginas consultables en ${destino}/.`);
