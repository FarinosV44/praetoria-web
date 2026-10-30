import Link from 'next/link';
import { buildMetadata, ogDe } from '@/lib/seo';
import { mensajes } from '@/lib/site';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Faq } from '@/components/Faq';
import { CtaBand } from '@/components/CtaBand';
import { CalculadoraDespido } from '@/components/CalculadoraDespido';

export const metadata = buildMetadata({
  title: 'Calculadora de indemnización por despido 2026',
  description:
    'Calcula gratis la indemnización por despido improcedente u objetivo: 33 o 20 días por año, contratos anteriores a 2012 y topes legales. Con ejemplos y plazos para reclamar.',
  path: '/calculadora-indemnizacion-despido/',
  image: ogDe('despidos'),
});

const faq = [
  {
    q: '¿Cuánto me corresponde por un despido improcedente?',
    a: '33 días de salario por año trabajado, con un máximo de 24 mensualidades. Si tu contrato empezó antes del 12 de febrero de 2012, el tiempo anterior a esa fecha se paga a 45 días por año. Los periodos inferiores al año se prorratean por meses.',
  },
  {
    q: '¿Y por un despido objetivo?',
    a: '20 días de salario por año trabajado, con un máximo de 12 mensualidades. La empresa debe ponerla a tu disposición al entregarte la carta. Si el despido se declara improcedente, la indemnización sube a 33 días por año.',
  },
  {
    q: '¿Qué salario se usa para calcular la indemnización?',
    a: 'El salario bruto real en el momento del despido, incluidas las pagas extra prorrateadas y los complementos salariales. Se divide entre 365 para obtener el salario diario. Si la empresa usa un salario inferior al real, la indemnización también lo será.',
  },
  {
    q: '¿Un despido disciplinario tiene indemnización?',
    a: 'Si es procedente, no. Si se impugna y el juzgado lo declara improcedente, la empresa debe elegir entre readmitirte o pagarte la indemnización de 33 días por año.',
  },
  {
    q: '¿Cuánto tiempo tengo para reclamar?',
    a: '20 días hábiles desde el despido para presentar la papeleta de conciliación. Es un plazo de caducidad: si pasa, ya no se puede impugnar, aunque el despido sea injusto.',
  },
  {
    q: '¿La indemnización paga impuestos?',
    a: 'Está exenta de IRPF en la cuantía obligatoria que fija el Estatuto de los Trabajadores, con un límite de 180.000 euros. Lo que se pacte por encima de esa cuantía tributa.',
  },
  {
    q: '¿Puedo cobrar el paro si me despiden?',
    a: 'Sí. El despido, sea disciplinario, objetivo o improcedente, es una situación legal de desempleo. Firmar el finiquito como «no conforme» no afecta al paro.',
  },
];

