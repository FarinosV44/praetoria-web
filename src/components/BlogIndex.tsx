import Link from 'next/link';
import { getPosts } from '@/lib/content';
import { areas, categories, type CategoryKey } from '@/lib/site';
import { Breadcrumbs } from './Breadcrumbs';
import { PostList } from './PostList';
import { CtaBand } from './CtaBand';

export function blogMeta(category?: CategoryKey) {
  const cat = category ? categories[category] : undefined;
  return {
    title: cat ? `${cat.name}: artículos` : 'Blog jurídico',
    description: cat
      ? `Artículos de ${cat.name.toLowerCase()} escritos por Juan José Farinós Ibáñez, abogado en El Puig y Valencia.`
      : 'Guías y artículos prácticos sobre transporte y DECA, Hacienda, mercantil, vivienda, familia, laboral y extranjería.',
    path: category ? `/blog/categoria/${category}/` : '/blog/',
  };
}

export function BlogIndex({ category }: { category?: CategoryKey }) {
  const all = getPosts();
  const counts: Partial<Record<CategoryKey, number>> = Object.fromEntries(
    (Object.keys(categories) as CategoryKey[]).map((k) => [k, all.filter((p) => p.category === k).length]),
  );
  const posts = category ? all.filter((p) => p.category === category) : all;
  const cat = category ? categories[category] : undefined;
  const area = cat?.area ? areas.find((a) => a.slug === cat.area) : undefined;

  return (
    <div className="page-blog">
    <section className="page-head">
        <div className="wrap">
          <Breadcrumbs items={cat ? [{ label: 'Blog', href: '/blog/' }, { label: cat.name }] : [{ label: 'Blog' }]} />
          <h1>{cat ? cat.name : 'Blog jurídico'}</h1>
          <p className="lede">
            {cat
              ? area
                ? <>Artículos prácticos sobre {cat.name.toLowerCase()}. Si necesitas ayuda con un caso, consulta el área de <Link href={`/${area.slug}/`}>{area.name.toLowerCase()}</Link>.</>
                : <>Artículos prácticos sobre {cat.name.toLowerCase()}.</>
              : 'Explicaciones claras sobre los problemas jurídicos que más nos consultan, ordenadas por tema.'}
          </p>
          <nav className="cats" aria-label="Categorías del blog">
            <Link href="/blog/" aria-current={!category ? 'page' : undefined}>Todos <span>{all.length}</span></Link>
            {(Object.keys(categories) as CategoryKey[]).filter((k) => (counts[k] ?? 0) > 0).map((k) => (
              <Link key={k} href={`/blog/categoria/${k}/`} aria-current={category === k ? 'page' : undefined}>
                {categories[k].name} <span>{counts[k]}</span>
              </Link>
            ))}
          </nav>
        </div>
      </section>
      <section className="section">
        <div className="wrap">
          <PostList posts={posts} showCategory={!category} />
        </div>
      </section>
      <CtaBand />

    </div>

  );
}
