// Genera public/_redirects a partir del export de WordPress y de la clasificación de los artículos.
// Ejecuta: npm run seo:redirects   (la CI comprueba que el archivo generado está al día)
//
// Criterio: cada redirección apunta a un destino equivalente. Lo que no tiene equivalente
// (rutas internas de WordPress, autores inexistentes, imágenes de banco no migradas) se deja en 404.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../../', import.meta.url).pathname;
const wp = JSON.parse(readFileSync(join(root, 'docs/seo/fuentes/wordpress-export-2026-10-23.json'), 'utf8'));
const blogDir = join(root, 'src/content/blog');

// Clasificación nueva de cada artículo, leída de su cabecera (wpId + category)
const posts = readdirSync(blogDir)
  .filter((f) => f.endsWith('.md'))
  .map((f) => {
    const fm = readFileSync(join(blogDir, f), 'utf8').split('---')[1];
    const get = (k) => (fm.match(new RegExp(`^${k}:\\s*(.+)$`, 'm')) || [])[1]?.trim();
    return { slug: f.replace(/\.md$/, ''), wpId: Number(get('wpId')), category: get('category'), draft: get('draft') === 'true' };
  });
const byWpId = new Map(posts.map((p) => [p.wpId, p]));

// Categorías antiguas de WordPress -> destino nuevo (equivalencia temática)
const CATEGORY_MAP = {
  derecho: { to: '/blog/', why: 'contenía 39 de 40 artículos: su equivalente es el blog completo' },
  'transporte-y-logistica': { to: '/blog/categoria/transporte/' },
  'transporte-y-logistica/transporte-y-logistica-transporte-y-logistica': { to: '/blog/categoria/transporte/', why: 'subcategoría duplicada' },
  'logistica-y-transporte': { to: '/blog/categoria/transporte/' },
  'normativa-transporte': { to: '/blog/categoria/transporte/' },
  'hacienda-y-seguridad-social': { to: '/blog/categoria/hacienda/' },
  'mercantil-y-sociedades': { to: '/blog/categoria/mercantil/' },
  'civil-y-patrimonio': { to: '/blog/categoria/civil-vivienda/' },
  familia: { to: '/blog/categoria/familia/' },
  'arte-y-patrimonio': { to: '/arte-y-patrimonio/', why: 'categoría sin artículos: se envía al área' },
};

// Fotografías migradas: nombre antiguo (sin extensión) -> archivo nuevo
const p = 'WhatsApp-Image-2025-09-29-at-';
const MEDIA_MAP = {
  // [p + '14.27.02']: retrato retirado (#28): sin redirección, da 404
  [p + '14.07.17-1']: 'despacho-puestos-trabajo.webp',
  [p + '14.07.18']: 'despacho-zona-mesas.webp',
  [p + '14.07.18-1']: 'despacho-oficina-sofa.webp',
  [p + '14.07.18-2']: 'despacho-atencion-cliente.webp',
  [p + '14.07.18-3']: 'despacho-zona-espera.webp',
  [p + '14.07.18-4']: 'despacho-salas-reuniones.webp',
  [p + '14.07.18-5']: 'despacho-planta-abierta.webp',
  // El original mostraba datos en un portátil: se redirige al recorte sin pantalla ni personas (#28)
  [p + '14.07.18-6']: 'v2/despacho-cristales-planta.webp',
  [p + '14.24.33']: 'trabajo-portatil.webp',
  [p + '14.19.54']: 'arte-muestras-color.webp',
  [p + '14.27.52']: 'arte-museo-visitantes.webp',
  [p + '14.17.28']: 'arte-obra-textil.webp',
  [p + '14.18.13']: 'arte-obra-abstracta.webp',
  [p + '14.20.05']: 'arte-sala-archivo.webp',
};
// Tamaños intermedios que WordPress generaba y que la web antigua enlazaba
const SIZES = ['', '-1024x768', '-768x576', '-300x225', '-768x1024', '-225x300', '-150x150'];

const lines = [];
const out = (from, to, status = 301) => lines.push(`${from.padEnd(70)} ${to.padEnd(50)} ${status}`);

lines.push(
  '# GENERADO por scripts/seo/generate-redirects.mjs — no editar a mano.',
  '# Fuente: docs/seo/fuentes/wordpress-export-2026-10-23.json y la cabecera de cada artículo.',
  '# Las áreas, landings, artículos y páginas legales conservan su URL y no necesitan redirección.',
  '# Netlify trata la barra final como opcional y el comodín * incluye la ruta exacta; distingue mayúsculas.',
  '',
  '# Páginas fusionadas o renombradas',
);
out('/ambitos-de-especializacion/', '/areas/');
out('/sobre-mi/', '/el-despacho/');
out('/sobre-praetoria/', '/el-despacho/');
out('/despacho-juridico-valencia/', '/');
out('/blogs/', '/blog/');

