import Link from 'next/link';
import { site, whatsapp } from '@/lib/site';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: "Consulta enviada",
  description: "Hemos recibido tu consulta en Praetoria División Jurídica. Te responderemos por el medio que hayas indicado.",
  path: '/gracias/',
  noindex: true,
});

export default function GraciasPage() {
  return (
    <div className="x">
    <section className="section">
        <div className="wrap">
          <h1>Hemos recibido tu consulta</h1>
          <p className="lede">Te responderemos lo antes posible por el medio que hayas indicado. Si tu asunto tiene un plazo que vence en los próximos días, llámanos o escríbenos por WhatsApp para que lo revisemos con prioridad.</p>
          <div className="actions">
            <a className="btn btn--red" href={whatsapp('Hola, acabo de enviar una consulta desde la web y tiene un plazo próximo.')}>Escribir por WhatsApp</a>
            <a className="btn btn--ghost" href={`tel:${site.phoneIntl}`}>Llamar al {site.phone}</a>
            <Link className="btn btn--ghost" href="/">Volver al inicio</Link>
          </div>
        </div>
      </section>

    </div>

  );
}
