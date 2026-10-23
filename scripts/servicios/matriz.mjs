// Genera docs/SERVICIOS.md (matriz área → servicio → artículos → siguiente paso) a partir de src/lib/servicios.ts,
// y valida el modelo: ids únicos y con formato estable, artículos existentes y no en borrador, páginas propias existentes.
//   node scripts/servicios/matriz.mjs          → valida y escribe docs/SERVICIOS.md
//   node scripts/servicios/matriz.mjs --check  → valida y falla si docs/SERVICIOS.md no está al día
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { servicios, enlaceConsulta } from '../../src/lib/servicios.ts';
import { AREAS } from '../../src/lib/consulta.ts';

const BLOG = 'src/content/blog';
const DOC = 'docs/SERVICIOS.md';
const CHECKLISTS = 'docs/checklists-documentales.json';
const errores = [];

const posts = new Map(
  readdirSync(BLOG)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const fm = readFileSync(join(BLOG, f), 'utf8').split('---')[1] ?? '';
      const title = (fm.match(/^title:\s*["']?(.+?)["']?\s*$/m) || [])[1] ?? f;
      return [f.slice(0, -3), { title, draft: /^draft:\s*true\s*$/m.test(fm) }];
    }),
);
// Rutas propias de la app (para validar `pagina` y `siguientePaso`)
const rutaExiste = (href) => {
  const p = href.split('#')[0].replace(/^\/|\/$/g, '');
  return p === '' || existsSync(join('src/app', p)) || posts.has(p);
};

const vistos = new Set();
for (const s of servicios) {
  if (!/^[a-z]+(-[a-z0-9]+)+$/.test(s.id)) errores.push(`${s.id}: id con formato no válido`);
  if (!s.id.startsWith(s.area + '-')) errores.push(`${s.id}: el id debe empezar por su área (${s.area}-)`);
  if (vistos.has(s.id)) errores.push(`${s.id}: id duplicado`);
  vistos.add(s.id);
  if (!AREAS.some((a) => a.id === s.area)) errores.push(`${s.id}: área desconocida ${s.area}`);
  for (const a of s.articulos ?? []) {
    if (!posts.has(a)) errores.push(`${s.id}: artículo inexistente ${a}`);
    else if (posts.get(a).draft) errores.push(`${s.id}: enlaza un borrador ${a}`);
  }
  if ((s.revisamos || s.faqs) && !s.revision) errores.push(`${s.id}: texto ampliado sin estado de revisión`);
  if (s.pagina && !rutaExiste(s.pagina)) errores.push(`${s.id}: página inexistente ${s.pagina}`);
  if (s.siguientePaso && !rutaExiste(s.siguientePaso.href)) errores.push(`${s.id}: siguiente paso inexistente ${s.siguientePaso.href}`);
}

const esc = (t) => String(t).replace(/\|/g, '\\|');
let md = `# Servicios (#5)\n\n`;
md += `Generado por \`node scripts/servicios/matriz.mjs\` a partir de \`src/lib/servicios.ts\`. **No editar a mano.**\n\n`;
md += `Un servicio es algo concreto que el despacho hace, con un siguiente paso. Las páginas de área los agrupan y los artículos enlazan al que corresponde. `;
md += `El botón de cada servicio abre \`/contacto/?servicio=<id>\`, que deja preelegidos el área y el asunto (se pueden cambiar). El id se guarda con la consulta: no debe cambiarse.\n\n`;
md += `**Texto ampliado** (qué revisamos, proceso, documentación, preguntas y normas citadas): lo redacta la web a partir de lo ya publicado y de fuentes oficiales, y queda *pendiente de revisión* hasta que el despacho lo valide (\`revision: 'revisado'\`).\n\n`;
md += `Total: ${servicios.length} servicios.\n`;
for (const area of AREAS.filter((a) => a.id !== 'no-se')) {
  const lista = servicios.filter((s) => s.area === area.id);
  md += `\n## ${area.label} (${lista.length})\n\n`;
  if (!lista.length) {
    md += `Sin servicios definidos todavía.\n`;
    continue;
  }
  md += `| Servicio | id | Artículos relacionados | Siguiente paso | Texto ampliado |\n| --- | --- | --- | --- | --- |\n`;
  for (const s of lista) {
    const arts = (s.articulos ?? []).map((a) => `[${esc(posts.get(a)?.title ?? a)}](/${a}/)`).join('<br>') || '—';
    const paso = s.siguientePaso ? `[${esc(s.siguientePaso.label)}](${s.siguientePaso.href})` : `[${esc(s.cta ?? 'Consultar sobre esto')}](${enlaceConsulta(s)})`;
    const ampliado = s.revisamos || s.faqs ? (s.revision === 'revisado' ? 'revisado' : '**pendiente de revisión**') : '—';
    md += `| ${esc(s.nombre)}${s.pagina ? ` ([página](${s.pagina}))` : ''} | \`${s.id}\` | ${arts} | ${paso} | ${ampliado} |\n`;
  }
}

// Checklists documentales para el futuro portal de clientes (#7): solo el modelo, sin almacenamiento en la web.
// Los documentos «sensibles» (p. ej. informes médicos) no se piden nunca por la web pública.
const checklists =
  JSON.stringify(
    {
      nota: 'Generado por scripts/servicios/matriz.mjs a partir de src/lib/servicios.ts. Modelo para el futuro portal; la web pública no almacena documentos.',
      servicios: servicios
        .filter((s) => s.documentacion?.length)
        .map((s) => ({
          id: s.id,
          area: s.area,
          nombre: s.nombre,
          documentos: s.documentacion.map((d, i) => ({
            id: `${s.id}-${i + 1}`,
            label: typeof d === 'string' ? d : d.label,
            sensible: typeof d !== 'string',
            obligatorio: false,
          })),
        })),
    },
    null,
    1,
  ) + '\n';

if (errores.length) {
  console.error(`${errores.length} errores en el modelo de servicios:`);
  errores.forEach((e) => console.error(' - ' + e));
  process.exit(1);
}
if (process.argv.includes('--check')) {
  if (!existsSync(DOC) || readFileSync(DOC, 'utf8') !== md || !existsSync(CHECKLISTS) || readFileSync(CHECKLISTS, 'utf8') !== checklists) {
    console.error(`${DOC} o ${CHECKLISTS} no están al día: ejecuta node scripts/servicios/matriz.mjs`);
    process.exit(1);
  }
  console.log(`OK: ${servicios.length} servicios válidos y ${DOC} al día`);
} else {
  writeFileSync(DOC, md);
  writeFileSync(CHECKLISTS, checklists);
  console.log(`${DOC}: ${servicios.length} servicios`);
}
