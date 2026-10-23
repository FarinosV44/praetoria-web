import Link from 'next/link';
import { getPosts } from '@/lib/content';
import { buildMetadata } from '@/lib/seo';
import { areas, groups, laboral, site } from '@/lib/site';
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

const metodo = [
  ['Escuchar y analizar', 'Nos cuentas qué ha pasado y qué te preocupa. Revisamos la documentación y el contexto antes de opinar.'],
  ['Valorar opciones y riesgos', 'Te explicamos qué caminos hay (negociar, reclamar, defenderse o esperar) y qué puede salir bien o mal en cada uno.'],
  ['Diseñar la estrategia', 'Decidimos contigo el camino y el calendario. Antes de empezar sabes qué vamos a hacer y cuánto cuesta.'],
  ['Actuar y hacer seguimiento', 'Ejecutamos lo acordado y te mantenemos informado en cada paso, hasta cerrar el asunto.'],
] as const;

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
      <section className="h-hero">
        <div className="wrap h-hero__grid">
          <div>
            <h1>
              Estrategia jurídica para empresas y particulares
              <span className="h-hero__place">Abogados en El Puig y Valencia</span>
            </h1>
            <p className="lede">
              Antes de actuar, entendemos tu situación, valoramos las opciones y sus riesgos y te proponemos un camino claro, con el
              trabajo y los honorarios explicados desde el principio.
            </p>
            <div className="actions">
              <Link className="btn btn--red" href="/contacto/">
                Cuéntanos tu caso
              </Link>
              <a className="btn btn--ghost" href={`tel:${site.phoneIntl}`}>
                <Icon name="phone" /> {site.phone}
              </a>
            </div>
          </div>
          <figure className="h-hero__photo">
            <img
              className="photo"
              src="/media/despacho-salas-reuniones-800.webp"
              alt="Salas de reuniones acristaladas del despacho en El Puig"
              width={800}
              height={600}
              fetchPriority="high"
            />
            <figcaption>El despacho, en El Puig de Santa María.</figcaption>
          </figure>
        </div>
      </section>

      <section className="section section--tight">
        <div className="wrap">
          <h2>En qué podemos ayudarte</h2>
          <div className="directory">
            {(['empresas', 'particulares'] as const).map((g) => (
              <section key={g} className="directory__col" aria-labelledby={`dir-${g}`}>
                <h3 id={`dir-${g}`}>{groups[g].title}</h3>
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
            ))}
          </div>
        </div>
      </section>

      <section className="section section--stone">
        <div className="wrap">
          <h2>Cómo trabajamos</h2>
          <p className="lede">Cada asunto sigue el mismo método, tanto si es una reclamación urgente como una decisión de empresa.</p>
          <ol className="method-steps">
            {metodo.map(([t, d]) => (
              <li key={t}>
                <h3>{t}</h3>
                <p>{d}</p>
              </li>
            ))}
          </ol>
          <p className="method-note">
            No prometemos resultados: te decimos con claridad dónde estás, qué se puede conseguir y qué cuesta intentarlo.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <h2>Quién lleva tu asunto</h2>
          <div className="people">
            <div className="person person--photo">
              <img src="/media/juan-jose-farinos-800.webp" alt="Juan José Farinós Ibáñez" width={600} height={800} loading="lazy" />
              <div>
                <p className="person__name">{site.lawyer}</p>
                <p className="person__role">Abogado y fundador del despacho · ICAV {site.collegeNumber}</p>
                <p>
                  Formación en Derecho y en Historia del Arte, y una larga trayectoria en la gestión de empresas, sobre todo en el
                  transporte y la logística internacional. Conoce cómo se organiza una sociedad, cómo se negocia un contrato y cómo
                  se defiende una posición en un conflicto, porque lo ha vivido desde dentro.
                </p>
                <Link href="/el-despacho/">Conocer el despacho</Link>
              </div>
            </div>
            <div className="person person--text">
              <p className="person__name">{laboral.name}</p>
              <p className="person__role">{laboral.role}</p>
              <p>Atiende los asuntos laborales del despacho.</p>
              <p>
                <a href={`tel:${laboral.phoneIntl}`}>{laboral.phone}</a> (llamadas)
              </p>
              <Link href="/abogado-laboralista-valencia/">Ver el área laboral</Link>
            </div>
          </div>
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
            <img src="/media/despacho-planta-abierta-800.webp" alt="Zona de trabajo del despacho, de planta abierta" width={800} height={600} loading="lazy" className="photo" />
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
