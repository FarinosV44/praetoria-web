import type { MetadataRoute } from 'next';
import { getPosts } from '@/lib/content';
import { areaContent } from '@/lib/areas-content';
import { categories } from '@/lib/site';
import { site } from '@/lib/site';

export const dynamic = 'force-static';

// Páginas indexables. /gracias/ y la 404 quedan fuera a propósito.
const STATIC = [
  '/',
  '/areas/',
  '/blog/',
  '/el-despacho/',
  '/abogado-el-puig/',
  '/contacto/',
  '/abogado-hacienda-y-seguridad-social-en-valencia/',
  '/abogado-divorcio-horta-nord-valencia/',
  '/reclamacion-portes-impagados/',
  '/aviso-legal/',
  '/politica-de-privacidad/',
  '/politica-de-cookies/',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const url = (p: string) => new URL(p, site.url).href;
  return [
    ...STATIC.map((p) => ({ url: url(p) })),
    ...areaContent.map((a) => ({ url: url(`/${a.slug}/`) })),
    ...Object.keys(categories).map((c) => ({ url: url(`/blog/categoria/${c}/`) })),
    ...getPosts().map((p) => ({ url: url(`/${p.slug}/`), lastModified: p.updated ?? p.date })),
  ];
}