export default function CalculadoraDespidoPage() {
  return (
    <div className="page-calculadora">
      <section className="page-head">
        <div className="wrap narrow">
          <Breadcrumbs items={[{ label: 'Laboral', href: '/abogado-laboralista-valencia/' }, { label: 'Calculadora de indemnización por despido' }]} />
          <h1>Calculadora de indemnización por despido</h1>
          <p className="lede">
            Calcula en un minuto cuánto te corresponde por un despido improcedente u objetivo, con las reglas de 2026: 33 o 20 días
            por año, el régimen de los contratos anteriores a 2012 y los topes legales.
          </p>
        </div>
      </section>

      <section className="section" id="calcular">
        <div className="wrap narrow">
          <CalculadoraDespido />
        </div>
      </section>

      <section className="section section--stone">
        <div className="wrap narrow prose">
          <h2>Cómo se calcula la indemnización por despido</h2>
          <p>La fórmula es siempre la misma: <strong>días de indemnización × salario diario</strong>. Lo que cambia es cuántos días por año corresponden:</p>
          <ul>
            <li>
              <strong>Despido improcedente:</strong> 33 días de salario por año trabajado, con un máximo de 24 mensualidades (artículo 56.1
              del Estatuto de los Trabajadores).
            </li>
            <li>
              <strong>Contratos anteriores al 12 de febrero de 2012:</strong> el tiempo trabajado hasta esa fecha se paga a 45 días por año y el
              posterior a 33. El máximo es de 720 días de salario, salvo que el tramo anterior a 2012 ya supere esa cifra, con un límite de 42
              mensualidades (disposición transitoria undécima de la Ley 3/2012).
            </li>
            <li>
              <strong>Despido objetivo:</strong> 20 días por año, con un máximo de 12 mensualidades (artículo 53.1.b del Estatuto).
            </li>
            <li>
              <strong>Despido disciplinario procedente:</strong> no hay indemnización.
            </li>
          </ul>
          <p>
            Los periodos inferiores al año se prorratean por meses, y la fracción de mes se cuenta como mes completo. El salario diario es el
            salario bruto anual, con las pagas extra y los complementos salariales, dividido entre 365.
          </p>

          <h2>Dos ejemplos</h2>
          <p>
            <strong>Despido improcedente.</strong> Contrato desde el 1 de septiembre de 2018, despido el 30 de octubre de 2026 y 24.000 euros
            brutos al año. Son 98 meses de servicio a 33 días por año: 269,5 días × 65,75 euros de salario diario ={' '}
            <strong>17.720,55 euros</strong>. Si fuera un despido objetivo, 20 días por año: <strong>10.739,73 euros</strong>.
          </p>
          <p>
            <strong>Contrato anterior a 2012.</strong> Contrato desde el 1 de mayo de 2008, despido improcedente el 30 de octubre de 2026 y
            30.000 euros brutos al año. Hasta el 11 de febrero de 2012 son 46 meses a 45 días (172,5 días); desde el 12 de febrero de 2012, 177
            meses a 33 días (486,75 días). En total, 659,25 días × 82,19 euros = <strong>54.184,93 euros</strong>.
          </p>

          <h2>Antes de firmar nada</h2>
          <ul>
            <li>
              <strong>Tienes 20 días hábiles</strong> para presentar la papeleta de conciliación. Es un plazo de caducidad: no se interrumpe por
              negociar con la empresa.
            </li>
            <li>
              <strong>Firma el finiquito como «no conforme»</strong> si no estás de acuerdo con la cifra. No afecta al paro y no te impide
              reclamar.
            </li>
            <li>
              <strong>Revisa el salario que usa la empresa.</strong> Es la causa más frecuente de indemnizaciones más bajas de lo debido:
              complementos, horas extra habituales o pagas que no se han tenido en cuenta.
            </li>
            <li>
              <strong>Si el despido es improcedente</strong>, la empresa elige entre readmitirte o pagarte la indemnización. Si hay
              vulneración de derechos fundamentales, el despido puede ser nulo, con readmisión obligatoria.
            </li>
          </ul>
          <p>
            Si te acaban de despedir, lee también qué hacer en las primeras horas en nuestra guía sobre el{' '}
            <Link href="/despido-valencia-que-hacer/">despido en Valencia</Link>, y cómo trabajamos en{' '}
            <Link href="/impugnar-despido/">impugnación de despidos</Link>.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="wrap narrow">
          <Faq items={faq} />
          <p className="small muted">
            Fuentes: Estatuto de los Trabajadores, artículos 53, 56 y 59; Ley 3/2012, disposición transitoria undécima; Ley 35/2006 del
            IRPF, artículo 7.e. La calculadora es orientativa y no sustituye la revisión de un abogado.
          </p>
        </div>
      </section>

      <CtaBand
        title="¿La cifra de tu carta no cuadra?"
        text="El área laboral revisa tu carta de despido, el salario que ha usado la empresa y tus opciones antes de que venza el plazo de 20 días hábiles."
        whatsappText={mensajes.laboral}
        href="/contacto/?servicio=laboral-despidos"
        canal="laboral"
      />
    </div>
  );
}
