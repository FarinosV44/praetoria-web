import type { MetadataRoute } from 'next';
import { getLandings, getPosts } from '@/lib/content';
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
  '/que-me-llame-un-abogado/',
  '/abogado-hacienda-y-seguridad-social-en-valencia/',
  '/abogado-divorcio-horta-nord-valencia/',
  '/reclamacion-portes-impagados/',
  '/impugnar-despido/',
  '/reclamar-salarios-y-finiquito/',
  '/incapacidad-permanente/',
  '/accidente-laboral/',
  '/aviso-legal/',
  '/politica-de-privacidad/',
  '/politica-de-cookies/',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const url = (p: string) => new URL(p, site.url).href;
  return [
    ...STATIC.map((p) => ({ url: url(p) })),
    // Áreas pendientes de revisión jurídica (indexable: false, #32) fuera hasta su validación
    ...areaContent.filter((a) => a.indexable !== false).map((a) => ({ url: url(`/${a.slug}/`) })),
    ...Object.keys(categories).map((c) => ({ url: url(`/blog/categoria/${c}/`) })),
    ...getPosts().map((p) => ({ url: url(`/${p.slug}/`), lastModified: p.updated ?? p.date })),
    ...getLandings().filter((l) => l.revision !== 'pendiente').map((l) => ({ url: url(`/${l.slug}/`), lastModified: l.updated ?? l.date })),
  ];
}
