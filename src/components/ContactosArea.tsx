import Link from 'next/link';
import { contactos, laboral, mensajes, site, whatsapp } from '@/lib/site';
import { Icon, LineIcon } from './Icon';

const MAPS = 'https://www.google.com/maps/dir/?api=1&destination=Calle%20Pintor%20Francisco%20Ribalta%204%2C%2046540%20El%20Puig%2C%20Valencia';

/**
 * Contactos del despacho por área (#28). Los números aparecen aquí, etiquetados por área, y no como reclamo del hero.
 * Laboral va al número del área laboral (llamadas y WhatsApp); todo lo demás, a la atención jurídica general.
 */
export function ContactosArea({ primero = 'general' }: { primero?: 'general' | 'laboral' }) {
  const general = (
    <div className="contacto-card" key="general">
      <p className="contacto-card__titulo">
        <LineIcon name="edificio" /> {contactos.general.etiqueta}
      </p>
      <p className="contacto-card__desc">Transporte, mercantil, Hacienda y Seguridad Social, civil, familia y arte.</p>
      <p className="contacto-card__numero">
        <a href={`tel:${contactos.general.phoneIntl}`}>{contactos.general.phone}</a>
      </p>
      <div className="contacto-card__acciones">
        <a className="btn btn--red" href={`tel:${contactos.general.phoneIntl}`}>
          <Icon name="phone" /> {contactos.general.llamar}
        </a>
        <a className="btn btn--ghost" href={whatsapp(mensajes.general)}>
          <Icon name="whatsapp" /> {contactos.general.escribir}
        </a>
      </div>
    </div>
  );
  const lab = (
    <div className="contacto-card contacto-card--laboral" key="laboral">
      <p className="contacto-card__titulo">
        <LineIcon name="trabajo" /> {contactos.laboral.etiqueta}
      </p>
      <p className="contacto-card__desc">
        Despidos, salarios, incapacidad, altas médicas y accidentes. Atiende {laboral.name}, {laboral.role.toLowerCase()}.
      </p>
      <p className="contacto-card__numero">
        <a href={`tel:${contactos.laboral.phoneIntl}`}>{contactos.laboral.phone}</a>
      </p>
      <div className="contacto-card__acciones">
        <a className="btn btn--red" href={`tel:${contactos.laboral.phoneIntl}`}>
          <Icon name="phone" /> {contactos.laboral.llamar}
        </a>
        <a className="btn btn--ghost" href={whatsapp(mensajes.laboral, 'laboral')}>
          <Icon name="whatsapp" /> {contactos.laboral.escribir}
        </a>
      </div>
    </div>
  );
  return (
    <div className="contactos">
      {primero === 'laboral' ? [lab, general] : [general, lab]}
      <div className="contacto-card contacto-card--correo">
        <p className="contacto-card__titulo">
          <LineIcon name="correo" /> Correo y despacho
        </p>
        <p className="contacto-card__numero contacto-card__numero--correo">
          <a href={`mailto:${site.email}`}>{site.email}</a>
        </p>
        <p className="contacto-card__desc">
          <Icon name="pin" /> {site.address.street}, {site.address.postalCode} {site.address.locality} (Valencia). Atención presencial y, cuando el asunto lo
          permite, por teléfono o videollamada.
        </p>
        <div className="contacto-card__acciones">
          <Link className="btn btn--ghost" href="/contacto/">
            {contactos.general.consulta}
          </Link>
          <a className="btn btn--ghost" href={MAPS} rel="noopener">
            Cómo llegar
          </a>
        </div>
      </div>
    </div>
  );
}
