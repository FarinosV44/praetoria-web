// Resumen del sitio para agentes (https://llmstxt.org). Mismos criterios que el sitemap: nada pendiente de revisión jurídica.
import { getLandings, getPosts } from '@/lib/content';
import { areaContent } from '@/lib/areas-content';
import { servicios } from '@/lib/servicios';
import { areas, site } from '@/lib/site';

export const dynamic = 'force-static';

const linea = (titulo: string, ruta: string, nota?: string) => `- [${titulo.replace(/[[\]]/g, '')}](${new URL(ruta, site.url).href})${nota ? `: ${nota.replace(/\s+/g, ' ').trim()}` : ''}`;

export function GET() {
  const areasPublicas = areas.filter((a) => areaContent.find((c) => c.slug === a.slug)?.indexable !== false);
  const vistas = new Set(areasPublicas.map((a) => `/${a.slug}/`));
  const paginasServicio = servicios.filter((s) => {
    if (!s.pagina || s.indexable === false || vistas.has(s.pagina)) return false;
    vistas.add(s.pagina);
    return true;
  });
  const guias = [
    ...getPosts().filter((p) => !vistas.has(`/${p.slug}/`)),
    ...getLandings().filter((l) => l.revision !== 'pendiente' && !vistas.has(`/${l.slug}/`)),
  ];

  const texto = [
    `# ${site.name} (Praetoria Abogados)`,
    '',
    `> Despacho de abogados en Valencia (España) para empresas y particulares: transporte y logística, mercantil, Hacienda y Seguridad Social, laboral, civil, familia y arte. Web en español.`,
    '',
    `Letrado responsable: ${site.lawyer}, ${site.college}, n.º ${site.collegeNumber}. Teléfono: ${site.phoneIntl}. Correo: ${site.email}. Dirección: ${site.address.street}, ${site.address.postalCode} ${site.address.locality} (${site.address.region}).`,
    '',
    'Los textos son información jurídica general y no sustituyen el asesoramiento sobre un caso concreto.',
    '',
    '## El despacho',
    '',
    linea('Sobre nosotros', '/el-despacho/', 'quiénes somos, método de trabajo y equipo'),
    linea('Contacto', '/contacto/', 'teléfono, correo, WhatsApp y formulario de consulta'),
    linea('Que me llame un abogado', '/que-me-llame-un-abogado/', 'solicitud de llamada'),
    linea('Áreas de práctica', '/areas/'),
    '',
    '## Áreas de práctica',
    '',
    ...areasPublicas.map((a) => linea(a.name, `/${a.slug}/`, a.short)),
    '',
    '## Servicios',
    '',
    ...paginasServicio.map((s) => linea(s.nombre, s.pagina!, s.resumen)),
    '',
    '## Guías jurídicas',
    '',
    ...guias.map((g) => linea(g.title, `/${g.slug}/`, g.description)),
    '',
    '## Para agentes',
    '',
    `- Cualquier página en Markdown: pídela con la cabecera \`Accept: text/markdown\`.`,
    linea('Servidor MCP (solo lectura)', '/mcp/', 'buscar contenido, leer páginas y datos de contacto'),
    linea('Tarjeta del servidor MCP', '/.well-known/mcp/server-card.json'),
    '',
    '## Optional',
    '',
    linea('Blog', '/blog/'),
    linea('Aviso legal', '/aviso-legal/'),
    linea('Política de privacidad', '/politica-de-privacidad/'),
    linea('Política de cookies', '/politica-de-cookies/'),
    linea('Mapa del sitio', '/sitemap.xml'),
    '',
  ].join('\n');

  return new Response(texto, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
