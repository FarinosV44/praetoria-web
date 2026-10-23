'use client';

// Formulario de contacto. Sin JavaScript se envía como formulario clásico a /api/consulta.
// Con JavaScript: validación accesible (mismas reglas que el servidor), un solo envío a la vez,
// reintento si falla la red o la entrega, y confirmación solo cuando el servidor la acepta.
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AREAS, IMPORTES, INCIDENCIAS, LIMITES, PAPELES, PREFERENCIAS, responsable, validarConsulta, type AreaId, type ErroresConsulta } from '@/lib/consulta';
import { site } from '@/lib/site';
import { servicioPorId } from '@/lib/servicios';

type Estado = { tipo: 'editando' } | { tipo: 'enviando' } | { tipo: 'error'; mensaje: string } | { tipo: 'enviada'; area: AreaId };

const ORDEN: (keyof ErroresConsulta)[] = ['nombre', 'area', 'servicio', 'papel', 'incidencia', 'importe', 'fecha', 'mensaje', 'preferencia', 'telefono', 'email', 'privacidad'];
const ETIQUETA: Partial<Record<keyof ErroresConsulta, string>> = {
  nombre: 'Nombre', area: 'Área', servicio: 'Asunto', papel: 'Papel en el transporte', incidencia: 'Tipo de incidencia', importe: 'Importe', fecha: 'Fecha', mensaje: 'Consulta', preferencia: 'Forma de contacto', telefono: 'Teléfono', email: 'Correo', privacidad: 'Privacidad',
};

const nuevoId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);

function FieldError({ k, msg }: { k: keyof ErroresConsulta; msg?: string }) {
  return msg ? (
    <p className="field-error" id={`err-${k}`}>
      {msg}
    </p>
  ) : null;
}

