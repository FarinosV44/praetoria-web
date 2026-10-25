import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { CtaBand } from '@/components/CtaBand';
import { ContactosArea } from '@/components/ContactosArea';
import { LineIcon } from '@/components/Icon';
import { JsonLd } from '@/components/JsonLd';
import { areas, laboral, site } from '@/lib/site';
import { iconoArea, metodo } from '@/lib/iconos';
import { buildMetadata } from '@/lib/seo';
import { creditoDe, imagen } from '@/lib/imagenes';
import { Composicion, Foto } from '@/components/Foto';

export const metadata = buildMetadata({
  title: 'El despacho | Praetoria, abogados en Valencia',
  description:
    'Praetoria División Jurídica: despacho de abogados en Valencia para empresas y particulares. Entendemos tu objetivo, analizamos las opciones y diseñamos la estrategia jurídica.',
  path: '/el-despacho/',
});

export default function DespachoPage() {
  // Identificación profesional y autoría de los contenidos (sin fotografía, #28)
  const person = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: site.lawyer,
    jobTitle: 'Abogado',
    worksFor: { '@id': `${site.url}/#despacho` },
    memberOf: { '@type': 'Organization', name: site.college },
    sameAs: [site.linkedin],
  };
  // Únicas fotos de instalaciones del sitio (#28): dos, secundarias, al final de la página
  // Recreación personalizada autorizada (#28 §8): discreta, en un bloque secundario
  const estrategia = imagen('despacho-estrategia');
  const instalaciones = [imagen('despacho-salas'), imagen('despacho-atencion')].filter((i) => !!i);
  return (
    <div className="page-despacho">
      <JsonLd data={person} />
      <section className="page-head area-head">
        <div className="wrap">
          <Breadcrumbs items={[{ label: 'El despacho' }]} />
          <div className="area-head__grid">
            <div className="area-head__texto">
              <p className="antetitulo">
                <LineIcon name="edificio" /> Praetoria División Jurídica
              </p>
              <h1>Un despacho que empieza por tu objetivo</h1>
              <p className="lede">
                Asesoramos a empresas, autónomos, familias y particulares en Valencia. Primero entendemos qué quieres conseguir;
                después analizamos las opciones y diseñamos la estrategia jurídica para defender tus intereses.
              </p>
            </div>
            <Composicion icono="edificio" etiqueta="Abogados en Valencia" titulo="Empresas, autónomos, familias y particulares" texto="Atención presencial en nuestras oficinas del centro de Valencia y en El Puig de Santa María y, cuando el asunto lo permite, por teléfono o videollamada." />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap intro-grid">
          <div className="prose">
            <h2>Criterio jurídico y visión de empresa</h2>
            <p>
              El despacho combina el ejercicio de la abogacía con experiencia directa en la gestión empresarial, especialmente en
              el transporte y la logística internacional, y con formación humanística. Por eso analizamos cada asunto desde más de
              un ángulo: cómo se organiza una sociedad, cómo se negocia un contrato, cómo se defiende una posición en un conflicto
              o cómo se protege un patrimonio, económico, familiar o cultural.
            </p>
            <p>
              No entendemos el trabajo como una simple aplicación de normas. Negociamos cuando conviene y preparamos la vía
              judicial cuando hace falta, siempre con un objetivo claro y con el trabajo y los honorarios explicados antes de
              empezar. En los asuntos que lo requieren colaboramos con economistas y especialistas fiscales.
            </p>
            <p>
              Atendemos de forma presencial y, cuando el asunto lo permite, por teléfono o videollamada en toda España.
            </p>
          </div>
          <div className="intro-lateral">
            {estrategia && (
              <figure className="foto-secundaria">
                <Foto img={estrategia} sizes="(min-width: 960px) 340px, 92vw" ancho={800} />
                <figcaption>{creditoDe(estrategia)}</figcaption>
              </figure>
            )}
          <aside className="metodo-mini" aria-label="Cómo trabajamos">
            <p className="metodo-mini__titulo">Cómo trabajamos</p>
            <ol>
              {metodo.map((m) => (
                <li key={m.titulo}>
                  <LineIcon name={m.icono} />
                  <span>{m.titulo}</span>
                </li>
              ))}
            </ol>
          </aside>
          </div>
        </div>
      </section>

      <section className="section section--stone">
        <div className="wrap">
          <div className="seccion-cabecera">
            <p className="antetitulo">Áreas de práctica</p>
            <h2>Organizados por áreas</h2>
          </div>
          <ul className="areas-lista">
            {areas.map((a) => (
              <li key={a.slug}>
                <Link href={`/${a.slug}/`}>
                  <LineIcon name={iconoArea[a.id]} />
                  <span>
                    <strong>{a.name}</strong>
                    {a.short}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="seccion-cabecera">
            <p className="antetitulo">Nuestro espacio</p>
            <h2>Un espacio sobrio y confidencial</h2>
            <p className="lede">
              Salas privadas para reuniones y consultas confidenciales en nuestras oficinas multidisciplinares de 300 m² en el centro de
              Valencia.
            </p>
          </div>
          <div className="galeria galeria--dos">
            {instalaciones.map((img) => (
              <Foto key={img.id} img={img} sizes="(min-width: 960px) 36vw, 92vw" className="photo" />
            ))}
          </div>
        </div>
      </section>

      <section className="section section--stone">
        <div className="wrap">
          <h2>Datos del despacho</h2>
          <dl className="data">
            <div><dt>Titular</dt><dd>{site.legalName}, CIF {site.cif}</dd></div>
            <div><dt>Letrado responsable</dt><dd>{site.lawyer}, {site.college}, n.º {site.collegeNumber}</dd></div>
            <div><dt>Área laboral</dt><dd>{laboral.name}, {laboral.role.toLowerCase()}</dd></div>
            <div><dt>Domicilio social</dt><dd>{site.address.street}, {site.address.postalCode} {site.address.locality}</dd></div>
            <div>
              <dt>Perfiles</dt>
              <dd>
                <a href={site.linkedin} rel="noopener">LinkedIn</a> · <a href={site.googleReviews} rel="noopener">Opiniones en Google</a>
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <h2>Contacta con el despacho</h2>
          <ContactosArea />
        </div>
      </section>

      <CtaBand />
    </div>
  );
}
