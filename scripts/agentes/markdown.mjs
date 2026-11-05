// Convierte el HTML final de una página pública en Markdown para agentes: solo el contenido de <main>,
// con enlaces absolutos y sin scripts, formularios ni adornos.
import { unified } from 'unified';
import rehypeParse from 'rehype-parse';
import rehypeRemark from 'rehype-remark';
import remarkGfm from 'remark-gfm';
import remarkStringify from 'remark-stringify';

const SITE = 'https://praetoriaabogados.es';
const FUERA = new Set(['script', 'style', 'noscript', 'template', 'svg', 'button', 'input', 'select', 'textarea', 'dialog', 'iframe', 'source']);
const BLOQUES = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div', 'ul', 'ol', 'section', 'article', 'table', 'figure']);

const esElemento = (n) => n.type === 'element';
const texto = (n) => (n.type === 'text' ? n.value : (n.children ?? []).map(texto).join(''));

function buscar(n, cumple) {
  if (esElemento(n) && cumple(n)) return n;
  for (const h of n.children ?? []) {
    const r = buscar(h, cumple);
    if (r) return r;
  }
  return null;
}

const absoluta = (url) => (typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') ? new URL(url, SITE).href : url);

const parrafo = (valor) => ({ type: 'element', tagName: 'p', properties: {}, children: [{ type: 'text', value: valor }] });

/** Una tarjeta enlazada (<a> con bloques dentro) no cabe en Markdown: el enlace pasa a su titular y el resto queda detrás. */
function desplegarEnlace(a) {
  const hijos = a.children;
  const titular = hijos.find((h) => esElemento(h) && /^h[1-6]$/.test(h.tagName));
  const enlazar = (children) => ({ type: 'element', tagName: 'a', properties: { href: a.properties.href }, children });
  if (titular) {
    titular.children = [enlazar(titular.children)];
    return hijos;
  }
  return [...hijos, { type: 'element', tagName: 'p', properties: {}, children: [enlazar([{ type: 'text', value: a.properties.href }])] }];
}

function limpiar(n) {
  const hijos = [];
  for (const h of n.children ?? []) {
    if (h.type === 'comment') continue;
    if (!esElemento(h)) {
      hijos.push(h);
      continue;
    }
    const p = h.properties ?? {};
    if (FUERA.has(h.tagName) || p.hidden != null || p.ariaHidden === 'true') continue;
    if (h.tagName === 'form') {
      hijos.push(parrafo('[Formulario disponible en la versión web de esta página.]'));
      continue;
    }
    if (h.tagName === 'img') {
      if (!p.alt) continue;
      p.src = absoluta(p.src);
      delete p.srcSet;
      delete p.sizes;
    }
    if (h.tagName === 'a') p.href = absoluta(p.href);
    limpiar(h);
    if (h.tagName === 'a' && h.children.some((c) => esElemento(c) && BLOQUES.has(c.tagName))) hijos.push(...desplegarEnlace(h));
    else hijos.push(h);
  }
  // Dos <span> o <a> seguidos se ven separados por el CSS; en Markdown se pegarían («jurídica.Abogados»)
  const EN_LINEA = new Set(['span', 'a']);
  n.children = hijos.flatMap((h, i) => {
    const previo = hijos[i - 1];
    return previo && esElemento(previo) && esElemento(h) && EN_LINEA.has(previo.tagName) && EN_LINEA.has(h.tagName) ? [{ type: 'text', value: ' ' }, h] : [h];
  });
}

const aMarkdown = unified()
  .use(rehypeRemark)
  .use(remarkGfm)
  .use(remarkStringify, { bullet: '-', emphasis: '*', fences: true, listItemIndent: 'one', rule: '-' });

const parser = unified().use(rehypeParse);

/** @returns {{ titulo: string, descripcion: string, url: string, idioma: string, markdown: string }} */
export function htmlAMarkdown(html) {
  const arbol = parser.parse(html);
  const meta = (nombre) => buscar(arbol, (n) => n.tagName === 'meta' && n.properties?.name === nombre)?.properties?.content ?? '';
  const main = buscar(arbol, (n) => n.tagName === 'main');
  if (!main) throw new Error('Página sin <main>');
  limpiar(main);

  const titulo = texto(buscar(arbol, (n) => n.tagName === 'title') ?? { type: 'root' }).trim();
  const descripcion = String(meta('description'));
  const url = String(buscar(arbol, (n) => n.tagName === 'link' && [n.properties?.rel].flat().includes('canonical'))?.properties?.href ?? '');
  const idioma = String(buscar(arbol, (n) => n.tagName === 'html')?.properties?.lang ?? 'es');

  const cuerpo = aMarkdown.stringify(aMarkdown.runSync({ type: 'root', children: [main] })).trim();
  // Comillas JSON: un título con «:» o comillas sigue siendo YAML válido
  const cabecera = [`title: ${JSON.stringify(titulo)}`, `description: ${JSON.stringify(descripcion)}`, `url: ${JSON.stringify(url)}`, `lang: ${idioma}`];
  return { titulo, descripcion, url, idioma, markdown: `---\n${cabecera.join('\n')}\n---\n\n${cuerpo}\n` };
}
