import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Icon, LineIcon } from '@/components/Icon';
import { LlamadaForm } from '@/components/LlamadaForm';
import { contactos } from '@/lib/site';
import { buildMetadata } from '@/lib/seo';

// «Que me llame un abogado» (#33): solicitud de contacto prioritario. Sin promesas de disponibilidad ni de plazos de respuesta.
export const metadata = buildMetadata({
  title: 'Que me llame un abogado | Solicitud de contacto prioritario',
  description:
    'Si tu asunto tiene una fecha próxima —una citación, un juicio o un plazo—, deja tu teléfono y el despacho intentará llamarte según disponibilidad.',
  path: '/que-me-llame-un-abogado/',
});

export default function LlamadaPage() {
  return (
    <div className="page-contacto">
      <section className="page-head page-head--compacta">
        <div className="wrap">
          <Breadcrumbs items={[{ label: 'Contacto', href: '/contacto/' }, { label: 'Que me llame un abogado' }]} />
          <p className="antetitulo">
            <LineIcon name="reloj" /> Contacto prioritario
          </p>
          <h1>Que me llame un abogado</h1>
          <p className="lede">
            Para asuntos con una fecha próxima: una detención, una citación, un juicio o un plazo que vence. Deja tu teléfono y el motivo, y el
            despacho intentará llamarte según disponibilidad.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="wrap split">
          <LlamadaForm />

          <aside className="direct">
            <h2>Si no puede esperar</h2>
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
              </ul>
            </div>
            <div className="direct__grupo">
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
              </ul>
            </div>
            <p className="small">
              <strong>Si estás en peligro o presencias un delito que se está cometiendo, llama al 112.</strong>
            </p>
            <p className="small muted">
              No es un servicio de guardia permanente. Para consultas sin urgencia, usa el <Link href="/contacto/">formulario de contacto</Link>.
            </p>
          </aside>
        </div>
      </section>
    </div>
  );
}
