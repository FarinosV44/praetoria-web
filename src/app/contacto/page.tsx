import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Icon, LineIcon } from '@/components/Icon';
import { ContactForm } from '@/components/ContactForm';
import { contactos, laboral, mensajes, site, whatsapp } from '@/lib/site';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: 'Contacto | Praetoria, abogados en Valencia',
  description:
    'Contacta con Praetoria, abogados en Valencia: atención jurídica general y área laboral, por teléfono, WhatsApp, correo o formulario. Cuéntanos qué quieres conseguir.',
  path: '/contacto/',
});

export default function ContactoPage() {
  return (
    <div className="page-contacto">
      <section className="page-head page-head--compacta">
        <div className="wrap">
          <Breadcrumbs items={[{ label: 'Contacto' }]} />
          <p className="antetitulo">
            <LineIcon name="objetivo" /> Solicitar una valoración
          </p>
          <h1>Cuéntanos qué quieres conseguir</h1>
          <p className="lede">
            Explícanos tu situación y tu objetivo. La consulta llega al área que la atiende y te respondemos por el medio que
            prefieras.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="wrap split">
          <ContactForm />

          <aside className="direct">
            <h2>Contactos del despacho</h2>
            <div className="direct__grupo">
              <p className="direct__area">
                <LineIcon name="edificio" /> {contactos.general.etiqueta}
              </p>
              <ul>
                <li>
                  <a href={`tel:${contactos.general.phoneIntl}`}>
                    <Icon name="phone" />
                    <span>
                      <strong>{contactos.general.phone}</strong>
                      {contactos.general.llamar}
                    </span>
                  </a>
                </li>
                <li>
                  <a href={whatsapp(mensajes.general)}>
                    <Icon name="whatsapp" />
                    <span>
                      <strong>{contactos.general.escribir}</strong>Al mismo número
                    </span>
                  </a>
                </li>
              </ul>
            </div>
            <div className="direct__grupo direct__grupo--laboral">
              <p className="direct__area">
                <LineIcon name="trabajo" /> {contactos.laboral.etiqueta}
              </p>
              <ul>
                <li>
                  <a href={`tel:${contactos.laboral.phoneIntl}`}>
                    <Icon name="phone" />
                    <span>
                      <strong>{contactos.laboral.phone}</strong>
                      {contactos.laboral.llamar}
                    </span>
                  </a>
                </li>
                <li>
                  <a href={whatsapp(mensajes.laboral, 'laboral')}>
                    <Icon name="whatsapp" />
                    <span>
                      <strong>{contactos.laboral.escribir}</strong>Al mismo número
                    </span>
                  </a>
                </li>
              </ul>
              <p className="small muted">
                Atiende {laboral.name}, {laboral.role.toLowerCase()}.
              </p>
            </div>
            <div className="direct__grupo">
              <p className="direct__area">
                <LineIcon name="correo" /> Correo general
              </p>
              <ul>
                <li>
                  <a href={`mailto:${site.email}`}>
                    <Icon name="mail" />
                    <span>
                      <strong>{site.email}</strong>Correo electrónico
                    </span>
                  </a>
                </li>
                <li>
                  <span className="noa">
                    <Icon name="pin" />
                    <span>
                      <strong>{site.address.street}</strong>
                      {site.address.postalCode} {site.address.locality} ({site.address.region})
                    </span>
                  </span>
                </li>
              </ul>
            </div>
            <div className="actions">
              <a className="btn btn--ghost" href="https://www.google.com/maps/dir/?api=1&destination=Calle%20Pintor%20Francisco%20Ribalta%204%2C%2046540%20El%20Puig%2C%20Valencia" rel="noopener">
                Cómo llegar
              </a>
              <Link className="btn btn--ghost" href="/abogado-el-puig/">
                El despacho en El Puig
              </Link>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
