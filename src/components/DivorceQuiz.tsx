'use client';

// Comprobación orientativa del divorcio en cinco preguntas. No envía nada por sí sola: prepara un mensaje de WhatsApp
// o pasa las respuestas al formulario de contacto (#7). Las respuestas se conservan en la sesión al volver a la página.
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { mensajes, site, whatsapp } from '@/lib/site';
import {
  guardarRespuestasDivorcio,
  isSimpleCase,
  leerRespuestasDivorcio,
  preguntasDivorcio,
  resumenDivorcio,
  type RespuestasDivorcio as Answers,
} from '@/lib/cuestionario-divorcio';
import { Icon } from './Icon';

const questions = preguntasDivorcio;

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

  // Recuperar las respuestas de esta sesión (p. ej. al volver desde el formulario)
  useEffect(() => {
    const prev = leerRespuestasDivorcio();
    /* eslint-disable react-hooks/set-state-in-effect -- sessionStorage solo existe en el navegador (exportación estática) */
    if (prev) {
      setAnswers(prev);
      setStep(questions.length);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const choose = (id: string, value: string, i: number) => {
    setAnswers((a) => {
      const next = { ...a, [id]: value };
      if (i === questions.length - 1) guardarRespuestasDivorcio(next);
      return next;
    });
    setStep(i + 1);
    markMoved();
  };

  const text = 'Hola, Praetoria. He hecho la comprobación de divorcio en vuestra web:\n' + (done ? resumenDivorcio(answers) : '');

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
          <Link className="btn btn--ghost" href="/contacto/?servicio=familia-divorcio&cuestionario=divorcio">
            Enviarlas con el formulario
          </Link>
          <a className="btn btn--ghost" href={`tel:${site.phoneIntl}`}>
            <Icon name="phone" /> Llamar
          </a>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              setAnswers({});
              guardarRespuestasDivorcio(null);
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
