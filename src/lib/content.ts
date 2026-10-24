// Lectura de los artículos y páginas legales en Markdown (src/content/), en el build.
// Mismo esquema que tenía la colección de Astro: si un archivo no lo cumple, el build falla.
import 'server-only';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';
import { z } from 'zod';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeSlug from 'rehype-slug';
import rehypeStringify from 'rehype-stringify';
import type { CategoryKey } from './site';
import { registro } from './imagenes';

const CONTENT = join(process.cwd(), 'src/content');

const categoryKeys = ['transporte', 'mercantil', 'hacienda', 'civil-vivienda', 'familia', 'laboral', 'extranjeria', 'elegir-abogado'] as const;

const postSchema = z.object({
  title: z.string(),
  /** Título para buscadores (<title>) si difiere del titular. Recuperado de WordPress en #2. */
  seoTitle: z.string().optional(),
  description: z.string(),
  date: z.coerce.date(),
  updated: z.coerce.date().optional(),
  category: z.enum(categoryKeys),
  deca: z.enum(['guia', 'herramienta']).optional(),
  lang: z.enum(['es', 'fr', 'ar']).default('es'),
  tags: z.array(z.string()).default([]),
  draft: z.boolean().default(false),
  wpId: z.number().optional(),
  /** Una sola intención de búsqueda por artículo (#28): qué quiere resolver quien llega. Evita canibalizar otros artículos. */
  intencion: z.string().min(12),
  /** Imagen destacada: id en src/content/imagenes.json. */
  imagen: z.string().optional(),
  /** Si aún no hay imagen pertinente: qué escena hace falta. Es una tarea editorial, nunca se rellena con otra cualquiera. */
  imagenPendiente: z.string().min(12).optional(),
});

const legalSchema = z.object({ title: z.string(), description: z.string(), updated: z.string() });

export type Encabezado = { id: string; texto: string };
export type Post = z.infer<typeof postSchema> & { slug: string; category: CategoryKey; html: string; indice: Encabezado[]; palabras: number };
export type LegalPage = z.infer<typeof legalSchema> & { slug: string; html: string };

// Nodo HAST mínimo: lo justo para recorrer el árbol sin dependencias extra
type Nodo = { type: string; tagName?: string; value?: string; properties?: Record<string, unknown>; children?: Nodo[] };

/** Tablas responsivas: cada <table> va en un contenedor con desplazamiento propio, accesible por teclado. */
function rehypeTablas() {
  return (arbol: Nodo) => {
    const visitar = (n: Nodo) => {
      n.children = (n.children ?? []).map((h) => {
        if (h.type === 'element' && h.tagName === 'table') {
          return { type: 'element', tagName: 'div', properties: { className: ['tabla'], role: 'region', tabIndex: 0, ariaLabel: 'Tabla (desplazable)' }, children: [h] };
        }
        visitar(h);
        return h;
      });
    };
    visitar(arbol);
  };
}

/** Índice del artículo: los H2 con su ancla (rehype-slug ya les ha dado id). */
function indiceDe(html: string): Encabezado[] {
  return [...html.matchAll(/<h2 id="([^"]+)">([\s\S]*?)<\/h2>/g)].map((m) => ({ id: m[1]!, texto: m[2]!.replace(/<[^>]+>/g, '').trim() }));
}

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeSlug)
  .use(rehypeTablas)
  .use(rehypeStringify);

const toHtml = (md: string) => String(processor.processSync(md));

function readDir<T>(dir: string, schema: z.ZodType<T>) {
  return readdirSync(join(CONTENT, dir))
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((f) => {
      const { data, content } = matter(readFileSync(join(CONTENT, dir, f), 'utf8'));
      const parsed = schema.safeParse(data);
      if (!parsed.success) throw new Error(`Cabecera no válida en ${dir}/${f}: ${parsed.error.message}`);
      return { ...parsed.data, slug: f.replace(/\.md$/, ''), html: toHtml(content) };
    });
}

let postsCache: Post[] | null = null;

/** Reglas editoriales de imagen (#28). Rompen el build: un artículo nuevo no puede salir sin decidir su imagen. */
function validarImagen(p: Post) {
  const donde = `src/content/blog/${p.slug}.md`;
  if (!p.imagen === !p.imagenPendiente) throw new Error(`${donde}: indica «imagen» (id de src/content/imagenes.json) o «imagenPendiente» (qué escena falta), uno de los dos`);
  if (!p.imagen) return;
  const img = registro.find((i) => i.id === p.imagen);
  if (!img) throw new Error(`${donde}: la imagen «${p.imagen}» no existe en src/content/imagenes.json`);
  // DeCA: los artículos de producto llevan capturas reales; las guías legales, una imagen de contexto
  if (p.deca === 'herramienta' && img.origen.tipo !== 'deca') throw new Error(`${donde}: un artículo de producto DeCA usa capturas reales de DeCA Profesional`);
  if (p.deca !== 'herramienta' && img.origen.tipo === 'deca') throw new Error(`${donde}: las capturas de DeCA solo van en artículos de producto (deca: herramienta)`);
  if (img.origen.tipo === 'praetoria') throw new Error(`${donde}: las fotos de las instalaciones solo se usan en «El despacho»`);
}

/** Artículos publicados (sin borradores), del más reciente al más antiguo. */
export function getPosts(): Post[] {
  postsCache ??= (readDir('blog', postSchema) as Post[])
    .filter((p) => !p.draft)
    .map((p) => ({ ...p, indice: indiceDe(p.html), palabras: p.html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length }))
    .sort((a, b) => b.date.valueOf() - a.date.valueOf());
  postsCache.forEach(validarImagen);
  return postsCache;
}

export function getPost(slug: string): Post | undefined {
  return getPosts().find((p) => p.slug === slug);
}

export function getLegal(slug: 'aviso-legal' | 'politica-de-privacidad' | 'politica-de-cookies'): LegalPage {
  const page = (readDir('legal', legalSchema) as LegalPage[]).find((p) => p.slug === slug);
  if (!page) throw new Error(`Falta src/content/legal/${slug}.md`);
  return page;
}
