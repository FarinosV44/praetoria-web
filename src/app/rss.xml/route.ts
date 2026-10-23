import { getPosts } from '@/lib/content';
import { site } from '@/lib/site';

export const dynamic = 'force-static';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function GET() {
  const items = getPosts()
    .map((p) => {
      const url = `${site.url}/${p.slug}/`;
      return `<item><title>${esc(p.title)}</title><link>${url}</link><guid isPermaLink="true">${url}</guid><description>${esc(p.description)}</description><pubDate>${p.date.toUTCString()}</pubDate></item>`;
    })
    .join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${esc(`Blog de ${site.name}`)}</title><description>Artículos jurídicos prácticos de Juan José Farinós Ibáñez, abogado en El Puig y Valencia.</description><link>${site.url}/</link><language>es-es</language>${items}</channel></rss>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
