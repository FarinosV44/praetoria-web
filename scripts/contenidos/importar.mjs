// Importa un paquete editorial preparado en un chat (ChatGPT o Claude) a la web (#34).
// Contrato y plantilla: docs/CONTENIDOS-DESDE-CHAT.md. Sin CMS: el resultado es un archivo Markdown del repositorio,
// que se revisa en una PR con su previsualización de Netlify.
//
//   node scripts/contenidos/importar.mjs <paquete.md>              → valida y muestra qué haría (no escribe nada)
//   node scripts/contenidos/importar.mjs <paquete.md> --escribir   → escribe src/content/blog/<slug>.md o src/content/landings/<slug>.md
//   opciones: --actualizar (el slug ya existe y se sustituye, conservando la fecha original) · --destino <dir> (pruebas)
//
// Estado del paquete → resultado:
//   borrador → draft: true       (no se genera en ninguna build)
//   revision → revision: pendiente (se genera en la previsualización con aviso, noindex y fuera de listados, sitemap y RSS)
//   aprobado → revision: revisado (publicable; exige revisor real). Publicar sigue requiriendo la orden expresa del propietario.
//
// Seguridad: el cuerpo es Markdown sin HTML. Se rechazan etiquetas HTML, scripts, iframes, manejadores de eventos y
// enlaces javascript:/data:. Los enlaces internos deben existir; los externos, https.
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import matter from 'gray-matter';
import { site, laboral, areas } from '../../src/lib/site.ts';
import { servicios } from '../../src/lib/servicios.ts';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const archivo = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--destino');
const escribir = args.includes('--escribir');
const actualizar = args.includes('--actualizar');
const destino = args.includes('--destino') ? args[args.indexOf('--destino') + 1] : ROOT;

const errores = [];
const avisos = [];
const error = (m) => errores.push(m);
const aviso = (m) => avisos.push(m);

if (!archivo || !existsSync(archivo)) {
  console.error('Uso: node scripts/contenidos/importar.mjs <paquete.md> [--escribir] [--actualizar]');
  process.exit(2);
}

const { data: p, content: cuerpoBruto } = matter(readFileSync(archivo, 'utf8'));
const cuerpo = cuerpoBruto.trim();
const texto = (v) => (typeof v === 'string' ? v.trim() : '');
const fechaISO = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : texto(v));
const hoy = new Date().toISOString().slice(0, 10);

// Personas reales del despacho: autor y revisor nunca se inventan
const PERSONAS = [site.lawyer, laboral.name];
const CATEGORIA_DE_AREA = { transporte: 'transporte', mercantil: 'mercantil', hacienda: 'hacienda', civil: 'civil-vivienda', familia: 'familia', laboral: 'laboral' };
const CATEGORIAS = ['transporte', 'mercantil', 'hacienda', 'civil-vivienda', 'familia', 'laboral', 'extranjeria', 'elegir-abogado'];
const OFICIALES = /(^|\.)(boe\.es|gob\.es|europa\.eu|poderjudicial\.es|agenciatributaria\.es|agenciatributaria\.gob\.es|seg-social\.es|seg-social\.gob\.es|gva\.es|dgt\.es|noticias\.juridicas\.com)$/;

// 1. Campos obligatorios y formatos ----------------------------------------------------------------
const tipo = texto(p.tipo);
if (!['articulo', 'landing'].includes(tipo)) error('tipo: «articulo» o «landing»');
const estado = texto(p.estado) || 'borrador';
if (!['borrador', 'revision', 'aprobado'].includes(estado)) error('estado: «borrador», «revision» o «aprobado»');
const slug = texto(p.slug).replace(/^\/|\/$/g, '');
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) error(`slug «${slug}»: solo minúsculas sin tildes, números y guiones`);
const area = texto(p.area);
if (!areas.some((a) => a.id === area)) error(`area «${area}»: una de ${areas.map((a) => a.id).join(', ')}`);
const servicio = texto(p.servicio);
if (servicio) {
  const s = servicios.find((x) => x.id === servicio);
  if (!s) error(`servicio «${servicio}» no existe en src/lib/servicios.ts`);
  else if (s.area !== area) error(`servicio «${servicio}» es del área ${s.area}, no de ${area}`);
}
const publico = texto(p.publico);
if (publico && !['empresas', 'particulares', 'ambos'].includes(publico)) error('publico: «empresas», «particulares» o «ambos»');
const intencion = texto(p.intencion);
if (intencion.length < 12) error('intencion: una sola intención de búsqueda, en una frase (mínimo 12 caracteres)');
const titulo = texto(p.titulo);
if (titulo.length < 10) error('titulo (H1): obligatorio');
const seoTitle = texto(p.seoTitle);
if (seoTitle.length > 65) aviso(`seoTitle de ${seoTitle.length} caracteres: Google suele cortar a partir de ~60`);
const descripcion = texto(p.descripcion);
if (descripcion.length < 50 || descripcion.length > 170) error(`descripcion: entre 50 y 170 caracteres (tiene ${descripcion.length})`);
const resumen = texto(p.resumen);
if (tipo === 'landing' && resumen.length < 30) error('resumen: obligatorio en una landing (entradilla bajo el H1)');

