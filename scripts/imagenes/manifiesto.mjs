// Manifiesto de imágenes y matriz editorial del blog (#28).
//   node scripts/imagenes/manifiesto.mjs --check   comprueba el registro (lo usa `npm run check`)
//   node scripts/imagenes/manifiesto.mjs --write   además regenera docs/IMAGENES.md y docs/BLOG-MATRIZ.md
// Fuente única: src/content/imagenes.json + cabeceras de src/content/blog/*.md + src/lib/servicios.ts (artículos).
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';

const raiz = new URL('../../', import.meta.url).pathname;
const { imagenes } = JSON.parse(readFileSync(join(raiz, 'src/content/imagenes.json'), 'utf8'));
const errores = [];
const err = (m) => errores.push(m);

// 1. Registro: archivos, alt y procedencia
const alts = new Map();
for (const img of imagenes) {
  const alt = img.alt.trim();
  if (/^(imagen|foto|fotografía) (de|del)\b/i.test(alt)) err(`${img.id}: el alt no debe empezar por «imagen de/foto de»`);
  const palabras = alt.toLowerCase().match(/[a-záéíóúñü]{5,}/g) ?? [];
  const repetida = palabras.find((p, i) => palabras.indexOf(p) !== i);
  if (repetida) err(`${img.id}: el alt repite «${repetida}»`);
  if (alts.has(alt)) err(`${img.id}: alt idéntico al de ${alts.get(alt)}`);
  alts.set(alt, img.id);
  if (img.estado !== 'publicada') continue;
  if (img.origen.tipo === 'unsplash' && !(img.origen.autor && img.origen.url)) err(`${img.id}: falta autor o enlace`);
  const base = join(raiz, 'public/media', img.archivo);
  for (const w of img.variantes ?? []) {
    const suf = w === Math.max(...img.variantes) ? '' : `-${w}`;
    for (const ext of img.avif === false ? ['webp'] : ['webp', 'avif']) {
      if (!existsSync(`${base}${suf}.${ext}`)) err(`${img.id}: falta public/media/${img.archivo}${suf}.${ext}`);
    }
  }
  if (img.origen.tipo !== 'praetoria' && !existsSync(`${base}-og.jpg`)) err(`${img.id}: falta la imagen para compartir -og.jpg`);
}

// 2. Instalaciones del despacho: solo en «El despacho» (#28)
const fuentes = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? fuentes(join(d, e.name)) : /\.(tsx?|json)$/.test(e.name) ? [join(d, e.name)] : []));
const instalaciones = imagenes.filter((i) => i.origen.tipo === 'praetoria').map((i) => i.id);
for (const f of fuentes(join(raiz, 'src'))) {
  const rel = f.slice(raiz.length);
  if (rel === 'src/content/imagenes.json' || rel === 'src/app/el-despacho/page.tsx') continue;
  const t = readFileSync(f, 'utf8');
  if (/media\/(v2\/)?(despacho-|detalle-madera)/.test(t)) err(`${rel}: usa una foto de las instalaciones fuera de «El despacho»`);
  for (const id of instalaciones) if (t.includes(`'${id}'`) || t.includes(`"${id}"`)) err(`${rel}: usa «${id}» fuera de «El despacho»`);
}

// 2b. Recreaciones personalizadas (#28 §8): una o dos en total, cada una en un solo sitio, nunca en la portada
const fuentesSrc = fuentes(join(raiz, 'src')).filter((f) => !f.endsWith('imagenes.json'));
const personalizadas = imagenes.filter((i) => i.origen.tipo === 'ia' && i.origen.personalizada);
if (personalizadas.length > 2) err(`hay ${personalizadas.length} recreaciones personalizadas; el máximo es dos`);
for (const img of personalizadas) {
  const usos = fuentesSrc.filter((f) => new RegExp(`['"]${img.id}['"]|^imagen: ${img.id}$`, 'm').test(readFileSync(f, 'utf8')));
  if (usos.length > 1) err(`${img.id}: recreación personalizada usada en ${usos.length} sitios (máximo uno)`);
  if (usos.some((f) => f.endsWith('src/app/page.tsx'))) err(`${img.id}: no va en la portada`);
}

// 3. Blog: cada artículo declara imagen o pendiente; matriz editorial
const dirBlog = join(raiz, 'src/content/blog');
const servicios = readFileSync(join(raiz, 'src/lib/servicios.ts'), 'utf8');
const porId = new Map(imagenes.map((i) => [i.id, i]));
const posts = readdirSync(dirBlog)
  .filter((f) => f.endsWith('.md'))
  .map((f) => ({ slug: f.slice(0, -3), ...matter(readFileSync(join(dirBlog, f), 'utf8')).data }))
  .filter((p) => !p.draft)
  .sort((a, b) => String(a.category).localeCompare(b.category) || a.slug.localeCompare(b.slug));
const intenciones = new Map();
for (const p of posts) {
  if (!p.imagen === !p.imagenPendiente) err(`${p.slug}: indica imagen o imagenPendiente`);
  if (p.imagen && !porId.has(p.imagen)) err(`${p.slug}: imagen desconocida ${p.imagen}`);
  if (intenciones.has(p.intencion)) err(`${p.slug}: misma intención que ${intenciones.get(p.intencion)}`);
  intenciones.set(p.intencion, p.slug);
}

