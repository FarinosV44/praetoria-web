import Link from 'next/link';
import { getPosts } from '@/lib/content';
import { areas, groups, mensajes, site } from '@/lib/site';
import { enlaceConsulta, type Servicio } from '@/lib/servicios';
import { Breadcrumbs } from './Breadcrumbs';
import { CtaBand } from './CtaBand';
import { Faq } from './Faq';
import { Icon } from './Icon';
import { PostList } from './PostList';

// Página propia de un servicio (#6, reutilizable en #7 y #8): problema, a quién va, qué revisamos,
// cómo trabajamos, documentación orientativa, preguntas frecuentes, guías y fuentes oficiales.
// Todo sale de src/lib/servicios.ts; aquí no se escribe texto jurídico.
export function ServicePage({ servicio: s }: { servicio: Servicio }) {
  const area = areas.find((a) => a.id === s.area)!;
  const group = groups[area.group];
  const posts = getPosts();
  const guias = (s.articulos ?? []).map((slug) => posts.find((p) => p.slug === slug)).filter((p) => !!p);
  const consulta = enlaceConsulta(s);
  const cta = s.cta ?? 'Consultar sobre esto';

  return (
    <div className="service-page">
      <section className="page-head">
        <div className="wrap">
          <Breadcrumbs items={[{ label: group.title, href: group.href }, { label: area.name, href: `/${area.slug}/` }, { label: s.nombre }]} />
          <h1>{s.seo?.h1 ?? s.nombre}</h1>
          {s.problema && <p className="lede">{s.problema}</p>}
          <div className="actions">
            <Link className="btn btn--red" href={consulta}>
              {cta}
            </Link>
            <a className="btn btn--ghost" href={`tel:${site.phoneIntl}`}>
              <Icon name="phone" /> {site.phone}
            </a>
          </div>
          {s.destinatario && <p className="service-page__for">{s.destinatario}</p>}
        </div>
      </section>

      <section className="section">
        <div className="wrap service-page__grid">
          {s.revisamos && (
            <div>
              <h2>Qué revisamos</h2>
              <ul className="checks">
                {s.revisamos.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          )}
          {s.proceso && (
            <div>
              <h2>Cómo trabajamos</h2>
              <ol className="method-steps method-steps--compact">
                {s.proceso.map((p) => (
                  <li key={p}>
                    <p>{p}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </section>

      {s.documentacion && (
        <section className="section section--stone">
          <div className="wrap service-page__docs">
            <div>
              <h2>Qué documentación ayuda</h2>
              <p>
                Es orientativa: no hace falta tenerla toda para consultar. <strong>No la adjuntes en el formulario</strong>; si hace falta,
                te la pediremos después por un canal seguro.
              </p>
            </div>
            <ul className="checks">
              {s.documentacion.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {(!!s.faqs?.length || guias.length > 0 || !!s.fuentes?.length) && (
        <section className="section">
          <div className="wrap">
            {s.faqs && s.faqs.length > 0 && <Faq items={s.faqs} />}
            {guias.length > 0 && (
              <div className="service-page__reads">
                <h2>Para leer antes</h2>
                <PostList posts={guias} showCategory={false} />
              </div>
            )}
            {s.fuentes && (
              <div className="service-page__sources">
                <h2>Normas citadas</h2>
                <ul>
                  {s.fuentes.map((f) => (
                    <li key={f.href}>
                      <a href={f.href} rel="noopener">
                        {f.label}
                      </a>
                    </li>
                  ))}
                </ul>
                <p className="small muted">
                  Información general, no asesoramiento sobre tu caso. La aplicación de cada norma depende de los hechos y documentos concretos.
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      <CtaBand
        title={cta}
        text="Cuéntanos qué ha pasado. Revisamos tu caso y te explicamos las opciones, el trabajo y los honorarios antes de empezar."
        href={consulta}
        whatsappText={area.id in mensajes ? mensajes[area.id as keyof typeof mensajes] : mensajes.general}
      />
    </div>
  );
}
