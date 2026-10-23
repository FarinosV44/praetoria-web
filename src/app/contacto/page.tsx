import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Icon } from '@/components/Icon';
import { ContactForm } from '@/components/ContactForm';
import { laboral, site, whatsapp } from '@/lib/site';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: "Contacto | Abogados en Valencia y El Puig",
  description: "Contacta con Praetoria División Jurídica en Valencia y El Puig. Primera valoración de tu caso en transporte, mercantil, civil, familia, Hacienda o patrimonio.",
  path: '/contacto/',
});

export default function ContactoPage() {
  return (
    <div className="page-contacto">
    <section className="page-head">
        <div className="wrap">
          <Breadcrumbs items={[{ label: 'Contacto' }]} />
          <h1>Cuéntanos tu caso</h1>
          <p className="lede">
            Cada caso merece ser escuchado con atención. Escríbenos por el medio que prefieras y te responderemos lo antes
            posible.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="wrap split">
          <ContactForm />

          <aside className="direct">
            <h2>O habla directamente con nosotros</h2>
            <ul>
              <li>
                <a href={`tel:${site.phoneIntl}`}><Icon name="phone" /><span><strong>{site.phone}</strong>Teléfono</span></a>
              </li>
              <li>
                <a href={whatsapp()}><Icon name="whatsapp" /><span><strong>WhatsApp</strong>Al mismo número</span></a>
              </li>
              <li>
                <a href={`tel:${laboral.phoneIntl}`}><Icon name="phone" /><span><strong>{laboral.phone}</strong>Asuntos laborales: {laboral.name}, {laboral.role.toLowerCase()} (solo llamadas)</span></a>
              </li>
              <li>
                <a href={`mailto:${site.email}`}><Icon name="mail" /><span><strong>{site.email}</strong>Correo electrónico</span></a>
              </li>
              <li>
                <span className="noa"><Icon name="pin" /><span><strong>{site.address.street}</strong>{site.address.postalCode} {site.address.locality} ({site.address.region})</span></span>
              </li>
            </ul>
            <a className="btn btn--ghost" href="https://www.google.com/maps/dir/?api=1&destination=Calle%20Pintor%20Francisco%20Ribalta%204%2C%2046540%20El%20Puig%2C%20Valencia" rel="noopener">Cómo llegar en Google Maps</a>
          </aside>
        </div>
      </section>

    </div>

  );
}
