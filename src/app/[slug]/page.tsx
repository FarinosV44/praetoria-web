// Una sola ruta para las áreas de práctica y los artículos, que conservan sus direcciones de siempre.
import { notFound } from 'next/navigation';
import { getLandings, getPost, getPosts, getPostsEnRevision } from '@/lib/content';
import { areaContent } from '@/lib/areas-content';
import { buildMetadata, ogDe } from '@/lib/seo';
import { AreaPage } from '@/components/AreaPage';
import { PostPage } from '@/components/PostPage';
import { LandingPage } from '@/components/LandingPage';

type Params = { slug: string };

// Solo existen las rutas generadas: cualquier otra es 404 (nada de páginas "vacías" con 200).
export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  const slugs = [...areaContent.map((a) => a.slug), ...getPosts().map((p) => p.slug), ...getPostsEnRevision().map((p) => p.slug), ...getLandings().map((l) => l.slug)];
  const dup = slugs.find((s, i) => slugs.indexOf(s) !== i);
  if (dup) throw new Error(`Colisión de rutas: "${dup}" está a la vez en dos de: áreas, artículos y landings`);
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const area = areaContent.find((a) => a.slug === slug);
  if (area)
    return buildMetadata({
      title: area.title,
      description: area.description,
      path: `/${slug}/`,
      image: ogDe(area.imagen),
      noindex: area.indexable === false,
      revisionPendiente: area.revision === 'pendiente',
    });
  const landing = getLandings().find((l) => l.slug === slug);
  if (landing)
    return buildMetadata({
      title: landing.seoTitle ?? landing.title,
      description: landing.description,
      path: `/${slug}/`,
      image: ogDe(landing.imagen),
      noindex: landing.revision === 'pendiente',
      revisionPendiente: landing.revision === 'pendiente',
    });
  const post = getPost(slug);
  if (!post) return {};
  return buildMetadata({
    noindex: post.revision === 'pendiente',
    revisionPendiente: post.revision === 'pendiente',
    title: post.seoTitle ?? post.title,
    description: post.description,
    path: `/${slug}/`,
    type: 'article',
    published: post.date,
    modified: post.updated,
    image: ogDe(post.imagen),
  });
}

export default async function SlugPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const area = areaContent.find((a) => a.slug === slug);
  if (area) return <AreaPage area={area} />;
  const landing = getLandings().find((l) => l.slug === slug);
  if (landing) return <LandingPage landing={landing} />;
  const post = getPost(slug);
  if (!post) notFound();
  return <PostPage post={post} />;
}
