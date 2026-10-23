import Link from 'next/link';
import { Icon } from './Icon';
import { site, whatsapp } from '@/lib/site';

export function CtaBand({
  title = 'Cuéntanos tu caso',
  text = 'Escuchamos tu situación antes de proponer una estrategia, y te explicamos el trabajo y los honorarios antes de empezar.',
  whatsappText = 'Hola, quiero consultar mi caso con Praetoria.',
}: {
  title?: string;
  text?: string;
  whatsappText?: string;
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
          <a className="btn cta__ghost" href={`tel:${site.phoneIntl}`}>
            <Icon name="phone" /> Llamar al {site.phone}
          </a>
          <Link className="cta__link" href="/contacto/">
            O envíanos tu consulta por escrito
          </Link>
        </div>
      </div>
    </section>
  );
}
