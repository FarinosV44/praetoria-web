'use client';

// Cuestionario de notificaciones de Hacienda / Seguridad Social.
// Las respuestas no salen del navegador: se prepara un resumen que el visitante envía él mismo.
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { site } from '@/lib/site';
import { Icon } from './Icon';

const fmtDate = (v: string) => {
  if (!v) return '';
  const [y, m, d] = v.split('-');
  return `${d}/${m}/${y}`;
};

export function HaciendaTriage() {
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<{ text: string; emisor: string } | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const get = (k: string) => String(d.get(k) ?? '').trim();
    const missing = [
      !get('emisor') && 'quién envía la notificación',
      !get('nombre') && 'tu nombre',
      !get('telefono') && 'tu teléfono',
      !d.get('privacidad') && 'aceptar la política de privacidad',
    ].filter(Boolean);
    if (missing.length) {
      setError(`Para preparar el resumen falta: ${missing.join(', ')}.`);
      return;
    }
    setError('');
    const details = [
      `Organismo: ${get('emisor')}`,
      get('tipo') && `Documento: ${get('tipo')}`,
      get('recibida') && `Recibida o abierta el: ${fmtDate(get('recibida'))}`,
      get('limite') && `Fecha límite: ${fmtDate(get('limite'))}`,
      get('importe') && `Importe: ${get('importe')}`,
      get('descripcion') && `Descripción: ${get('descripcion')}`,
    ].filter(Boolean);
    const text =
      'Hola, Praetoria. He recibido una notificación y quiero que la revise un abogado.\n\n' +
      details.join('\n') +
      `\n\nNombre: ${get('nombre')}\nTeléfono: ${get('telefono')}`;
    moved.current = true;
    setSummary({ text, emisor: get('emisor') });
  };

  const edit = () => {
    moved.current = true;
    setSummary(null);
  };

  // Mover el foco tras mostrar u ocultar el resumen (después del render, cuando ya no está oculto)
  const moved = useRef(false);
  useEffect(() => {
    if (!moved.current) return;
    if (summary) resultRef.current?.focus();
    else formRef.current?.querySelector('input')?.focus();
  }, [summary]);

  const phone = site.phoneIntl.replace('+', '');
  return (
    <>
      <form ref={formRef} className="form triage" id="triage" noValidate onSubmit={onSubmit} hidden={!!summary}>
        <fieldset className="field">
          <legend>¿Quién la envía?</legend>
          <div className="radios">
            <label>
              <input type="radio" name="emisor" value="Hacienda (AEAT)" required /> Hacienda (AEAT)
            </label>
            <label>
              <input type="radio" name="emisor" value="Seguridad Social (TGSS)" /> Seguridad Social (TGSS)
            </label>
            <label>
              <input type="radio" name="emisor" value="INSS" /> INSS
            </label>
            <label>
              <input type="radio" name="emisor" value="No lo sé" /> No lo sé
            </label>
          </div>
        </fieldset>
        <div className="field">
          <label htmlFor="tipo">¿Qué tipo de documento es?</label>
          <select id="tipo" name="tipo" defaultValue="">
            <option value="">Selecciona la opción más parecida</option>
            <option>Requerimiento de información o de justificación</option>
            <option>Propuesta de liquidación o liquidación</option>
            <option>Inicio de expediente sancionador o sanción</option>
            <option>Reclamación de deuda o providencia de apremio</option>
            <option>Diligencia de embargo</option>
            <option>Derivación de responsabilidad</option>
            <option>Resolución sobre una prestación</option>
            <option>No lo sé</option>
          </select>
          <p className="small muted">No pasa nada si no sabes identificarlo. Para confirmarlo revisaremos el documento completo.</p>
        </div>
        <div className="row">
          <div className="field">
            <label htmlFor="recibida">Fecha de recepción o apertura</label>
            <input id="recibida" name="recibida" type="date" />
          </div>
          <div className="field">
            <label htmlFor="limite">Fecha límite (si la conoces)</label>
            <input id="limite" name="limite" type="date" />
          </div>
        </div>
        <div className="field">
          <label htmlFor="importe">
            Importe aproximado <span className="muted">(opcional)</span>
          </label>
          <select id="importe" name="importe" defaultValue="">
            <option value="">Sin indicar</option>
            <option>No aparece ninguna cantidad</option>
            <option>Menos de 3.000 €</option>
            <option>Entre 3.000 € y 10.000 €</option>
            <option>Entre 10.000 € y 50.000 €</option>
            <option>Más de 50.000 €</option>
            <option>No lo sé</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="descripcion">Descripción breve</label>
          <textarea id="descripcion" name="descripcion" maxLength={900} />
        </div>
        <div className="row">
          <div className="field">
            <label htmlFor="tnombre">Nombre</label>
            <input id="tnombre" name="nombre" autoComplete="name" required />
          </div>
          <div className="field">
            <label htmlFor="ttel">Teléfono</label>
            <input id="ttel" name="telefono" type="tel" autoComplete="tel" required />
          </div>
        </div>
        <label className="check">
          <input type="checkbox" name="privacidad" required />
          <span>
            He leído y acepto la <Link href="/politica-de-privacidad/">política de privacidad</Link>.
          </span>
        </label>
        <p className="small muted">
          Enviar esta información no crea una relación abogado-cliente ni suspende o interrumpe ningún plazo administrativo.
        </p>
        <p className="error" role="alert" hidden={!error}>
          {error}
        </p>
        <div>
          <button className="btn btn--red" type="submit">
            Preparar mi resumen
          </button>
        </div>
      </form>

      <div ref={resultRef} className="result" id="triage-result" hidden={!summary} tabIndex={-1}>
        <h3>Tu resumen está listo</h3>
        <p>
          Tu asunto necesita una revisión individual: comprobaremos el documento completo, la fecha de notificación, el
          procedimiento iniciado y la documentación relacionada.
        </p>
        <pre className="summary">{summary?.text}</pre>
        <div className="actions">
          <a className="btn btn--red" href={summary ? `https://wa.me/${phone}?text=${encodeURIComponent(summary.text)}` : '#'}>
            <Icon name="whatsapp" /> Enviar por WhatsApp
          </a>
          <a
            className="btn btn--ghost"
            href={
              summary
                ? `mailto:${site.email}?subject=${encodeURIComponent(`Revisión de notificación: ${summary.emisor}`)}&body=${encodeURIComponent(summary.text)}`
                : '#'
            }
          >
            <Icon name="mail" /> Enviar por correo
          </a>
          <button className="btn btn--ghost" type="button" onClick={edit}>
            Corregir mis respuestas
          </button>
        </div>
      </div>
    </>
  );
}
