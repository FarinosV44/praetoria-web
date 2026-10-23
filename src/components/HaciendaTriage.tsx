'use client';

// Cuestionario de notificaciones de Hacienda / Seguridad Social.
// Las respuestas no salen del navegador hasta que el visitante elige cómo enviarlas: con el formulario de consulta
// (recomendado, llega al despacho para revisión humana, #8), por WhatsApp o por correo.
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { site } from '@/lib/site';
import { DOCUMENTOS, IMPORTES_HACIENDA, ORGANISMOS, guardarRespuestasHacienda, servicioHacienda } from '@/lib/cuestionario-hacienda';
import { Icon } from './Icon';

const fmtDate = (v: string) => {
  if (!v) return '';
  const [y, m, d] = v.split('-');
  return `${d}/${m}/${y}`;
};

export function HaciendaTriage() {
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<{ text: string; emisor: string; servicio: string } | null>(null);
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
    const emisor = ORGANISMOS.find((x) => x.id === get('emisor'))?.label ?? '';
    const tipo = DOCUMENTOS.find((x) => x.id === get('tipo'))?.label ?? '';
    const details = [
      `Organismo: ${emisor}`,
      tipo && `Documento: ${tipo}`,
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
    // Para el formulario de consulta (misma sesión del navegador). Nombre y teléfono se vuelven a pedir allí.
    const r = { organismo: get('emisor'), documento: get('tipo'), recibida: get('recibida'), limite: get('limite'), importe: get('importe'), descripcion: get('descripcion') };
    guardarRespuestasHacienda(r);
    setSummary({ text, emisor, servicio: servicioHacienda(r) });
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
            {ORGANISMOS.map((o, i) => (
              <label key={o.id}>
                <input type="radio" name="emisor" value={o.id} required={i === 0} /> {o.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="field">
          <label htmlFor="tipo">¿Qué tipo de documento es?</label>
          <select id="tipo" name="tipo" defaultValue="">
            <option value="">Selecciona la opción más parecida</option>
            {DOCUMENTOS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
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
            {IMPORTES_HACIENDA.map((i) => (
              <option key={i}>{i}</option>
            ))}
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
        {summary?.servicio.startsWith('laboral') && (
          <p className="small">
            Las resoluciones sobre prestaciones (incapacidad, altas médicas) las atiende el <Link href="/abogado-laboralista-valencia/">área laboral</Link>:
            tu consulta irá a ella.
          </p>
        )}
        <div className="actions">
          <Link className="btn btn--red" href={summary ? `/contacto/?servicio=${summary.servicio}&cuestionario=hacienda` : '/contacto/'}>
            Enviar con el formulario de consulta
          </Link>
          <a className="btn btn--ghost" href={summary ? `https://wa.me/${phone}?text=${encodeURIComponent(summary.text)}` : '#'}>
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
