import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { CtaBand } from '@/components/CtaBand';
import { Icon } from '@/components/Icon';
import { Composicion } from '@/components/Foto';
import { areas, mensajes, site, whatsapp } from '@/lib/site';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: "Abogado en El Puig",
  description: "Abogado en El Puig y comarca: derecho civil, mercantil, familia, transporte, Hacienda y patrimonio. Asesoramiento cercano y respuesta rápida.",
  path: '/abogado-el-puig/',
});

export default function ElPuigPage() {
  return (
    <div className="page-elpuig">
    <section className="page-head">
        <div className="wrap split">
          <div>
            <Breadcrumbs items={[{ label: 'El despacho', href: '/el-despacho/' }, { label: 'Abogado en El Puig' }]} />
            <h1>Abogado en El Puig para particulares y empresas</h1>
            <p className="lede">
              En El Puig y su comarca los problemas legales no esperan: conflictos familiares, deudas, contratos, requerimientos
              de Hacienda o cuestiones patrimoniales. Ofrecemos una respuesta jurídica práctica y cercana.
            </p>
            <div className="actions">
              <a className="btn btn--red" href={whatsapp()}><Icon name="whatsapp" /> Consultar mi caso</a>
              <a className="btn btn--ghost" href={`tel:${site.phoneIntl}`}><Icon name="phone" /> {site.phone}</a>
            </div>
          </div>
          {/* Sin fotos de instalaciones fuera de «El despacho» (#28): composición tipográfica con la dirección real */}
          <Composicion icono="edificio" etiqueta="Despacho en El Puig de Santa María" titulo={site.address.street} texto={`${site.address.postalCode} ${site.address.locality} (${site.address.region}) · Atención presencial, por teléfono o por videollamada`} />
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="prose">
            <p>
              Conocemos la zona y a quienes viven y trabajan en ella. Por eso ofrecemos soluciones rápidas, concretas y
              orientadas a proteger tus intereses, tanto si eres particular como si diriges una empresa. Cada caso es
              distinto: empezamos siempre por escuchar tu situación antes de proponer una estrategia.
            </p>
          </div>
          <h2 className="mt">Qué asuntos atendemos en El Puig</h2>
          <ul className="index-list">
            {areas.map((a) => (
              <li key={a.slug}>
                <h3><Link href={`/${a.slug}/`}>{a.name}</Link></h3>
                <p>{a.short}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section section--stone">
        <div className="wrap split">
          <div>
            <h2>Dónde estamos</h2>
            <address className="addr">
              <strong>{site.name}</strong><br />
              {site.address.street}<br />
              {site.address.postalCode} {site.address.locality} ({site.address.region})
            </address>
            <p>
              Atendemos en el despacho y, cuando el asunto lo permite, por teléfono o videollamada. También
              damos servicio a Puçol, Massamagrell, Rafelbunyol, La Pobla de Farnals, Museros y el resto de l&apos;Horta Nord.
            </p>
            <div className="actions">
              <a className="btn" href="https://www.google.com/maps/dir/?api=1&destination=Calle%20Pintor%20Francisco%20Ribalta%204%2C%2046540%20El%20Puig%2C%20Valencia" rel="noopener">Cómo llegar</a>
              <a className="btn btn--ghost" href={site.googleReviews} rel="noopener">Reseñas en Google</a>
            </div>
          </div>
          <address className="addr addr--bloque">
            <Icon name="pin" />
            <span>
              <strong>Praetoria</strong>
              {site.address.street}, {site.address.postalCode} {site.address.locality} ({site.address.region})
            </span>
          </address>
        </div>
      </section>

      <CtaBand
        title="Cuéntanos qué necesitas"
        text="Analizaremos tu situación y las opciones disponibles, ya sea un asunto personal, familiar o empresarial."
        whatsappText={mensajes.elPuig}
      />

    </div>

  );
}
