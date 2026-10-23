import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { site } from '../data/site';

export async function GET(context) {
  const posts = (await getCollection('blog', (p) => !p.data.draft)).sort((a, b) => b.data.date - a.data.date);
  return rss({
    title: `Blog de ${site.name}`,
    description: 'Artículos jurídicos prácticos de Juan José Farinós Ibáñez, abogado en El Puig y Valencia.',
    site: context.site,
    items: posts.map((p) => ({ title: p.data.title, description: p.data.description, pubDate: p.data.date, link: `/${p.id}/` })),
    customData: '<language>es-es</language>',
  });
}
