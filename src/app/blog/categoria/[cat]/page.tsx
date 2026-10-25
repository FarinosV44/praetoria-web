import { BlogIndex, blogMeta } from '@/components/BlogIndex';
import { buildMetadata } from '@/lib/seo';
import { categories, type CategoryKey } from '@/lib/site';

type Params = { cat: CategoryKey };

export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return (Object.keys(categories) as CategoryKey[]).map((cat) => ({ cat }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { cat } = await params;
  return buildMetadata(blogMeta(cat));
}

export default async function CategoryPage({ params }: { params: Promise<Params> }) {
  const { cat } = await params;
  return <BlogIndex category={cat} />;
}
