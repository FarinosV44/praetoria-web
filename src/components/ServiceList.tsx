import Link from 'next/link';
import { getPosts } from '@/lib/content';
import { docLabel, enlaceConsulta, type Servicio } from '@/lib/servicios';

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
              {!s.pagina && s.revisamos && (
                <details className="service__more">
                  <summary>Qué revisamos y qué documentación ayuda</summary>
                  <ul className="checks">
                    {s.revisamos.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                  {s.documentacion && (
                    <p className="small">
                      <strong>Documentación orientativa</strong> (no la adjuntes en el formulario): {s.documentacion.map(docLabel).join('; ')}.
                    </p>
                  )}
                  {s.alcance && <p className="small muted">{s.alcance}</p>}
                  {s.fuentes && (
                    <p className="small muted">
                      Normas:{' '}
                      {s.fuentes.map((f, i) => (
                        <span key={f.href}>
                          {i > 0 && ' · '}
                          <a href={f.href} rel="noopener">
                            {f.label}
                          </a>
                        </span>
                      ))}
                    </p>
                  )}
                </details>
              )}
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
