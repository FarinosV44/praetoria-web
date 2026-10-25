'use client';

// Solicitud de llamada / contacto prioritario (#33). Formulario corto; sin JavaScript se envía a /api/llamada.
// Con JavaScript: mismas reglas que el servidor, un solo envío a la vez (el mismo id en los reintentos)
// y confirmación solo cuando el servidor confirma que Netlify Forms la ha recibido.
// Nunca promete disponibilidad ni plazos de respuesta.
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AREAS } from '@/lib/consulta';
import { AVISO_LLAMADA, CONTACTO_SEGURO, LIMITES_LLAMADA, MOTIVOS, validarLlamada, type ErroresLlamada } from '@/lib/llamada';
import { servicioPorId } from '@/lib/servicios-indice';
import { canalDe } from '@/lib/site';
import { paginaOrigen } from '@/lib/atribucion';
import { medir } from '@/lib/medicion';
import { apiUrl } from '@/lib/api';

type Estado = { tipo: 'editando' } | { tipo: 'enviando' } | { tipo: 'error' } | { tipo: 'enviada'; area: string };

const ORDEN: (keyof ErroresLlamada)[] = ['nombre', 'telefono', 'area', 'motivo', 'fecha', 'localidad', 'seguro', 'franja', 'descripcion', 'privacidad'];
const ETIQUETA: Partial<Record<keyof ErroresLlamada, string>> = {
  nombre: 'Nombre', telefono: 'Teléfono', area: 'Área', motivo: 'Motivo', fecha: 'Fecha', localidad: 'Localidad', seguro: 'Forma de contacto', franja: 'Horario', descripcion: 'Descripción', privacidad: 'Privacidad',
};
function FieldError({ k, msg }: { k: keyof ErroresLlamada; msg?: string }) {
  return msg ? (
    <p className="field-error" id={`err-${k}`}>
      {msg}
    </p>
  ) : null;
}
const nuevoId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);

