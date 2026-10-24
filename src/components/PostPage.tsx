import Link from 'next/link';
import type { Post } from '@/lib/content';
import { getPosts } from '@/lib/content';
import { areas, categories, site } from '@/lib/site';
import { Breadcrumbs } from './Breadcrumbs';
import { PostList } from './PostList';
import { DecaBand } from './DecaBand';
import { CtaBand } from './CtaBand';
import { JsonLd } from './JsonLd';
import { enlaceConsulta, serviciosConArticulo } from '@/lib/servicios';
import { areaContent } from '@/lib/areas-content';

const fmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' });
const day = (d: Date) => d.toISOString().slice(0, 10);

export function PostPage({ post }: { post: Post }) {
  const cat = categories[post.category];
  const area = cat.area ? areas.find((a) => a.slug === cat.area) : undefined;
  const related = getPosts()
    .filter((p) => p.category === post.category && p.slug !== post.slug)
    .slice(0, 3);
  // El servicio concreto del que trata el artículo, si lo hay (#5); si no, el área
  const servicio = serviciosConArticulo(post.slug)[0];
  const areaServicio = servicio ? areas.find((a) => a.id === servicio.area) : undefined;
  // Ancla al servicio solo en las áreas que listan sus servicios (AreaPage); las landings propias van sin ancla
  const enlaceServicio = servicio && areaServicio
    ? servicio.pagina ?? (areaContent.some((a) => a.id === servicio.area) ? `/${areaServicio.slug}/#${servicio.id}` : `/${areaServicio.slug}/`)
    : undefined;
  const showUpdated = post.updated && day(post.updated) !== day(post.date);

  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    datePublished: post.date.toISOString(),
    dateModified: (post.updated ?? post.date).toISOString(),
    inLanguage: post.lang,
    mainEntityOfPage: new URL(`/${post.slug}/`, site.url).href,
    author: { '@type': 'Person', name: site.lawyer, url: `${site.url}/el-despacho/` },
    publisher: { '@id': `${site.url}/#despacho` },
    keywords: post.tags.join(', ') || undefined,
  };

  return (
    <div className="page-post">
      <JsonLd data={articleLd} />
      <article lang={post.lang !== 'es' ? post.lang : undefined} dir={post.lang === 'ar' ? 'rtl' : undefined}>
        <header className="page-head">
          <div className="wrap">
            <Breadcrumbs
              items={[{ label: 'Blog', href: '/blog/' }, { label: cat.name, href: `/blog/categoria/${post.category}/` }, { label: post.title }]}
            />
            <h1 className="post-title">{post.title}</h1>
            <p className="post-meta">
              Por <Link href="/el-despacho/">{site.lawyer}</Link>, abogado ICAV {site.collegeNumber}. Publicado el{' '}
              <time dateTime={post.date.toISOString()}>{fmt.format(post.date)}</time>
              {showUpdated && (
                <>
                  {' '}
                  y revisado el <time dateTime={post.updated!.toISOString()}>{fmt.format(post.updated!)}</time>
                </>
              )}
              .
            </p>
          </div>
        </header>

        <div className="wrap post-grid">
          {/* HTML generado en el build a partir del Markdown del repositorio (contenido propio, no de usuarios) */}
          <div className="prose post-body" dangerouslySetInnerHTML={{ __html: post.html }} />

          <aside className="post-aside">
            {servicio && enlaceServicio ? (
              <div className="aside-box">
                <p className="aside-box__title">¿Te pasa algo así?</p>
                <p>
                  Te ayudamos con <Link href={enlaceServicio}>{servicio.nombre.toLowerCase()}</Link>. Cuéntanos tu caso y te
                  diremos qué opciones tienes antes de dar ningún paso.
                </p>
                <Link className="btn btn--red" href={servicio.siguientePaso?.href ?? enlaceConsulta(servicio)}>
                  {servicio.siguientePaso?.label ?? servicio.cta ?? 'Consultar sobre esto'}
                </Link>
              </div>
            ) : area && (
              <div className="aside-box">
                <p className="aside-box__title">¿Necesitas ayuda con un asunto así?</p>
                <p>
                  Este artículo pertenece al área de <Link href={`/${area.slug}/`}>{area.name.toLowerCase()}</Link>, donde
                  explicamos cómo podemos ayudarte.
                </p>
                <Link className="btn btn--ghost" href={`/${area.slug}/`}>
                  Ver el área
                </Link>
              </div>
            )}
            <p className="disclaimer">
              Este artículo es informativo y no sustituye el estudio de tu caso concreto. Las normas cambian: comprueba la fecha de
              revisión.
            </p>
          </aside>
        </div>
      </article>

      {/* La herramienta DeCA solo aparece en artículos marcados con «deca» (guía o herramienta).
          En los de reclamaciones manda la contratación jurídica: no se promociona software (#6). */}
      {post.deca && (
        <section className="section section--tight">
          <div className="wrap">
            <DecaBand campaign="articulo_blog" />
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="section section--stone">
          <div className="wrap">
            <h2>Más artículos de {cat.name}</h2>
            <PostList posts={related} showCategory={false} />
          </div>
        </section>
      )}

      {servicio ? (
        <CtaBand
          title={servicio.cta ?? `¿Necesitas ayuda con ${servicio.nombre.toLowerCase()}?`}
          text="Cuéntanos qué ha pasado. Revisamos tu caso y te explicamos las opciones, el trabajo y los honorarios antes de empezar."
          href={servicio.siguientePaso?.href ?? enlaceConsulta(servicio)}
          canal={servicio.area === 'laboral' ? 'laboral' : 'general'}
        />
      ) : (
        <CtaBand canal={post.category === 'laboral' ? 'laboral' : 'general'} />
      )}
    </div>
  );
}