const autor = texto(p.autor) || site.lawyer;
if (!PERSONAS.includes(autor)) error(`autor «${autor}»: debe ser una persona real del despacho (${PERSONAS.join(' o ')})`);
const revisor = texto(p.revisor);
if (revisor && !PERSONAS.includes(revisor)) error(`revisor «${revisor}»: debe ser una persona real del despacho (${PERSONAS.join(' o ')})`);
if (estado === 'aprobado' && !revisor) error('estado «aprobado» sin revisor: indica quién lo ha revisado (no se inventa)');

const fecha = fechaISO(p.fecha) || hoy;
const actualizado = fechaISO(p.actualizado);
const fechaOk = (f) => /^\d{4}-\d{2}-\d{2}$/.test(f) && !Number.isNaN(Date.parse(f)) && f <= hoy;
if (!fechaOk(fecha)) error(`fecha «${fecha}»: real y no futura (AAAA-MM-DD)`);
if (actualizado && (!fechaOk(actualizado) || actualizado < fecha)) error(`actualizado «${actualizado}»: real, no futura y posterior a la fecha`);

let categoria = texto(p.categoria);
if (tipo === 'articulo') {
  categoria ||= CATEGORIA_DE_AREA[area] ?? '';
  if (!CATEGORIAS.includes(categoria)) error(`categoria: el área «${area}» no tiene categoría de blog; indica una de ${CATEGORIAS.join(', ')}`);
}

// 2. Imagen: del registro o pendiente con su escena. Nunca una cualquiera ---------------------------------
const registro = JSON.parse(readFileSync(join(ROOT, 'src/content/imagenes.json'), 'utf8'));
const lista = Array.isArray(registro) ? registro : registro.imagenes ?? [];
const img = p.imagen ?? {};
let imagen = '';
let imagenPendiente = '';
if (typeof img === 'string' || img.id) {
  imagen = typeof img === 'string' ? img : img.id;
  const r = lista.find((i) => i.id === imagen);
  if (!r) error(`imagen «${imagen}» no está en src/content/imagenes.json (regístrala y procésala antes con npm run imagenes)`);
  else if (r.origen?.tipo === 'praetoria') error('las fotos de las instalaciones solo se usan en «El despacho»');
} else if (img.archivo) {
  error(`imagen.archivo «${img.archivo}»: añade la imagen al registro (src/content/imagenes.json: alt, procedencia, crédito, foco) y procésala; después indica su id`);
} else if (texto(img.pendiente).length >= 12) {
  imagenPendiente = texto(img.pendiente);
} else error('imagen: indica «id» (del registro) o «pendiente» (la escena exacta que falta)');