export function LlamadaForm() {
  const [estado, setEstado] = useState<Estado>({ tipo: 'editando' });
  const [errores, setErrores] = useState<ErroresLlamada>({});
  const [area, setArea] = useState('');
  const [servicio, setServicio] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const resumenRef = useRef<HTMLDivElement>(null);
  const exitoRef = useRef<HTMLDivElement>(null);
  const cargado = useRef(0);
  const envioId = useRef('');
  const enCurso = useRef(false);

  useEffect(() => {
    cargado.current = Date.now();
    const q = new URLSearchParams(window.location.search);
    const sv = servicioPorId(q.get('servicio') ?? '');
    const ar = AREAS.find((a) => a.id === q.get('area'));
    /* eslint-disable react-hooks/set-state-in-effect -- la URL solo existe en el navegador (exportación estática) */
    if (sv) {
      setServicio(sv.id);
      setArea(sv.area);
    } else if (ar) setArea(ar.id);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);
  useEffect(() => {
    if (estado.tipo === 'enviada') exitoRef.current?.focus();
  }, [estado.tipo]);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (enCurso.current) return;
    envioId.current ||= nuevoId();
    const fd = new FormData(formRef.current!);
    const raw = {
      ...Object.fromEntries(fd.entries()),
      servicio: servicio && servicioPorId(servicio)?.area === fd.get('area') ? servicio : '',
      privacidad: fd.get('privacidad') === 'on',
      origen: paginaOrigen(),
      id: envioId.current,
      t: cargado.current,
    };
    const v = validarLlamada(raw);
    if (!v.ok) {
      setErrores(v.errores);
      setEstado({ tipo: 'editando' });
      requestAnimationFrame(() => resumenRef.current?.focus());
      return;
    }
    setErrores({});
    setEstado({ tipo: 'enviando' });
    enCurso.current = true;
    try {
      const res = await fetch(apiUrl('/api/llamada'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(raw),
        signal: AbortSignal.timeout(20_000),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.ok) {
        medir('form_success', { area: v.data.area, servicio: v.data.servicio || undefined, tipo: 'llamada' });
        setEstado({ tipo: 'enviada', area: v.data.area });
        return;
      }
      if (res.status === 422 && body.errores) {
        setErrores(body.errores);
        setEstado({ tipo: 'editando' });
        requestAnimationFrame(() => resumenRef.current?.focus());
        return;
      }
      throw new Error(`Respuesta ${res.status}`);
    } catch {
      setEstado({ tipo: 'error' });
    } finally {
      enCurso.current = false;
    }
  };

  const c = canalDe(area);
  if (estado.tipo === 'enviada') {
    const ce = canalDe(estado.area);
    return (
      <div ref={exitoRef} className="form-ok" tabIndex={-1} role="status">
        <h2>Hemos recibido tu solicitud</h2>
        <p>
          Ha llegado al despacho marcada como prioritaria. Intentaremos llamarte en cuanto sea posible, según disponibilidad: esta confirmación no
          garantiza la asistencia ni suspende ninguna citación o plazo.
        </p>
        <p>
          Si el asunto es para hoy y no te hemos llamado, llama al <a href={`tel:${ce.phoneIntl}`}>{ce.phone}</a> ({ce.etiqueta.toLowerCase()}). Si
          estás en peligro, llama al 112.
        </p>
      </div>
    );
  }

  const err = (k: keyof ErroresLlamada) => errores[k];
  const a11y = (k: keyof ErroresLlamada) => (err(k) ? { 'aria-invalid': true as const, 'aria-describedby': `err-${k}` } : {});
  const lista = ORDEN.filter((k) => err(k));
  const enviando = estado.tipo === 'enviando';

  return (
    <form ref={formRef} className="form form--llamada" name="llamada-urgente" method="POST" action={apiUrl('/api/llamada')} noValidate onSubmit={onSubmit} aria-busy={enviando}>
      <p className="aviso-llamada">
        <strong>{AVISO_LLAMADA}</strong>
      </p>

      <div ref={resumenRef} tabIndex={-1} className="form-errors" hidden={!lista.length} role="alert">
        <p>Revisa {lista.length === 1 ? 'este campo' : `estos ${lista.length} campos`} antes de enviar:</p>
        <ul>
          {lista.map((k) => (
            <li key={k}>
              <a href={`#ll-${k}`}>
                {ETIQUETA[k]}: {err(k)}
              </a>
            </li>
          ))}
        </ul>
      </div>

      <p className="hp" aria-hidden="true">
        <label>
          No rellenes este campo <input name="empresa-web" tabIndex={-1} autoComplete="off" />
        </label>
      </p>

      <div className="row">
        <div className="field">
          <label htmlFor="ll-nombre">Nombre</label>
          <input id="ll-nombre" name="nombre" autoComplete="name" maxLength={LIMITES_LLAMADA.nombre} required {...a11y('nombre')} />
          <FieldError k="nombre" msg={errores.nombre} />
        </div>
        <div className="field">
          <label htmlFor="ll-telefono">Teléfono</label>
          <input id="ll-telefono" name="telefono" type="tel" autoComplete="tel" maxLength={LIMITES_LLAMADA.telefono} required {...a11y('telefono')} />
          <FieldError k="telefono" msg={errores.telefono} />
        </div>
      </div>

      <div className="row">
        <div className="field">
          <label htmlFor="ll-area">Área</label>
          <select id="ll-area" name="area" required value={area} onChange={(e) => setArea(e.target.value)} {...a11y('area')}>
            <option value="">Elige un área</option>
            {AREAS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
          <FieldError k="area" msg={errores.area} />
        </div>
        <div className="field">
          <label htmlFor="ll-motivo">Motivo</label>
          <select id="ll-motivo" name="motivo" required defaultValue="" {...a11y('motivo')}>
            <option value="">Elige el más parecido</option>
            {MOTIVOS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <FieldError k="motivo" msg={errores.motivo} />
        </div>
      </div>

      <div className="row">
        <div className="field">
          <label htmlFor="ll-fecha">
            Fecha de la citación o del plazo <span className="muted">(opcional)</span>
          </label>
          <input id="ll-fecha" name="fecha" type="date" min="2000-01-01" {...a11y('fecha')} aria-describedby={err('fecha') ? 'err-fecha ll-fecha-ayuda' : 'll-fecha-ayuda'} />
          <p className="small muted" id="ll-fecha-ayuda">
            Solo para priorizar. No calculamos plazos.
          </p>
          <FieldError k="fecha" msg={errores.fecha} />
        </div>
        <div className="field">
          <label htmlFor="ll-localidad">
            Localidad <span className="muted">(opcional)</span>
          </label>
          <input id="ll-localidad" name="localidad" autoComplete="address-level2" maxLength={LIMITES_LLAMADA.localidad} {...a11y('localidad')} />
          <FieldError k="localidad" msg={errores.localidad} />
        </div>
      </div>

      <div className="row">
        <div className="field">
          <label htmlFor="ll-seguro">¿Cómo podemos contactarte con seguridad?</label>
          <select id="ll-seguro" name="seguro" defaultValue="libre" {...a11y('seguro')}>
            {CONTACTO_SEGURO.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </select>
          <FieldError k="seguro" msg={errores.seguro} />
        </div>
        <div className="field">
          <label htmlFor="ll-franja">
            Horario en que podemos llamarte <span className="muted">(opcional)</span>
          </label>
          <input id="ll-franja" name="franja" maxLength={LIMITES_LLAMADA.franja} placeholder="Por ejemplo, por la tarde" {...a11y('franja')} />
          <FieldError k="franja" msg={errores.franja} />
        </div>
      </div>

      <div className="field">
        <label htmlFor="ll-descripcion">
          En pocas palabras, ¿qué ocurre? <span className="muted">(opcional)</span>
        </label>
        <textarea id="ll-descripcion" name="descripcion" rows={3} maxLength={LIMITES_LLAMADA.descripcion} aria-describedby="ll-descripcion-ayuda" {...a11y('descripcion')} />
        <p className="small muted" id="ll-descripcion-ayuda">
          Sin datos de salud, documentos ni detalles que no quieras dejar por escrito: te preguntaremos al llamarte.
        </p>
        <FieldError k="descripcion" msg={errores.descripcion} />
      </div>

      <div>
        <label className="check">
          <input type="checkbox" id="ll-privacidad" name="privacidad" required {...a11y('privacidad')} />
          <span>
            He leído y acepto la <Link href="/politica-de-privacidad/">política de privacidad</Link>.
          </span>
        </label>
        <FieldError k="privacidad" msg={errores.privacidad} />
      </div>

      {estado.tipo === 'error' && (
        <p className="form-fail" role="alert">
          No hemos podido recibir tu solicitud. Vuelve a intentarlo; tus datos siguen escritos. Si es urgente, llama al{' '}
          <a href={`tel:${c.phoneIntl}`}>{c.phone}</a> ({c.etiqueta.toLowerCase()}).
        </p>
      )}

      <div className="actions">
        <button className="btn btn--red" type="submit" disabled={enviando}>
          {enviando ? 'Enviando…' : estado.tipo === 'error' ? 'Reintentar el envío' : 'Solicitar que me llamen'}
        </button>
        <a className="btn btn--ghost" href={`tel:${c.phoneIntl}`}>
          {c.llamar}
        </a>
      </div>
    </form>
  );
}
