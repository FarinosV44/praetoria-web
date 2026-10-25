import Link from 'next/link';
import type { Post } from '@/lib/content';
import { categories } from '@/lib/site';
import { imagen } from '@/lib/imagenes';
import { iconoCategoria } from '@/lib/iconos';
import { Composicion, Foto } from './Foto';

const fmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' });

// Tarjetas de artículo con su imagen destacada (#28). Sin imagen pertinente: composición tipográfica
// con el icono de la categoría, nunca una foto cualquiera. `compact` = lista de títulos sin imagen.
export function PostList({ posts, showCategory = true, compact = false }: { posts: Post[]; showCategory?: boolean; compact?: boolean }) {
  return (
    <div className="posts-root">
      <ul className={compact ? 'posts posts--compact' : 'posts posts--tarjetas'}>
        {posts.map((p) => {
          const foto = compact ? undefined : imagen(p.imagen);
          return (
            <li key={p.slug} lang={p.lang !== 'es' ? p.lang : undefined} dir={p.lang === 'ar' ? 'rtl' : undefined}>
              {!compact && (
                <div className="posts__media">
                  {foto ? (
                    // El titular ya nombra el artículo: la miniatura no repite el alt (sería ruido para lectores de pantalla)
                    <Foto img={foto} sizes="(min-width: 1180px) 360px, (min-width: 700px) 45vw, 92vw" ancho={480} decorativa />
                  ) : (
                    <Composicion icono={iconoCategoria[p.category]} titulo={categories[p.category].name} variante="tarjeta" />
                  )}
                </div>
              )}
              <p className="posts__meta">
                {showCategory && <Link href={`/blog/categoria/${p.category}/`}>{categories[p.category].name}</Link>}
                <time dateTime={p.date.toISOString()}>{fmt.format(p.date)}</time>
              </p>
              <h3>
                <Link href={`/${p.slug}/`}>{p.title}</Link>
              </h3>
              {!compact && <p className="posts__desc">{p.description}</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
