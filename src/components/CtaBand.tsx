import Link from 'next/link';
import { Icon } from './Icon';
import { mensajes, site, whatsapp } from '@/lib/site';

export function CtaBand({
  title = 'Cuéntanos tu caso',
  text = 'Escuchamos tu situación antes de proponer una estrategia, y te explicamos el trabajo y los honorarios antes de empezar.',
  whatsappText = mensajes.general,
  href = '/contacto/',
  telefono,
}: {
  /** Teléfono de llamada distinto del general (Laboral: Lucía López, solo llamadas) */
  telefono?: { phone: string; phoneIntl: string; label: string };
  title?: string;
  text?: string;
  whatsappText?: string;
  /** Destino del formulario: /contacto/ o /contacto/?servicio=… para conservar el asunto */
  href?: string;
}) {
  return (
    <section className="section section--ink cta">
      <div className="wrap cta__inner">
        <div>
          <h2>{title}</h2>
          <p className="cta__text">{text}</p>
        </div>
        <div className="cta__actions">
          <a className="btn btn--red" href={whatsapp(whatsappText)}>
            <Icon name="whatsapp" /> Escribir por WhatsApp
          </a>
          <a className="btn cta__ghost" href={`tel:${telefono?.phoneIntl ?? site.phoneIntl}`}>
            <Icon name="phone" /> {telefono ? `${telefono.label} · ${telefono.phone}` : `Llamar al ${site.phone}`}
          </a>
          <Link className="cta__link" href={href}>
            O envíanos tu consulta por escrito
          </Link>
        </div>
      </div>
    </section>
  );
}