lines.push('', '# Enlace interno roto que existía en un artículo de WordPress');
out('/deca-subcontratacion-agencias-transporte/', '/deca-y-subcontratacion-que-debe-hacer-realmente-una-agencia-de-transporte/');

lines.push('', '# Categorías de WordPress (incluye su paginación /page/N/ y feed)');
for (const c of wp.categories) {
  const key = c.parent ? `${wp.categories.find((x) => x.id === c.parent).slug}/${c.slug}` : c.slug;
  const m = CATEGORY_MAP[key];
  if (!m) throw new Error(`Categoría sin destino: ${key}`);
  // El comodín también cubre la ruta exacta /category/x/ (comprobado con @netlify/redirect-matcher)
  out(`/category/${key}/*`, m.to);
}

lines.push(
  '',
  '# Etiquetas de WordPress: con un solo artículo -> ese artículo; con varios -> la categoría nueva',
  '# que reúne la mayoría de ellos; si están repartidos -> el blog. Las etiquetas sin artículos se dejan en 404.',
);
const tagDecisions = [];
// Etiquetas cuya intención coincide con una página de área o de servicio nueva (decisión editorial, #7)
const TAG_A_PAGINA = { 'abogado-laboralista-valencia': '/abogado-laboralista-valencia/' };
for (const t of [...wp.tags].sort((a, b) => a.slug.localeCompare(b.slug))) {
  const tagged = wp.posts.filter((x) => x.tags.includes(t.id)).map((x) => byWpId.get(x.id)).filter((x) => x && !x.draft);
  if (!tagged.length) {
    tagDecisions.push({ slug: t.slug, decision: '404', why: 'sin artículos' });
    continue;
  }
  let to;
  if (TAG_A_PAGINA[t.slug]) to = TAG_A_PAGINA[t.slug];
  else if (tagged.length === 1) to = `/${tagged[0].slug}/`;
  else {
    const counts = {};
    tagged.forEach((x) => (counts[x.category] = (counts[x.category] || 0) + 1));
    const [best, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    to = n / tagged.length >= 0.6 ? `/blog/categoria/${best}/` : '/blog/';
  }
  // Netlify compara la ruta ya decodificada: los slugs no ASCII (etiquetas en árabe) se escriben
  // con sus caracteres, no con %d8… (comprobado con @netlify/redirect-matcher)
  const slug = decodeURI(t.slug);
  out(`/tag/${slug}/*`, to);
}

lines.push('', '# Feeds de WordPress');
out('/feed/', '/rss.xml');
out('/comments/feed/', '/rss.xml');
out('/blog/feed/', '/rss.xml');
out('/:slug/feed/', '/:slug/');

lines.push('', '# Paginación antigua del blog');
out('/blog/page/*', '/blog/');
out('/page/*', '/blog/');

lines.push('', '# Imágenes de WordPress migradas (enlazadas desde buscadores de imágenes o redes)');
for (const [old, now] of Object.entries(MEDIA_MAP)) {
  for (const s of SIZES) out(`/wp-content/uploads/2025/10/${old}${s}.jpeg`, `/media/${now}`);
}
out('/wp-content/uploads/2025/09/logo-praetoria-header.png', '/media/logo-praetoria-sin-fondo.png');
out('/wp-content/uploads/2025/09/logo-praetoria_header-sin-fondo.png', '/media/logo-praetoria-sin-fondo.png');
out('/wp-content/uploads/2025/09/Iconopng.png', '/icon-512.png');

lines.push(
  '',
  '# Sin regla a propósito (responden 404): /wp-admin/, /wp-login.php, /xmlrpc.php, /author/*,',
  '# /?p=ID (WordPress ya redirige a la URL final y la web nueva responde la portada con canonical propio)',
  '# y el resto de /wp-content/uploads/ (imágenes de banco no migradas).',
  '',
);

writeFileSync(join(root, 'public/_redirects'), lines.join('\n'));
writeFileSync(join(root, 'docs/seo/fuentes/etiquetas-sin-redireccion.json'), JSON.stringify(tagDecisions, null, 1) + '\n');
console.log(`_redirects: ${lines.filter((l) => l && !l.startsWith('#')).length} reglas`);