export function ContactForm({ areaInicial }: { areaInicial?: AreaId }) {
  const [estado, setEstado] = useState<Estado>({ tipo: 'editando' });
  const [errores, setErrores] = useState<ErroresConsulta>({});
  const [preferencia, setPreferencia] = useState<string>('');
  const [area, setArea] = useState<string>(areaInicial ?? '');
  const [servicio, setServicio] = useState<string>('');
  const [incidencia, setIncidencia] = useState<string>('');
  const formRef = useRef<HTMLFormElement>(null);
  const resumenRef = useRef<HTMLDivElement>(null);
  const exitoRef = useRef<HTMLDivElement>(null);
  const cargado = useRef(0);
  const envioId = useRef('');
  const enCurso = useRef(false); // guarda inmediata contra doble envío (el estado de React se actualiza en el siguiente render)

  useEffect(() => {
    cargado.current = Date.now();
    // Servicio o área preseleccionados desde un CTA (/contacto/?servicio=… o ?area=…). Solo se aceptan valores conocidos.
    const q = new URLSearchParams(window.location.search);
    const sv = servicioPorId(q.get('servicio') ?? '');
    const ar = AREAS.find((a) => a.id === q.get('area'));
    /* eslint-disable react-hooks/set-state-in-effect -- la URL solo existe en el navegador (exportación estática) */
    if (sv) {
      setServicio(sv.id);
      setArea(sv.area);
      if (sv.incidencia) setIncidencia(sv.incidencia);
    } else if (ar) setArea(ar.id);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);
  useEffect(() => {
    if (estado.tipo === 'enviada') exitoRef.current?.focus();
  }, [estado.tipo]);

  const datos = () => {
    const fd = new FormData(formRef.current!);
    return {
      nombre: fd.get('nombre'),
      email: fd.get('email'),
      telefono: fd.get('telefono'),
      area: fd.get('area'),
      mensaje: fd.get('mensaje'),
      preferencia: fd.get('preferencia'),
      servicio,
      papel: fd.get('papel'),
      incidencia: fd.get('incidencia'),
      importe: fd.get('importe'),
      fecha: fd.get('fecha'),
      privacidad: fd.get('privacidad') === 'on',
      'empresa-web': fd.get('empresa-web'),
    };
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (enCurso.current) return; // doble clic o Enter repetido
    // El mismo id en los reintentos de una misma consulta, para poder detectar duplicados
    envioId.current ||= nuevoId();
    const raw = { ...datos(), id: envioId.current, t: cargado.current };
    const v = validarConsulta(raw);
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
      const res = await fetch('/api/consulta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(raw),
        signal: AbortSignal.timeout(20_000),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.ok) {
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
      setEstado({
        tipo: 'error',
        mensaje: 'No hemos podido recibir tu consulta. Comprueba tu conexión y vuelve a intentarlo; tus datos siguen escritos.',
      });
    } finally {
      enCurso.current = false;
    }
  };

  if (estado.tipo === 'enviada') {
    const r = responsable(estado.area);
    return (
      <div ref={exitoRef} className="form-ok" tabIndex={-1} role="status">
        <h2>Hemos recibido tu consulta</h2>
        <p>
          La revisará {r.nombre}. Te responderemos por el medio que has indicado lo antes posible. Si tu asunto tiene un plazo que vence en
          los próximos días, llámanos al <a href={`tel:${site.phoneIntl}`}>{site.phone}</a> para revisarlo con prioridad.
        </p>
      </div>
    );
  }

  const err = (k: keyof ErroresConsulta) => errores[k];
  const a11y = (k: keyof ErroresConsulta) => (err(k) ? { 'aria-invalid': true as const, 'aria-describedby': `err-${k}` } : {});
  const lista = ORDEN.filter((k) => err(k));
  const enviando = estado.tipo === 'enviando';
  const telObligatorio = preferencia === 'llamada' || preferencia === 'whatsapp';
  const emailObligatorio = preferencia === 'correo';
  const resp = area ? responsable(area as AreaId) : null;

  return (
    <form ref={formRef} className="form" name="contacto" method="POST" action="/api/consulta" noValidate onSubmit={onSubmit} aria-busy={enviando}>
      <div ref={resumenRef} tabIndex={-1} className="form-errors" hidden={!lista.length} role="alert">
        <p>Revisa {lista.length === 1 ? 'este campo' : `estos ${lista.length} campos`} antes de enviar:</p>
        <ul>
          {lista.map((k) => (
            <li key={k}>
              <a href={`#${k === 'preferencia' ? 'pref-llamada' : k}`}>
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

      <div className="field">
        <label htmlFor="nombre">Nombre</label>
        <input id="nombre" name="nombre" autoComplete="name" maxLength={LIMITES.nombre} required {...a11y('nombre')} />
        <FieldError k="nombre" msg={errores.nombre} />
      </div>

      <div className="field">
        <label htmlFor="area">¿Sobre qué es tu consulta?</label>
        <select
          id="area"
          name="area"
          required
          value={area}
          onChange={(e) => {
            setArea(e.target.value);
            // Si se cambia de área, el asunto preseleccionado deja de aplicar
            if (servicio && servicioPorId(servicio)?.area !== e.target.value) setServicio('');
            if (e.target.value !== 'transporte') setIncidencia('');
          }}
          {...a11y('area')}
        >
          <option value="" disabled>
            Elige una opción
          </option>
          {AREAS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
        <FieldError k="area" msg={errores.area} />
        <input type="hidden" name="servicio" value={servicio} />
        {servicio && (
          <p className="preselected" id="servicio">
            Consulta sobre: <strong>{servicioPorId(servicio)?.nombre}</strong>{' '}
            <button type="button" className="linklike" onClick={() => setServicio('')}>
              Quitar o cambiar
            </button>
          </p>
        )}
        <FieldError k="servicio" msg={errores.servicio} />
        {resp && area === 'laboral' && (
          <p className="small muted">
            Los asuntos laborales los atiende {resp.nombre}, experta en Derecho Laboral ({resp.telefono}).
          </p>
        )}
      </div>


      {area === 'transporte' && (
        <fieldset className="field form-extra">
          <legend>
            Sobre el transporte <span className="muted">(opcional: nos ayuda a priorizar)</span>
          </legend>
          <div className="row">
            <div className="field">
              <label htmlFor="papel">Tu papel</label>
              <select id="papel" name="papel" defaultValue="" {...a11y('papel')}>
                <option value="">Sin indicar</option>
                {PAPELES.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.label}
                  </option>
                ))}
              </select>
              <FieldError k="papel" msg={errores.papel} />
            </div>
            <div className="field">
              <label htmlFor="incidencia">Tipo de incidencia</label>
              <select id="incidencia" name="incidencia" value={incidencia} onChange={(e) => setIncidencia(e.target.value)} {...a11y('incidencia')}>
                <option value="">Sin indicar</option>
                {INCIDENCIAS.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.label}
                  </option>
                ))}
              </select>
              <FieldError k="incidencia" msg={errores.incidencia} />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label htmlFor="importe">Importe orientativo</label>
              <select id="importe" name="importe" defaultValue="" {...a11y('importe')}>
                <option value="">Sin indicar</option>
                {IMPORTES.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.label}
                  </option>
                ))}
              </select>
              <FieldError k="importe" msg={errores.importe} />
            </div>
            <div className="field">
              <label htmlFor="fecha">Fecha de la factura, la entrega o la incidencia</label>
              <input id="fecha" name="fecha" type="date" min="2000-01-01" {...a11y('fecha')} aria-describedby={err('fecha') ? 'err-fecha fecha-ayuda' : 'fecha-ayuda'} />
              <p className="small muted" id="fecha-ayuda">
                Solo para revisar antes los asuntos con fechas próximas. No calculamos plazos automáticamente.
              </p>
              <FieldError k="fecha" msg={errores.fecha} />
            </div>
          </div>
          <p className="small muted">No adjuntes CMR, facturas ni otros documentos: si hacen falta, te los pediremos por un canal seguro.</p>
        </fieldset>
      )}

      <div className="field">
        <label htmlFor="mensaje">¿Qué ha pasado y qué te gustaría conseguir?</label>
        <textarea id="mensaje" name="mensaje" required minLength={LIMITES.mensajeMin} maxLength={LIMITES.mensaje} {...a11y('mensaje')} />
        <FieldError k="mensaje" msg={errores.mensaje} />
      </div>

      <fieldset className="field" {...(err('preferencia') ? { 'aria-describedby': 'err-preferencia' } : {})}>
        <legend>¿Cómo prefieres que te contactemos?</legend>
        <div className="radios">
          {PREFERENCIAS.map((p) => (
            <label key={p.id}>
              <input type="radio" id={`pref-${p.id}`} name="preferencia" value={p.id} required checked={preferencia === p.id} onChange={() => setPreferencia(p.id)} />{' '}
              {p.label}
            </label>
          ))}
        </div>
        <FieldError k="preferencia" msg={errores.preferencia} />
      </fieldset>

      <div className="row">
        <div className="field">
          <label htmlFor="telefono">
            Teléfono {telObligatorio ? <span className="req">(necesario para {preferencia === 'llamada' ? 'llamarte' : 'WhatsApp'})</span> : <span className="muted">(opcional)</span>}
          </label>
          <input id="telefono" name="telefono" type="tel" autoComplete="tel" maxLength={LIMITES.telefono} required={telObligatorio} {...a11y('telefono')} />
          <FieldError k="telefono" msg={errores.telefono} />
        </div>
        <div className="field">
          <label htmlFor="email">
            Correo electrónico {emailObligatorio ? <span className="req">(necesario para responderte)</span> : <span className="muted">(opcional)</span>}
          </label>
          <input id="email" name="email" type="email" autoComplete="email" maxLength={LIMITES.email} required={emailObligatorio} {...a11y('email')} />
          <FieldError k="email" msg={errores.email} />
        </div>
      </div>

      <div>
        <label className="check">
          <input type="checkbox" id="privacidad" name="privacidad" required {...a11y('privacidad')} />
          <span>
            He leído y acepto la <Link href="/politica-de-privacidad/">política de privacidad</Link>.
          </span>
        </label>
        <FieldError k="privacidad" msg={errores.privacidad} />
      </div>

      <p className="small muted">
        Enviar esta consulta no crea una relación abogado-cliente ni interrumpe ningún plazo. No adjuntes documentos ni datos de salud: si hacen
        falta, te los pediremos por un canal seguro.
      </p>

      {estado.tipo === 'error' && (
        <p className="form-fail" role="alert">
          {estado.mensaje} También puedes llamarnos al <a href={`tel:${site.phoneIntl}`}>{site.phone}</a>.
        </p>
      )}

      <div>
        <button className="btn btn--red" type="submit" disabled={enviando}>
          {enviando ? 'Enviando…' : estado.tipo === 'error' ? 'Reintentar el envío' : 'Enviar mi consulta'}
        </button>
      </div>
    </form>
  );
}
