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
});

const legalSchema = z.object({ title: z.string(), description: z.string(), updated: z.string() });

export type Post = z.infer<typeof postSchema> & { slug: string; category: CategoryKey; html: string };
export type LegalPage = z.infer<typeof legalSchema> & { slug: string; html: string };

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeSlug)
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

/** Artículos publicados (sin borradores), del más reciente al más antiguo. */
export function getPosts(): Post[] {
  postsCache ??= (readDir('blog', postSchema) as Post[])
    .filter((p) => !p.draft)
    .sort((a, b) => b.date.valueOf() - a.date.valueOf());
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
