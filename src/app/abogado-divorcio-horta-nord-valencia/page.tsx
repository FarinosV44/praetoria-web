import Link from 'next/link';
import { buildMetadata } from '@/lib/seo';
import { site, whatsapp } from '@/lib/site';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Faq } from '@/components/Faq';
import { CtaBand } from '@/components/CtaBand';
import { DivorceQuiz } from '@/components/DivorceQuiz';

export const metadata = buildMetadata({
  title: "Abogados para Separación y Divorcios en l'Horta Nord",
  description:
    "Abogados para separación y divorcios en El Puig y l'Horta Nord. Mutuo acuerdo desde 199,50 € por cónyuge. Custodia y modificación de medidas.",
  path: '/abogado-divorcio-horta-nord-valencia/',
});

const faq = [
  {
    q: '¿Cuánto cuesta un divorcio de mutuo acuerdo en Valencia?',
    a: 'Un divorcio de mutuo acuerdo sin hijos menores ni bienes que repartir tiene un precio cerrado de 399 € en total (199,50 € por cónyuge), con abogado, procurador e IVA incluidos. Si el caso tiene hijos, bienes o alguna particularidad, el presupuesto se ajusta a esa situación y se explica antes de empezar.',
  },
  {
    q: '¿Qué incluye el precio de 399 €?',
    a: 'Incluye el estudio inicial, la redacción de la demanda y del convenio regulador, abogado, procurador, la presentación en el juzgado, el seguimiento hasta sentencia y el IVA. No incluye supuestos con hijos menores o dependientes, bienes o deudas que liquidar, negociaciones adicionales, incidencias procesales extraordinarias ni procedimientos contenciosos.',
  },
  {
    q: '¿Podemos utilizar el mismo abogado?',
    a: 'Sí, cuando existe mutuo acuerdo completo la ley permite que ambos cónyuges compartan abogado y procurador, lo que reduce el coste total del procedimiento.',
  },
  {
    q: '¿Cuánto tarda un divorcio de mutuo acuerdo?',
    a: 'El plazo depende de la carga de trabajo de cada juzgado y de la documentación disponible. No podemos garantizar una fecha exacta, pero al ser un procedimiento sin oposición entre las partes, suele resolverse con más agilidad que uno contencioso.',
  },
  {
    q: '¿Qué ocurre si tenemos hijos menores?',
    a: 'Cuando hay hijos menores o dependientes, el convenio regulador debe fijar custodia, régimen de visitas, pensión de alimentos y uso de la vivienda familiar, entre otras cuestiones. El precio de 399 € no se aplica a estos casos porque requieren un estudio y una redacción específicos; te explicaremos el presupuesto tras revisar tu situación.',
  },
  {
    q: '¿Qué sucede si no existe acuerdo?',
    a: 'Si no hay acuerdo, cada cónyuge necesita su propio abogado y el procedimiento se tramita como contencioso: se presenta prueba, puede haber medidas provisionales y el juzgado resuelve las cuestiones controvertidas.',
  },
  {
    q: '¿Quién se queda con la vivienda familiar?',
    a: 'Depende principalmente de si hay hijos menores y de a quién se atribuye su custodia, así como del régimen económico del matrimonio y de la titularidad del inmueble. No existe una regla única y cada caso requiere un análisis concreto.',
  },
  {
    q: '¿Cuándo puede pedirse la custodia compartida?',
    a: 'Puede solicitarse de mutuo acuerdo o de forma contenciosa. El juzgado valorará, entre otros factores, la disponibilidad de ambos progenitores, la relación con los hijos y su interés superior. No hay un resultado garantizado.',
  },
  {
    q: '¿Se puede modificar una pensión de alimentos?',
    a: 'Sí, cuando se produce un cambio sustancial, relevante y estable en la situación económica o en las necesidades de los hijos respecto al momento en que se fijó. Es necesario acreditar ese cambio ante el juzgado.',
  },
  {
    q: '¿Puedo divorciarme si mi pareja no quiere?',
    a: 'Sí. En España cualquiera de los cónyuges puede solicitar el divorcio sin que el otro esté de acuerdo, transcurrido el plazo legal desde el matrimonio. En ese caso el procedimiento se tramita como contencioso.',
  },
  {
    q: '¿Atendéis divorcios en Puçol, Massamagrell y otros municipios de l’Horta Nord?',
    a: 'Sí. Desde el despacho de El Puig atendemos, presencial y online, a clientes de Puçol, Massamagrell, Rafelbunyol, La Pobla de Farnals, Museros, Massalfassar, Albuixech, Albalat dels Sorells, Foios, Meliana y el resto de l’Horta Nord, además de Valencia capital.',
  },
];

