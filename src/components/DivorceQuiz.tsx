'use client';

// Comprobación orientativa del divorcio en cinco preguntas. No envía nada: prepara un mensaje de WhatsApp.
import { useEffect, useRef, useState } from 'react';
import { mensajes, site, whatsapp } from '@/lib/site';
import { Icon } from './Icon';

const questions = [
  {
    id: 'necesidad',
    q: '¿Qué necesitas?',
    options: [
      'Quiero divorciarme o separarme',
      'Quiero modificar unas medidas anteriores',
      'Tengo problemas con el cumplimiento de un convenio o sentencia',
      'Necesito regular medidas de hijos sin estar casado/a',
      'No lo tengo claro',
    ],
  },
  {
    id: 'acuerdo',
    q: '¿Existe acuerdo con la otra parte?',
    options: ['Sí, estamos completamente de acuerdo', 'Hay acuerdo en algunas cuestiones', 'No hay acuerdo', 'Todavía no lo hemos hablado'],
  },
  { id: 'hijos', q: '¿Tenéis hijos en común?', options: ['No', 'Sí, mayores e independientes', 'Sí, menores o dependientes'] },
  {
    id: 'bienes',
    q: '¿Hay vivienda, bienes o deudas que deban regularse?',
    options: ['No', 'Sí, pero ya sabemos cómo repartirlos', 'Sí, y no existe acuerdo', 'No estoy seguro/a'],
  },
  {
    id: 'urgente',
    q: '¿Hay alguna cuestión urgente?',
    options: [
      'No, nada urgente',
      'Custodia o régimen de visitas',
      'Impago de pensión',
      'Vivienda familiar',
      'Traslado de residencia o cambio de colegio',
      'Medidas provisionales o situación especialmente conflictiva',
    ],
  },
];

type Answers = Record<string, string>;

/** El precio cerrado solo aplica al caso sencillo: mutuo acuerdo completo, sin hijos menores, sin bienes y sin urgencias. */
export function isSimpleCase(a: Answers) {
  return (
    a.necesidad === 'Quiero divorciarme o separarme' &&
    a.acuerdo === 'Sí, estamos completamente de acuerdo' &&
    (a.hijos === 'No' || a.hijos === 'Sí, mayores e independientes') &&
    a.bienes === 'No' &&
    a.urgente === 'No, nada urgente'
  );
}

export function DivorceQuiz() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const formRef = useRef<HTMLFormElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const done = step >= questions.length;
  const simple = done && isSimpleCase(answers);

  // El foco se mueve después de que React muestre el paso nuevo (con el paso aún oculto no se puede enfocar).
  // Solo cuando el cambio lo provoca el visitante, no en la carga inicial.
  const moved = useRef(false);
  useEffect(() => {
    if (!moved.current) return;
    if (step >= questions.length) resultRef.current?.focus();
    else formRef.current?.querySelector<HTMLInputElement>(`[data-step="${step}"] input`)?.focus();
  }, [step]);
  const markMoved = () => {
    moved.current = true;
  };

  const choose = (id: string, value: string, i: number) => {
    setAnswers((a) => ({ ...a, [id]: value }));
    setStep(i + 1);
    markMoved();
  };

  const text =
    'Hola, Praetoria. He hecho la comprobación de divorcio en vuestra web:\n' +
    questions.map((q) => `- ${q.q} ${answers[q.id] ?? ''}`).join('\n');

  return (
    <form ref={formRef} className="quiz" id="quiz" onSubmit={(e) => e.preventDefault()}>
      {questions.map((q, i) => (
        <fieldset key={q.id} className="quiz__step" data-step={i} hidden={i !== step}>
          <p className="quiz__count">
            Pregunta {i + 1} de {questions.length}
          </p>
          <legend>{q.q}</legend>
          <div className="quiz__options">
            {q.options.map((o) => (
              <label key={o}>
                {/* onClick y no onChange: al volver atrás, pulsar la opción ya marcada también debe avanzar
                    (el evento change no se dispara en ese caso). Las flechas y la barra espaciadora generan click. */}
                <input type="radio" name={q.id} value={o} checked={answers[q.id] === o} onChange={() => {}} onClick={() => choose(q.id, o, i)} />
                <span>{o}</span>
              </label>
            ))}
          </div>
          {i > 0 && (
            <button
              type="button"
              className="quiz__back"
              onClick={() => {
                setStep(i - 1);
                markMoved();
              }}
            >
              Volver a la pregunta anterior
            </button>
          )}
        </fieldset>
      ))}
      <div ref={resultRef} className="quiz__result" hidden={!done} tabIndex={-1}>
        <div hidden={!simple}>
          <h3>Tu caso podría tramitarse como divorcio de mutuo acuerdo con precio cerrado</h3>
          <p>El precio de 399 € se confirmará después de comprobar que el asunto cumple las condiciones indicadas.</p>
        </div>
        <div hidden={simple}>
          <h3>Tu asunto necesita una valoración personalizada</h3>
          <p>
            En familia, una decisión precipitada sobre custodia, vivienda o pensiones puede tener consecuencias durante años.
            Revisaremos tu situación y te explicaremos la estrategia y el presupuesto antes de iniciar ninguna actuación.
          </p>
        </div>
        <div className="actions">
          <a className="btn btn--red" href={done ? `https://wa.me/${site.phoneIntl.replace('+', '')}?text=${encodeURIComponent(text)}` : whatsapp(mensajes.divorcio)}>
            <Icon name="whatsapp" /> Enviar mis respuestas por WhatsApp
          </a>
          <a className="btn btn--ghost" href={`tel:${site.phoneIntl}`}>
            <Icon name="phone" /> Llamar
          </a>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              setAnswers({});
              setStep(0);
              markMoved();
            }}
          >
            Empezar de nuevo
          </button>
        </div>
      </div>
    </form>
  );
}
