import Link from 'next/link';
import { getPosts } from '@/lib/content';
import { enlaceConsulta, type Servicio } from '@/lib/servicios';

// Lista de servicios de un área con su siguiente paso concreto (#5):
// la consulta con el servicio ya elegido, o la herramienta propia del servicio (cuestionario de Hacienda o divorcio).
export function ServiceList({ services }: { services: Servicio[] }) {
  const posts = getPosts();
  return (
    <ul className="services">
      {services.map((s) => {
        const next = s.siguientePaso ?? { label: s.cta ?? 'Consultar sobre esto', href: enlaceConsulta(s) };
        const reads = (s.articulos ?? []).map((slug) => posts.find((p) => p.slug === slug)).filter((p) => !!p);
        return (
          <li key={s.id} id={s.id} className="service">
            <h3 className="service__name">{s.nombre}</h3>
            <div className="service__body">
              {s.resumen && <p>{s.resumen}</p>}
              {reads.length > 0 && (
                <p className="service__reads">
                  <span>Para leer antes:</span>{' '}
                  {reads.map((p, i) => (
                    <span key={p.slug}>
                      {i > 0 && ' · '}
                      <Link href={`/${p.slug}/`}>{p.title}</Link>
                    </span>
                  ))}
                </p>
              )}
              <p className="service__next">
                <Link href={next.href}>{next.label}</Link>
                {s.pagina && !next.href.startsWith(s.pagina) && (
                  <>
                    {' '}
                    o <Link href={s.pagina}>ver el servicio en detalle</Link>
                  </>
                )}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
