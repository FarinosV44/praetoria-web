import { BlogIndex, blogMeta } from '@/components/BlogIndex';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata(blogMeta());

export default function BlogPage() {
  return <BlogIndex />;
}
