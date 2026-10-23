import { getPosts } from '@/lib/content';
import { buildMetadata } from '@/lib/seo';
import { mensajes, site, whatsapp } from '@/lib/site';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Faq } from '@/components/Faq';
import { PostList } from '@/components/PostList';
import { Icon } from '@/components/Icon';
import { HaciendaTriage } from '@/components/HaciendaTriage';

export const metadata = buildMetadata({
  title: 'Abogado Hacienda y Seguridad Social en Valencia',
  description:
    '¿Has recibido un requerimiento, liquidación, sanción o deuda de Hacienda o Seguridad Social? Estudiamos tu caso, los plazos y la respuesta adecuada.',
  path: '/abogado-hacienda-y-seguridad-social-en-valencia/',
});

const faq = [
  {
    q: 'Me ha llegado una carta de Hacienda, ¿qué debo hacer?',
    a: 'No la ignores ni envíes documentación sin revisar antes qué procedimiento se ha iniciado. Conserva la notificación completa y anota cuándo la recibiste o abriste para comprobar el plazo aplicable.',
  },
  {
    q: '¿Cuánto tiempo tengo para contestar un requerimiento de Hacienda?',
    a: 'Depende del acto recibido y de la forma y fecha de notificación. El plazo debe verificarse en el documento completo; no conviene esperar al último día.',
  },
  {
    q: '¿Se puede recurrir una liquidación o una sanción de Hacienda?',
    a: 'En muchos casos existen vías de alegación o recurso, pero deben valorarse el expediente, los hechos, las pruebas, la motivación y el plazo concreto.',
  },
  {
    q: '¿Recurrir paraliza automáticamente el cobro?',
    a: 'No siempre. La impugnación y el riesgo recaudatorio deben estudiarse conjuntamente según el acto y la fase del procedimiento.',
  },
  {
    q: '¿Qué puedo hacer si me embargan una cuenta por una deuda de Hacienda o de la Seguridad Social?',
    a: 'Conviene revisar de inmediato el origen de la deuda, si el procedimiento se notificó correctamente y si existen motivos de oposición al apremio o al propio embargo, antes de que se ejecuten más actuaciones.',
  },
  {
    q: '¿Puede Hacienda derivar la responsabilidad de una deuda al administrador de la empresa?',
    a: 'En determinados supuestos sí, mediante un expediente de derivación de responsabilidad. Es un procedimiento independiente que también admite alegaciones y recurso, y conviene analizarlo cuanto antes.',
  },
  {
    q: '¿Qué documentación necesitáis para estudiar mi caso?',
    a: 'La notificación completa, la fecha de recepción o apertura, los documentos relacionados y una explicación breve de lo sucedido.',
  },
  {
    q: '¿Podéis atenderme fuera de Valencia o de El Puig?',
    a: 'Sí. Muchos procedimientos con Hacienda y la Seguridad Social se tramitan electrónicamente, por lo que podemos estudiar documentación y preparar actuaciones en toda España.',
  },
];

const steps = [
  ['Identificamos', 'El acto recibido, el procedimiento y la fecha que condiciona la actuación.'],
  ['Estudiamos', 'El expediente, la documentación, los cálculos y los riesgos existentes.'],
  ['Planteamos', 'La respuesta, alegación, recurso o solución de pago adecuada al caso.'],
  ['Explicamos', 'El trabajo necesario y los honorarios antes de iniciar la actuación.'],
];

export default function HaciendaPage() {
  const posts = getPosts().filter((p) => p.category === 'hacienda');
  return (
    <div className="page-hacienda">
    <section className="page-head">
        <div className="wrap split">
          <div>
            <Breadcrumbs items={[{ label: 'Empresas y autónomos', href: '/areas/#empresas' }, { label: 'Hacienda y Seguridad Social' }]} />
            <h1>Abogados para requerimientos de Hacienda y Seguridad Social</h1>
            <p className="lede">
              ¿Has recibido una carta, liquidación, sanción o reclamación de deuda? Estudiamos la notificación, comprobamos
              los plazos y planteamos la respuesta, alegación o recurso adecuado.
            </p>
            <div className="actions">
              <a className="btn btn--red" href="#diagnostico">Revisar qué he recibido</a>
              <a className="btn btn--ghost" href={`tel:${site.phoneIntl}`}><Icon name="phone" /> {site.phone}</a>
            </div>
          </div>
          <div className="deadline">
            <h2>No dejes correr el plazo</h2>
            <p>
              Una respuesta bien planteada desde el inicio puede evitar que el problema avance hacia recargos, sanciones o
              apremio. Particulares, autónomos, administradores y empresas, en Valencia, El Puig y toda España.
            </p>
          </div>
        </div>
      </section>

      <section className="section" id="diagnostico">
        <div className="wrap split">
          <div>
            <h2>¿Qué notificación has recibido?</h2>
            <p>
              Responde unas preguntas breves y prepararemos un resumen para que nos lo envíes por WhatsApp o por correo, sin
              subir documentación sensible a esta página. Tus respuestas no salen de tu dispositivo hasta que decidas
              enviarlas.
            </p>
            <HaciendaTriage />
          </div>

          <div className="scope">
            <h2>Dónde intervenimos</h2>
            <h3>Hacienda: requerimientos, liquidaciones y sanciones</h3>
            <p>
              Requerimientos de información, justificación de ingresos y movimientos bancarios, comprobaciones de IRPF, IVA o
              Sociedades, propuestas de liquidación, expedientes sancionadores, derivaciones de responsabilidad al
              administrador y aplazamientos de deuda.
            </p>
            <h3>Seguridad Social: deudas, apremios y embargos</h3>
            <p>
              Reclamaciones de deuda, providencias de apremio, embargos, diferencias de cotización, actas de liquidación,
              cuotas de autónomos, devolución de ingresos indebidos y resoluciones de prestaciones del INSS.
            </p>
            <h3>Abogado fiscal en Valencia y El Puig, también para autónomos</h3>
            <p>
              Muchos procedimientos se tramitan electrónicamente, así que en la mayoría de los casos podemos revisar la
              documentación y plantear la defensa sin necesidad de desplazamiento.
            </p>
          </div>
        </div>
      </section>

      <section className="section section--stone">
        <div className="wrap">
          <h2>Cómo trabajamos</h2>
          <p className="lede">Abogados, economistas y especialistas fiscales analizan juntos las implicaciones jurídicas y económicas de tu caso.</p>
          <ol className="method">
            {steps.map(([t, d]) => (
              <li key={t}>
                <h3>{t}</h3>
                <p>{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <Faq items={faq}>
            <p className="muted">Cada notificación exige una lectura individual. Estas respuestas son una orientación general y no sustituyen la revisión de tu caso.</p>
          </Faq>
        </div>
      </section>

      {
        posts.length > 0 && (
          <section className="section section--stone">
            <div className="wrap">
              <h2>Artículos sobre Hacienda y Seguridad Social</h2>
              <PostList posts={posts} showCategory={false} />
            </div>
          </section>
        )
      }

      <section className="section section--ink">
        <div className="wrap">
          <h2>Cuanto antes estudiemos la notificación, más opciones tendremos para defenderte</h2>
          <div className="actions">
            <a className="btn btn--red" href="#diagnostico">Quiero que revisemos mi caso</a>
            <a className="btn cta-ghost" href={whatsapp(mensajes.hacienda)}>
              <Icon name="whatsapp" /> WhatsApp
            </a>
          </div>
        </div>
      </section>

    </div>

  );
}
