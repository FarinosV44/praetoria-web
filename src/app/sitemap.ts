import type { MetadataRoute } from 'next';
import { getLandings, getPosts } from '@/lib/content';
import { areaContent } from '@/lib/areas-content';
import { categories } from '@/lib/site';
import { servicios } from '@/lib/servicios';
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
  '/calculadora-indemnizacion-despido/',
  '/aviso-legal/',
  '/politica-de-privacidad/',
  '/politica-de-cookies/',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const url = (p: string) => new URL(p, site.url).href;
  const entradas: MetadataRoute.Sitemap = [
    ...STATIC.map((p) => ({ url: url(p) })),
    // Áreas pendientes de revisión jurídica (indexable: false, #32) fuera hasta su validación
    ...areaContent.filter((a) => a.indexable !== false).map((a) => ({ url: url(`/${a.slug}/`) })),
    // Páginas propias de servicio: todas las indexables (las pendientes de revisión jurídica llevan indexable: false)
    ...servicios.filter((s) => s.pagina && s.indexable !== false).map((s) => ({ url: url(s.pagina!) })),
    ...Object.keys(categories).map((c) => ({ url: url(`/blog/categoria/${c}/`) })),
    ...getPosts().map((p) => ({ url: url(`/${p.slug}/`), lastModified: p.updated ?? p.date })),
    ...getLandings().filter((l) => l.revision !== 'pendiente').map((l) => ({ url: url(`/${l.slug}/`), lastModified: l.updated ?? l.date })),
  ];
  // Sin URLs repetidas (varios servicios comparten página)
  const vistas = new Set<string>();
  return entradas.filter((e) => !vistas.has(e.url) && vistas.add(e.url));
}
