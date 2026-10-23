import Link from 'next/link';
import { getPosts } from '@/lib/content';
import { buildMetadata } from '@/lib/seo';
import { areas, groups, site } from '@/lib/site';
import { PostList } from '@/components/PostList';
import { DecaBand } from '@/components/DecaBand';
import { CtaBand } from '@/components/CtaBand';
import { Icon } from '@/components/Icon';

export const metadata = buildMetadata({
  title: 'Abogado en El Puig y Valencia | Praetoria División Jurídica',
  description:
    'Asesoramiento jurídico para empresas y particulares en Valencia. Transporte, contratos, conflictos mercantiles, Hacienda, Seguridad Social y patrimonio.',
  path: '/',
});

export default function HomePage() {
  // Últimos artículos sin que el DECA acapare la portada: uno por categoría, en orden de fecha
  const seen = new Set<string>();
  const latest = getPosts()
    .filter((p) => p.lang === 'es')
    .filter((p) => {
      if (seen.has(p.category)) return false;
      seen.add(p.category);
      return true;
    })
    .slice(0, 4);

  return (
    <div className="page-home">
    <section className="hero">
        <div className="wrap">
          <div className="hero__head">
            <h1>Abogado en El Puig y Valencia para empresas y particulares</h1>
            <p className="lede">
              Asesoramiento jurídico directo, con experiencia empresarial real. Atendemos en el despacho de El Puig y por
              videollamada en toda España.
            </p>
          </div>

          <div className="directory">
            {
              (['empresas', 'particulares'] as const).map((g) => (
                <section key={g} className="directory__col" aria-labelledby={`dir-${g}`}>
                  <h2 id={`dir-${g}`}>{groups[g].title}</h2>
                  <ul>
                    {areas
                      .filter((a) => a.group === g)
                      .map((a) => (
                        <li key={a.slug}>
                          <Link href={`/${a.slug}/`}>
                            <span className="directory__name">{a.name}</span>
                            <span className="directory__desc">{a.short}</span>
                          </Link>
                        </li>
                      ))}
                  </ul>
                </section>
              ))
            }
          </div>

          <p className="hero__sign">
            <strong>{site.lawyer}</strong>, abogado colegiado n.º {site.collegeNumber} del Ilustre Colegio de Abogados de
            Valencia.
          </p>
        </div>
      </section>

      <section className="section section--stone">
        <div className="wrap split">
          <div>
            <h2>Un abogado que conoce la empresa desde dentro</h2>
            <div className="prose">
              <p>
                Juan José Farinós tiene formación en Derecho y en Historia del Arte, y una larga trayectoria en la gestión de
                empresas, especialmente en el transporte y la logística internacional. Ha asesorado a empresas, autónomos,
                familias y particulares desde una comprensión práctica de cómo funcionan las cosas: cómo se organiza una
                sociedad, cómo se negocia un contrato, cómo se defiende una posición en un conflicto o cómo se protege un
                patrimonio.
              </p>
              <p>
                No resolvemos solo el conflicto que llega: anticipamos escenarios y acompañamos las decisiones importantes
                con criterio jurídico. Antes de empezar, te explicamos el trabajo necesario y los honorarios.
              </p>
            </div>
            <div className="actions">
              <Link className="btn btn--ghost" href="/el-despacho/">Conocer el despacho</Link>
            </div>
          </div>
          <img
            className="photo portrait"
            src="/media/juan-jose-farinos-800.webp"
            alt="Juan José Farinós Ibáñez, abogado de Praetoria División Jurídica"
            width={600}
            height={800}
            loading="lazy"
          />
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <h2>Si te urge, empieza por aquí</h2>
          <div className="urgent">
            <Link className="urgent__item" href="/abogado-hacienda-y-seguridad-social-en-valencia/">
              <h3>Me ha llegado una carta de Hacienda o de la Seguridad Social</h3>
              <p>
                Requerimientos, liquidaciones, sanciones, apremios o embargos. Responde unas preguntas y envíanos un resumen
                antes de que corra el plazo.
              </p>
              <span className="urgent__go">Revisar mi notificación</span>
            </Link>
            <Link className="urgent__item" href="/abogado-divorcio-horta-nord-valencia/">
              <h3>Queremos divorciarnos de mutuo acuerdo</h3>
              <p>
                Precio cerrado de 399 € en total (199,50 € por cónyuge), con abogado, procurador e IVA incluidos, si no hay
                hijos menores ni bienes que repartir.
              </p>
              <span className="urgent__go">Comprobar si mi caso entra</span>
            </Link>
            <Link className="urgent__item" href="/logistica-y-transporte-internacional/">
              <h3>Un cliente no me paga un porte</h3>
              <p>
                Reclamación de facturas de transporte, acción directa contra el cargador y revisión de CMR, órdenes de carga y
                comunicaciones.
              </p>
              <span className="urgent__go">Ver cómo reclamamos</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="section section--tight">
        <div className="wrap">
          <DecaBand campaign="home" />
        </div>
      </section>

      <section className="section">
        <div className="wrap split split--rev">
          <div className="office">
            <img src="/media/despacho-salas-reuniones-800.webp" alt="Salas de reuniones acristaladas del despacho" width={800} height={600} loading="lazy" className="photo" />
            <img src="/media/despacho-zona-espera-800.webp" alt="Zona de espera con sofá y mesas" width={800} height={600} loading="lazy" className="photo" />
          </div>
          <div>
            <h2>El despacho, en El Puig</h2>
            <p className="lede">
              Salas de reuniones privadas para consultas confidenciales, a pocos minutos de Valencia y de toda l&apos;Horta Nord.
            </p>
            <ul className="facts">
              <li><Icon name="pin" /> {site.address.street}, {site.address.postalCode} {site.address.locality}</li>
              <li><Icon name="phone" /> <a href={`tel:${site.phoneIntl}`}>{site.phone}</a>, también por WhatsApp</li>
              <li><Icon name="mail" /> <a href={`mailto:${site.email}`}>{site.email}</a></li>
            </ul>
            <div className="actions">
              <Link className="btn" href="/abogado-el-puig/">Abogado en El Puig</Link>
              <a className="btn btn--ghost" href={site.googleReviews} rel="noopener">Reseñas en Google</a>
            </div>
          </div>
        </div>
      </section>

      <section className="section section--stone">
        <div className="wrap">
          <div className="head-row">
            <h2>Del blog</h2>
            <Link href="/blog/">Todos los artículos</Link>
          </div>
          <PostList posts={latest} />
        </div>
      </section>

      <CtaBand />

    </div>

  );
}
