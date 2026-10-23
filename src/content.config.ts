import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    /** Título para buscadores (<title>), si difiere del titular. Recuperado de WordPress en #2. */
    seoTitle: z.string().optional(),
    description: z.string(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    category: z.enum(['transporte', 'mercantil', 'hacienda', 'civil-vivienda', 'familia', 'laboral', 'extranjeria', 'elegir-abogado']),
    deca: z.enum(['guia', 'herramienta']).optional(),
    lang: z.enum(['es', 'fr', 'ar']).default('es'),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    wpId: z.number().optional(),
  }),
});

const legal = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/legal' }),
  schema: z.object({ title: z.string(), description: z.string(), updated: z.string() }),
});

export const collections = { blog, legal };