// 3. Cuerpo: Markdown seguro y enlaces que existen ---------------------------------------------------
const sinCodigo = cuerpo.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
if (cuerpo.length < 400) error('cuerpo: demasiado corto para aportar algo útil (mínimo ~400 caracteres)');
if (/<\/?[a-z!][^>]*>/i.test(sinCodigo)) error('cuerpo: no admite HTML (usa Markdown). Se han encontrado etiquetas como ' + (sinCodigo.match(/<\/?[a-z!][^>\s]*/i) ?? [''])[0]);
if (/\bon[a-z]+\s*=/i.test(sinCodigo) && /<|=\s*["']/.test(sinCodigo)) error('cuerpo: manejadores de eventos no permitidos');
if (/^#\s/m.test(sinCodigo)) error('cuerpo: no uses «# » (H1); el titular ya es el H1. Empieza las secciones con «## »');
if (/\{[^}]*\}/.test(sinCodigo) && /\{\s*[a-z_$][\w$]*\s*\(/i.test(sinCodigo)) error('cuerpo: no admite expresiones de código');

// Rutas que existen hoy: páginas de la app, áreas, artículos, landings y, en este paquete, la propia
const appDirs = readdirSync(join(ROOT, 'src/app')).filter((d) => statSync(join(ROOT, 'src/app', d)).isDirectory() && !/^[[(_]/.test(d));
const md = (dir) => (existsSync(join(ROOT, dir)) ? readdirSync(join(ROOT, dir)).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3)) : []);
const posts = md('src/content/blog');
const landings = md('src/content/landings');
const areaSlugs = [...readFileSync(join(ROOT, 'src/lib/areas-content.ts'), 'utf8').matchAll(/^\s{4}slug: '([^']+)'/gm)].map((m) => m[1]);
const rutas = new Set(['', 'blog', ...appDirs, ...posts, ...landings, ...areaSlugs, slug]);
const enlaces = [...cuerpo.matchAll(/\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g)].map((m) => m[1]);
for (const extra of [p.cta?.destino, ...(Array.isArray(p.enlaces) ? p.enlaces : [])].filter((x) => x && !['contacto', 'llamada'].includes(x))) enlaces.push(String(extra));
for (const href of enlaces) {
  if (/^(javascript|data|vbscript):/i.test(href)) error(`enlace no permitido: ${href}`);
  else if (href.startsWith('/')) {
    const ruta = href.split(/[?#]/)[0].replace(/^\/|\/$/g, '');
    const base = ruta.split('/')[0];
    if (!rutas.has(ruta) && !(base === 'blog' && ruta.startsWith('blog/'))) error(`enlace interno inexistente: ${href}`);
    else if (ruta && !href.split(/[?#]/)[0].endsWith('/')) error(`enlace interno sin barra final: ${href}`);
  } else if (href.startsWith('#')) {
    // ancla dentro de la propia página
  } else if (!/^https:\/\//.test(href) && !/^(mailto|tel):/.test(href)) error(`enlace externo sin https: ${href}`);
}
const internos = enlaces.filter((h) => h.startsWith('/') && !h.startsWith('/contacto/') && !h.startsWith('/que-me-llame'));
if (internos.length < 1) aviso('el contenido no enlaza con ninguna página propia (área, servicio o guía): añade al menos un enlace útil');

// 4. Llamada a la acción ------------------------------------------------------------------------------
const ctaTexto = texto(p.cta?.texto) || 'Solicitar una valoración';
let ctaDestino = texto(p.cta?.destino) || 'contacto';
if (ctaDestino === 'contacto') ctaDestino = servicio ? `/contacto/?servicio=${servicio}` : `/contacto/?area=${area}`;
else if (ctaDestino === 'llamada') ctaDestino = `/que-me-llame-un-abogado/?area=${area}${servicio ? `&servicio=${servicio}` : ''}`;

// 5. FAQs y fuentes -------------------------------------------------------------------------------------
const faqs = Array.isArray(p.faqs) ? p.faqs.map((f) => ({ q: texto(f?.q), a: texto(f?.a) })) : [];
faqs.forEach((f, i) => {
  if (f.q.length < 8 || f.a.length < 20) error(`faqs[${i}]: pregunta y respuesta útiles (sin relleno)`);
  if (/<[a-z]/i.test(f.q + f.a)) error(`faqs[${i}]: sin HTML`);
});
const fuentes = Array.isArray(p.fuentes) ? p.fuentes.map((f) => ({ label: texto(f?.titulo ?? f?.label), href: texto(f?.url ?? f?.href) })) : [];
fuentes.forEach((f, i) => {
  if (!f.label || !/^https:\/\//.test(f.href)) error(`fuentes[${i}]: título y URL https`);
  else if (!OFICIALES.test(new URL(f.href).hostname)) aviso(`fuentes[${i}]: ${new URL(f.href).hostname} no es una fuente oficial; verifica el dato en el BOE u organismo competente`);
});
if (!fuentes.length) aviso('sin fuentes: si el contenido afirma plazos, importes o requisitos legales, cita la norma (BOE u organismo)');

// 6. Colisiones de URL ----------------------------------------------------------------------------------
const existe = (dir) => existsSync(join(destino, dir, `${slug}.md`));
const enUso = [appDirs.includes(slug) && `src/app/${slug}/`, areaSlugs.includes(slug) && 'una página de área', tipo === 'landing' && posts.includes(slug) && 'un artículo', tipo === 'articulo' && landings.includes(slug) && 'una landing'].filter(Boolean);
if (enUso.length) error(`slug «${slug}» ya lo usa ${enUso.join(' y ')}`);
const carpeta = tipo === 'landing' ? 'src/content/landings' : 'src/content/blog';
let fechaOriginal = '';
if (existe(carpeta)) {
  if (!actualizar) error(`ya existe ${carpeta}/${slug}.md: usa --actualizar para sustituirlo (se conserva su fecha original)`);
  else fechaOriginal = fechaISO(matter(readFileSync(join(destino, carpeta, `${slug}.md`), 'utf8')).data.date);
}
const inventario = existsSync(join(ROOT, 'docs/seo/inventario-urls.csv')) ? readFileSync(join(ROOT, 'docs/seo/inventario-urls.csv'), 'utf8') : '';
const filaWp = inventario.split('\n').find((l) => l.startsWith(`/${slug}/,`));
if (filaWp && !posts.includes(slug) && !landings.includes(slug) && /,30[18]>/.test(filaWp))
  error(`/${slug}/ es una URL antigua de WordPress que hoy redirige: crear contenido aquí cambiaría la migración SEO (revísalo en docs/seo/)`);

// 7. Resultado ------------------------------------------------------------------------------------------
const q = (s) => JSON.stringify(s);
const fm = [];
const salidaFecha = fechaOriginal || fecha;
if (tipo === 'articulo') {
  fm.push(`title: ${q(titulo)}`);
  if (seoTitle) fm.push(`seoTitle: ${q(seoTitle)}`);
  fm.push(`description: ${q(descripcion)}`, `date: ${salidaFecha}`);
  if (actualizado || fechaOriginal) fm.push(`updated: ${actualizado || hoy}`);
  fm.push(`category: ${categoria}`, `intencion: ${q(intencion)}`);
} else {
  fm.push(`title: ${q(titulo)}`);
  if (seoTitle) fm.push(`seoTitle: ${q(seoTitle)}`);
  fm.push(`description: ${q(descripcion)}`, `h1: ${q(titulo)}`, `lede: ${q(resumen)}`, `date: ${salidaFecha}`);
  if (actualizado || fechaOriginal) fm.push(`updated: ${actualizado || hoy}`);
  fm.push(`area: ${area}`);
  if (servicio) fm.push(`servicio: ${servicio}`);
  fm.push(`intencion: ${q(intencion)}`, `cta: { texto: ${q(ctaTexto)}, destino: ${q(ctaDestino)} }`);
  fm.push(`faqs: ${q(faqs)}`, `fuentes: ${q(fuentes)}`);
}
fm.push(imagen ? `imagen: ${imagen}` : `imagenPendiente: ${q(imagenPendiente)}`);
if (estado === 'borrador') fm.push('draft: true');
fm.push(`revision: ${estado === 'aprobado' ? 'revisado' : 'pendiente'}`);
if (revisor) fm.push(`revisor: ${q(revisor)}`);

let salida = cuerpo;
if (tipo === 'articulo') {
  if (faqs.length) salida += `\n\n## Preguntas frecuentes\n\n` + faqs.map((f) => `### ${f.q}\n\n${f.a}`).join('\n\n');
  if (fuentes.length) salida += `\n\n## Fuentes\n\n` + fuentes.map((f) => `- [${f.label}](${f.href})`).join('\n');
  salida += `\n\n[${ctaTexto}](${ctaDestino})`;
}
const resultado = `---\n${fm.join('\n')}\n---\n\n${salida}\n`;
const ruta = join(carpeta, `${slug}.md`);

avisos.forEach((a) => console.log('Aviso: ' + a));
if (errores.length) {
  console.error(`${errores.length} errores en ${archivo}:`);
  errores.forEach((e) => console.error(' - ' + e));
  process.exit(1);
}
const efecto = { borrador: 'borrador: no se genera en ninguna build', revision: 'pendiente de revisión: solo en la previsualización, con aviso y noindex', aprobado: 'revisado: publicable cuando el propietario lo autorice' }[estado];
if (!escribir) {
  console.log(`OK (sin escribir): ${tipo} /${slug}/ → ${ruta} (${efecto}). Añade --escribir para crearlo.`);
} else {
  mkdirSync(dirname(join(destino, ruta)), { recursive: true });
  writeFileSync(join(destino, ruta), resultado);
  console.log(`Escrito ${ruta} (${efecto}). Siguiente paso: npm run build && npm run check, y PR con previsualización.`);
}