export default function DivorcioPage() {
  return (
    <div className="page-divorcio">
    <section className="page-head">
        <div className="wrap">
          <Breadcrumbs items={[{ label: 'Familia y divorcio', href: '/familia/' }, { label: "Divorcio en l&apos;Horta Nord" }]} />
          <div className="split">
            <div>
              <h1>Abogados para separación y divorcio en l&apos;Horta Nord</h1>
              <p className="lede">
                Acuerdo cuando es posible, estrategia cuando hace falta. Resolvemos divorcios de mutuo acuerdo con un precio
                cerrado y defendemos con rigor los asuntos complejos de custodia, pensiones, vivienda familiar y patrimonio.
              </p>
              <ul className="ticks">
                <li>Abogado colegiado, ICAV {site.collegeNumber}</li>
                <li>Presupuesto explicado antes de empezar, sin sorpresas</li>
                <li>Atención personal desde El Puig, presencial y online</li>
                <li>Confidencialidad en todo el proceso</li>
              </ul>
            </div>
            <div className="price">
              <p className="price__label">Divorcio de mutuo acuerdo</p>
              <p className="price__big">399 €</p>
              <p className="price__sub">en total, 199,50 € por cónyuge. Abogado, procurador e IVA incluidos.</p>
              <p className="small">Para divorcios de mutuo acuerdo sin hijos menores ni dependientes y sin bienes o deudas que repartir.</p>
              <a className="btn btn--red" href="#comprobar">Comprobar mi caso</a>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="comprobar">
        <div className="wrap narrow">
          <h2>Comprueba en un minuto qué camino encaja con tu caso</h2>
          <p>Cinco preguntas rápidas. No es vinculante y no sustituye la revisión de un abogado, pero te orienta antes de contactar.</p>

          <DivorceQuiz />
        </div>
      </section>

      <section className="section section--stone">
        <div className="wrap">
          <h2>Dos maneras de resolver un divorcio</h2>
          <p className="lede">El camino adecuado depende del acuerdo real entre las partes, no de lo que a priori parezca más rápido.</p>
          <div className="compare">
            <div>
              <h3>Mutuo acuerdo</h3>
              <ul>
                <li>Un único abogado y un único procurador para ambos cónyuges.</li>
                <li>Menor coste y menos trámites.</li>
                <li>Un solo convenio regulador negociado entre las partes.</li>
                <li>Tramitación judicial sin contienda entre las partes.</li>
              </ul>
            </div>
            <div>
              <h3>Sin acuerdo (contencioso)</h3>
              <ul>
                <li>Cada parte cuenta con su propio abogado.</li>
                <li>Negociación, prueba y, si es necesario, medidas provisionales.</li>
                <li>Estrategia procesal adaptada a custodia, vivienda, pensiones o patrimonio.</li>
                <li>Defensa activa en cada fase del procedimiento.</li>
              </ul>
            </div>
          </div>
          <p className="small muted">No podemos garantizar plazos ni resultados: cada procedimiento depende del juzgado, de la complejidad del asunto y del comportamiento de la otra parte.</p>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <h2>Precio claro para el caso sencillo</h2>
          <p className="lede">
            399 € en total (199,50 € por cónyuge), abogado, procurador e IVA incluidos, cuando el divorcio es de mutuo acuerdo,
            sin hijos menores ni dependientes y sin bienes o deudas que repartir.
          </p>
          <div className="compare">
            <div>
              <h3>Qué incluye</h3>
              <ul className="yes">
                <li>Estudio inicial del caso</li>
                <li>Redacción de la demanda y del convenio regulador</li>
                <li>Abogado</li>
                <li>Procurador</li>
                <li>Presentación en el juzgado</li>
                <li>Seguimiento del procedimiento hasta sentencia</li>
                <li>IVA</li>
              </ul>
            </div>
            <div>
              <h3>Qué no incluye este precio</h3>
              <ul className="no">
                <li>Hijos menores o dependientes</li>
                <li>Liquidación o adjudicación de bienes</li>
                <li>Deudas comunes</li>
                <li>Negociaciones adicionales entre las partes</li>
                <li>Incidencias procesales extraordinarias</li>
                <li>Divorcio notarial y, en su caso, aranceles del notario</li>
                <li>Procedimientos contenciosos</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="section section--stone">
        <div className="wrap split">
          <div>
            <h2>Cuando el divorcio necesita estrategia</h2>
            <div className="prose">
              <p>Un precio competitivo en el caso sencillo no significa renunciar a la capacidad técnica que exige un asunto difícil.</p>
              <p>En un divorcio complejo, el objetivo no es presentar papeles cuanto antes, sino tomar desde el principio decisiones que protejan tu posición, tus hijos y tu patrimonio.</p>
            </div>
            <h2 className="mt">Modificación de medidas</h2>
            <div className="prose">
              <p>
                Una sentencia o un convenio regulador pueden modificarse cuando hay un cambio de circunstancias sustancial,
                relevante y estable respecto al momento en que se fijaron. No cualquier cambio basta: hay que acreditar que es
                real, duradero y suficientemente importante.
              </p>
            </div>
            <div className="actions">
              <a className="btn" href={whatsapp('Hola, quiero consultar una modificación de medidas.')}>Consultar una modificación de medidas</a>
            </div>
          </div>
          <div>
            <h3>Situaciones que pueden justificar una modificación</h3>
            <ul className="plain">
              <li>Pérdida o reducción importante de ingresos</li>
              <li>Cambio en las necesidades de los hijos</li>
              <li>Cambio de residencia de alguno de los progenitores</li>
              <li>Incumplimientos reiterados del régimen de visitas</li>
              <li>Nueva disponibilidad de los progenitores</li>
              <li>Solicitud de custodia compartida</li>
              <li>Extinción o modificación de la pensión de alimentos</li>
              <li>Cambio en el uso de la vivienda familiar</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <h2>Cómo trabajamos</h2>
          <ol className="process">
            <li>Nos cuentas tu situación.</li>
            <li>Revisamos qué puede acordarse y qué debe protegerse.</li>
            <li>Recibes una estrategia y un presupuesto claros.</li>
            <li>Preparamos y tramitamos el procedimiento.</li>
            <li>Te acompañamos hasta su resolución.</li>
          </ol>
          <p className="local">
            El despacho está en El Puig y atiende, de forma presencial y a distancia, a clientes de toda l&apos;Horta Nord y de
            Valencia. Más información en la página de <Link href="/familia/">derecho de familia</Link>.
          </p>
        </div>
      </section>

      <section className="section section--stone">
        <div className="wrap narrow">
          <Faq items={faq} />
        </div>
      </section>

      <CtaBand
        title="¿Empezamos por comprobar tu caso?"
        text="Dos minutos para saber si tu divorcio entra en el precio cerrado o necesita una valoración personalizada."
        whatsappText="Hola, quiero información sobre mi caso de divorcio/familia."
      />

    </div>

  );
}
