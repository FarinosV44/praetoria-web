import Link from 'next/link';
import type { Post } from '@/lib/content';
import { categories } from '@/lib/site';

const fmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' });

export function PostList({ posts, showCategory = true, compact = false }: { posts: Post[]; showCategory?: boolean; compact?: boolean }) {
  return (
    <div className="posts-root">
      <ul className={compact ? 'posts posts--compact' : 'posts'}>
        {posts.map((p) => (
          <li key={p.slug} lang={p.lang !== 'es' ? p.lang : undefined} dir={p.lang === 'ar' ? 'rtl' : undefined}>
            <p className="posts__meta">
              {showCategory && <Link href={`/blog/categoria/${p.category}/`}>{categories[p.category].name}</Link>}
              <time dateTime={p.date.toISOString()}>{fmt.format(p.date)}</time>
            </p>
            <h3>
              <Link href={`/${p.slug}/`}>{p.title}</Link>
            </h3>
            {!compact && <p className="posts__desc">{p.description}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
