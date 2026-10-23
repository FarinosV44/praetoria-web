import { Breadcrumbs } from '@/components/Breadcrumbs';
import { CtaBand } from '@/components/CtaBand';
import { Icon } from '@/components/Icon';
import { JsonLd } from '@/components/JsonLd';
import { laboral, site } from '@/lib/site';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: "Juan José Farinós Ibáñez | Abogado en El Puig y Valencia",
  description: "Conoce a Juan José Farinós Ibáñez, abogado en El Puig y Valencia especializado en transporte, mercantil, civil, familia y Hacienda. Trayectoria y enfoque profesional.",
  path: '/el-despacho/',
  image: "/media/juan-jose-farinos.webp",
});

export default function DespachoPage() {
  const person = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: site.lawyer,
    jobTitle: 'Abogado',
    worksFor: { '@id': `${site.url}/#despacho` },
    memberOf: { '@type': 'Organization', name: site.college },
    sameAs: [site.linkedin],
    image: `${site.url}/media/juan-jose-farinos.webp`,
  };
  const photos = [
    ['despacho-salas-reuniones', 'Salas de reuniones acristaladas'],
    ['despacho-zona-espera', 'Zona de espera con sofá y mesas'],
    ['despacho-planta-abierta', 'Oficina de planta abierta'],
    ['despacho-sala-reunion', 'Sala de reuniones para consultas confidenciales'],
  ] as const;
  return (
    <div className="page-despacho">
      <JsonLd data={person} />
    <section className="page-head">
        <div className="wrap">
          <Breadcrumbs items={[{ label: 'El despacho' }]} />
          <h1>Soy Juan José Farinós, abogado y fundador de Praetoria</h1>
        </div>
      </section>

      <section className="section">
        <div className="wrap split">
          <div className="prose">
            <p>
              Soy abogado colegiado en el Ilustre Colegio de Abogados de Valencia, con el número {site.collegeNumber}, y
              tengo formación en Derecho y en Historia del Arte. A lo largo de los años he desarrollado mi actividad tanto en
              el ejercicio jurídico como en la gestión empresarial, especialmente en el transporte y la logística
              internacional.
            </p>
            <p>
              He asesorado a empresas, autónomos, familias y particulares, no solo desde el conocimiento legal, sino desde
              una comprensión de cómo funcionan realmente las cosas: cómo se organiza una sociedad, cómo se negocia un
              contrato, cómo se defiende una posición en un conflicto o cómo se protege un patrimonio, ya sea económico,
              familiar o cultural.
            </p>
            <p>
              La formación humanística me ayuda a mirar cada asunto desde más de un ángulo. Esa doble mirada, legal y
              estratégica, me permite ofrecer soluciones prácticas y pensadas para conseguir resultados. No concibo mi
              trabajo como una simple aplicación de normas: mi enfoque es acompañar, analizar, planificar y actuar con
              inteligencia jurídica y sentido común. Cada caso es distinto, y cada persona también.
            </p>
            <h2>Cómo trabajamos</h2>
            <p>
              Empezamos siempre por escuchar tu situación. Después identificamos qué está en juego, estudiamos la
              documentación y te proponemos una estrategia. Antes de iniciar cualquier actuación te explicamos el trabajo
              necesario y los honorarios.
            </p>
            <p>
              Atendemos en el despacho de El Puig y, cuando el asunto lo permite, por teléfono o videollamada en toda
              España. En los asuntos que lo requieren colaboramos con economistas y especialistas fiscales.
            </p>
            <p className="links">
              <a href={site.linkedin} rel="noopener"><Icon name="linkedin" /> Perfil en LinkedIn</a>
              <a href={site.googleReviews} rel="noopener">Opiniones de clientes en Google</a>
            </p>
          </div>
          <figure className="portrait">
            <img
              className="photo"
              src="/media/juan-jose-farinos-800.webp"
              alt="Juan José Farinós Ibáñez"
              width={600}
              height={800}
            />
            <figcaption>
              {site.lawyer}<br />Abogado, ICAV {site.collegeNumber}
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="section section--stone">
        <div className="wrap">
          <h2>Nuestro espacio</h2>
          <p className="lede">
            Un despacho moderno y sobrio en El Puig, con salas privadas para reuniones y consultas confidenciales.
          </p>
          <div className="grid">
            {photos.map(([src, alt]) => <img key={src} className="photo" src={`/media/${src}-800.webp`} alt={alt} width={800} height={600} loading="lazy" />)}
          </div>
          <address className="addr">
            <Icon name="pin" />
            <span>
              {site.address.street}, {site.address.postalCode} {site.address.locality} ({site.address.region})
            </span>
          </address>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <h2>Equipo</h2>
          <ul className="team">
            <li>
              <p className="team__name">{site.lawyer}</p>
              <p className="team__role">Abogado, fundador del despacho · ICAV {site.collegeNumber}</p>
              <p>
                <a href={`tel:${site.phoneIntl}`}>{site.phone}</a> · <a href={`mailto:${site.email}`}>{site.email}</a>
              </p>
            </li>
            <li>
              <p className="team__name">{laboral.name}</p>
              <p className="team__role">{laboral.role}</p>
              <p>
                Asuntos laborales: <a href={`tel:${laboral.phoneIntl}`}>{laboral.phone}</a> (llamadas)
              </p>
            </li>
          </ul>
        </div>
      </section>

      <section className="section section--stone">
        <div className="wrap">
          <h2>Datos del despacho</h2>
          <dl className="data">
            <div><dt>Titular</dt><dd>{site.legalName}, CIF {site.cif}</dd></div>
            <div><dt>Abogado responsable</dt><dd>{site.lawyer}</dd></div>
            <div><dt>Colegio profesional</dt><dd>{site.college}, n.º {site.collegeNumber}</dd></div>
            <div><dt>Domicilio</dt><dd>{site.address.street}, {site.address.postalCode} {site.address.locality}</dd></div>
          </dl>
        </div>
      </section>

      <CtaBand />

    </div>

  );
}