const servicioDe = (slug) => {
  const i = servicios.indexOf(`'${slug}'`);
  if (i < 0) return '—';
  const ini = servicios.lastIndexOf("id: '", i);
  return servicios.slice(ini + 5, servicios.indexOf("'", ini + 5));
};
const procedencia = (img) =>
  img.origen.tipo === 'ia'
    ? `${img.origen.personalizada ? 'Recreación con IA a partir de fotografías autorizadas por el titular' : 'Generada con IA'} (\`${img.origen.original}\`) · ${img.origen.nota}`
    : img.origen.tipo === 'pexels'
    ? `[${img.origen.autor} / Pexels](${img.origen.url}) · Licencia Pexels`
    : img.origen.tipo === 'unsplash'
    ? img.origen.autor ? `[${img.origen.autor} / Unsplash](${img.origen.url}) · Licencia Unsplash` : `Unsplash ${img.origen.id} (pendiente de procesar)`
    : img.origen.tipo === 'deca'
      ? `Captura real de DeCA Profesional (${img.origen.archivos.map((a) => a.split('/').pop()).join(', ')}) · material propio`
      : `Fotografía propia de Praetoria · ${img.origen.original}`;

const pendientes = posts.filter((p) => p.imagenPendiente || (p.imagen && porId.get(p.imagen)?.estado !== 'publicada'));

if (process.argv.includes('--write')) {
  const usos = (id) => {
    const u = [];
    const buscar = (d) => fuentes(d).filter((f) => !f.endsWith('imagenes.json') && new RegExp(`['"]${id}['"]`).test(readFileSync(f, 'utf8'))).map((f) => f.slice(raiz.length));
    u.push(...buscar(join(raiz, 'src')));
    u.push(...posts.filter((p) => p.imagen === id).map((p) => `blog/${p.slug}`));
    return u.join('<br>') || '—';
  };
  const filas = imagenes.map((i) => `| \`${i.id}\` | ${i.escena} | ${i.estado} | ${i.alt} | ${procedencia(i)} | ${usos(i.id)} |`);
  writeFileSync(
    join(raiz, 'docs/IMAGENES.md'),
    `# Imágenes editoriales — manifiesto (#28)

Generado por \`node scripts/imagenes/manifiesto.mjs --write\` a partir de \`src/content/imagenes.json\`. No editar a mano.

Reglas: nada de oficinas vacías fuera de «El despacho» (máximo dos fotos secundarias allí); personas de banco de imágenes
nunca presentadas como miembros del despacho; sin mazos, balanzas ni apretones de manos; sin texto inventado legible;
sin imagen pertinente, composición tipográfica. Originales privados en \`fotos/\` (no se publican: Netlify solo publica \`out/\`).
Licencia Unsplash: uso comercial gratuito, sin atribución obligatoria (se acredita igualmente). Capturas de DeCA Profesional:
material propio del producto (repositorio farvertrans-deca), sin retocar su contenido; el logotipo es el original, no recreado.

Proceso: originales en \`fotos/editorial/<id>.jpg\` o \`fotos/deca/\` → \`python3 scripts/imagenes/procesar.py\` →
\`public/media/ed/\` (1600/1200/800/480 px en AVIF y WebP, recorte 16:10 por punto focal, y -og.jpg 1200×630).

| Id | Escena buscada | Estado | Texto alternativo | Procedencia y licencia | Dónde se usa |
| --- | --- | --- | --- | --- | --- |
${filas.join('\n')}
`,
  );
  const mfilas = posts.map((p) => {
    const img = p.imagen ? porId.get(p.imagen) : undefined;
    return `| [${p.title}](/${p.slug}/) | ${p.category} | ${p.intencion} | ${img ? `\`${img.id}\`${img.estado === 'publicada' ? '' : ' (por procesar)'}` : `**Pendiente:** ${p.imagenPendiente}`} | ${img ? procedencia(img) : '—'} | ${img ? img.alt : '—'} | ${servicioDe(p.slug)} | ${p.deca ? (p.deca === 'herramienta' ? 'Producto: capturas reales + bloque DeCA' : 'Guía legal: imagen de contexto + bloque DeCA') : 'Sin DeCA'} |`;
  });
  writeFileSync(
    join(raiz, 'docs/BLOG-MATRIZ.md'),
    `# Matriz editorial del blog (#28)

Generado por \`node scripts/imagenes/manifiesto.mjs --write\`. Una intención por artículo (el check falla si dos coinciden).
Las cabeceras de cada artículo exigen \`intencion\` y \`imagen\` (id del registro) o \`imagenPendiente\` (escena que falta):
un artículo nuevo no compila sin decidirlo. Un artículo sin imagen pertinente muestra una composición tipográfica.

Artículos: ${posts.length} · con imagen: ${posts.length - pendientes.length} · pendientes editoriales: ${pendientes.length}

| Artículo | Categoría | Intención | Imagen | Procedencia | Alt | Servicio / CTA | Relación DeCA |
| --- | --- | --- | --- | --- | --- | --- | --- |
${mfilas.join('\n')}
`,
  );
}

if (pendientes.length) console.log(`Pendientes editoriales de imagen (${pendientes.length}):\n  ${pendientes.map((p) => `${p.slug}: ${p.imagenPendiente ?? `${p.imagen} sin procesar`}`).join('\n  ')}`);
if (errores.length) {
  console.error(`Imágenes: ${errores.length} error(es)\n  ${errores.join('\n  ')}`);
  process.exit(1);
}
console.log(`Imágenes: registro correcto (${imagenes.filter((i) => i.estado === 'publicada').length} publicadas de ${imagenes.length}).`);
