// Una sola ruta para las áreas de práctica y los artículos, que conservan sus direcciones de siempre.
import { notFound } from 'next/navigation';
import { getPost, getPosts } from '@/lib/content';
import { areaContent } from '@/lib/areas-content';
import { buildMetadata, ogDe } from '@/lib/seo';
import { AreaPage } from '@/components/AreaPage';
import { PostPage } from '@/components/PostPage';

type Params = { slug: string };

// Solo existen las rutas generadas: cualquier otra es 404 (nada de páginas "vacías" con 200).
export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  const slugs = [...areaContent.map((a) => a.slug), ...getPosts().map((p) => p.slug)];
  const dup = slugs.find((s, i) => slugs.indexOf(s) !== i);
  if (dup) throw new Error(`Colisión de rutas: "${dup}" es a la vez área y artículo`);
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const area = areaContent.find((a) => a.slug === slug);
  if (area) return buildMetadata({ title: area.title, description: area.description, path: `/${slug}/`, image: ogDe(area.imagen) });
  const post = getPost(slug);
  if (!post) return {};
  return buildMetadata({
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
  const post = getPost(slug);
  if (!post) notFound();
  return <PostPage post={post} />;
}
