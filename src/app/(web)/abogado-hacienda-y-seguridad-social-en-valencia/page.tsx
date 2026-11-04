import { getPosts } from '@/lib/content';
import { buildMetadata, ogDe } from '@/lib/seo';
import { imagen } from '@/lib/imagenes';
import { Foto } from '@/components/Foto';
import { mensajes, site, whatsapp } from '@/lib/site';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Faq } from '@/components/Faq';
import { PostList } from '@/components/PostList';
import Link from 'next/link';
import { Icon, LineIcon } from '@/components/Icon';
import { HaciendaTriage } from '@/components/HaciendaTriage';

export const metadata = buildMetadata({
  title: 'Abogado Hacienda y Seguridad Social en Valencia',
  description:
    '¿Has recibido un requerimiento, liquidación, sanción o deuda de Hacienda o Seguridad Social? Estudiamos tu caso, los plazos y la respuesta adecuada.',
  path: '/abogado-hacienda-y-seguridad-social-en-valencia/',
  image: ogDe('hacienda'),
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
    q: '¿Podéis atenderme fuera de Valencia?',
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
  const foto = imagen('hacienda');
  return (
    <div className="page-hacienda">
    <section className="page-head">
        <div className="wrap split">
          <div>
            {/* Área compartida por empresas y particulares (#31): una sola URL y una miga de pan estable */}
            <Breadcrumbs items={[{ label: 'Áreas', href: '/areas/' }, { label: 'Hacienda y Seguridad Social' }]} />
            <h1>Abogados para requerimientos de Hacienda y Seguridad Social en Valencia</h1>
            <p className="lede">
              ¿Has recibido una carta, liquidación, sanción o reclamación de deuda? Estudiamos la notificación, comprobamos
              los plazos y planteamos la respuesta, alegación o recurso adecuado.
            </p>
            <div className="actions">
              <a className="btn btn--red" href="#diagnostico">Revisar qué he recibido</a>
              <a className="btn btn--ghost" href={`tel:${site.phoneIntl}`}><Icon name="phone" /> Llamar al despacho</a>
            </div>
          </div>
          <div className="hacienda-media">
            {foto && <Foto img={foto} sizes="(min-width: 960px) 40vw, 92vw" prioridad />}
            <div className="deadline">
              <h2>No dejes correr el plazo</h2>
              <p>
                Una respuesta bien planteada desde el inicio puede evitar que el problema avance hacia recargos, sanciones o
                apremio. Particulares, autónomos, administradores y empresas, en Valencia y en toda España.
              </p>
            </div>
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
              cuotas de autónomos y devolución de ingresos indebidos.
            </p>
            <p className="small">
              Si lo que has recibido es una resolución del INSS sobre una prestación (incapacidad, alta médica), lo atiende el{' '}
              <Link href="/abogado-laboralista-valencia/">área laboral</Link>.
            </p>
            <h3>Abogados fiscales en Valencia, también para autónomos</h3>
            <p>
              Muchos procedimientos se tramitan electrónicamente, así que en la mayoría de los casos podemos revisar la
              documentación y plantear la defensa sin necesidad de desplazamiento.
            </p>
          </div>
        </div>
      </section>

      {/* Necesidades por público (#31): la misma área, con la entrada que corresponde a cada uno */}
      <section className="section section--stone" id="segun-tu-situacion">
        <div className="wrap">
          <h2>Según tu situación</h2>
          <div className="publicos">
            <div className="publico">
              <h3 className="h-icono">
                <LineIcon name="familia" /> Particulares
              </h3>
              <ul className="checks">
                <li>Requerimientos de Hacienda para justificar ingresos o movimientos bancarios.</li>
                <li>Propuestas de liquidación y sanciones del IRPF.</li>
                <li>Embargos de cuenta o de nómina por deudas con Hacienda o con la Seguridad Social.</li>
                <li>Devolución de ingresos indebidos, por ejemplo del impuesto de matriculación.</li>
              </ul>
              <p className="small">
                ¿Es una prestación del INSS (incapacidad permanente o alta médica)? Lo lleva el{' '}
                <Link href="/incapacidad-permanente/">área laboral</Link>, con su propio teléfono.
              </p>
            </div>
            <div className="publico">
              <h3 className="h-icono">
                <LineIcon name="maletin" /> Empresas y autónomos
              </h3>
              <ul className="checks">
                <li>Requerimientos y comprobaciones de IRPF, IVA o Sociedades.</li>
                <li>Deudas con la Agencia Tributaria o con la Tesorería General de la Seguridad Social, apremios y embargos.</li>
                <li>Actas de liquidación, diferencias de cotización y cuotas de autónomos.</li>
                <li>Expedientes sancionadores, recursos y derivación de responsabilidad al administrador.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
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

      <section className="section section--stone">
        <div className="wrap">
          <Faq items={faq}>
            <p className="muted">Cada notificación exige una lectura individual. Estas respuestas son una orientación general y no sustituyen la revisión de tu caso.</p>
          </Faq>
        </div>
      </section>

      {
        posts.length > 0 && (
          <section className="section">
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
