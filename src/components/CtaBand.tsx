import Link from 'next/link';
import { Icon, LineIcon } from './Icon';
import { contactos, mensajes, whatsapp, type CanalId } from '@/lib/site';

/** Banda final de contacto. El canal decide a qué número llaman y escriben los botones (#28): laboral o general. */
export function CtaBand({
  title = 'Cuéntanos qué quieres conseguir',
  text = 'Escuchamos tu situación, te explicamos las opciones y diseñamos contigo la estrategia, con el trabajo y los honorarios claros antes de empezar.',
  whatsappText,
  href = '/contacto/',
  canal = 'general',
}: {
  title?: string;
  text?: string;
  whatsappText?: string;
  /** Destino del formulario: /contacto/ o /contacto/?servicio=… para conservar el asunto */
  href?: string;
  canal?: CanalId;
}) {
  const c = contactos[canal];
  return (
    <section className="section section--ink cta">
      <div className="wrap cta__inner">
        <div>
          <h2>{title}</h2>
          <p className="cta__text">{text}</p>
        </div>
        <div className="cta__actions">
          <Link className="btn btn--red" href={href}>
            {c.consulta} <LineIcon name="flecha" />
          </Link>
          <a className="btn cta__ghost" href={whatsapp(whatsappText ?? (canal === 'laboral' ? mensajes.laboral : mensajes.general), canal)}>
            <Icon name="whatsapp" /> {c.escribir}
          </a>
          <a className="cta__link" href={`tel:${c.phoneIntl}`}>
            <Icon name="phone" /> {c.llamar}: {c.phone}
          </a>
        </div>
      </div>
    </section>
  );
}
