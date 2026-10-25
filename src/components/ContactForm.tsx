'use client';

// Formulario de contacto. Sin JavaScript se envía como formulario clásico a /api/consulta.
// Con JavaScript: validación accesible (mismas reglas que el servidor), un solo envío a la vez,
// reintento si falla la red o la entrega, y confirmación solo cuando el servidor la acepta.
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AREAS, AREAS_CON_ASUNTO, AREAS_CON_CUESTIONARIO, DOCUMENTOS, IMPORTES, INCIDENCIAS, LIMITES, ORGANISMOS, PAPELES, PREFERENCIAS, PROBLEMAS_LABORALES, REPRESENTA, SITUACIONES, validarConsulta, type AreaId, type ErroresConsulta } from '@/lib/consulta';
import { canalDe, contactos } from '@/lib/site';
import { servicioPorId, serviciosDe } from '@/lib/servicios-indice';
import type { ServicioArea } from '@/lib/servicios';
import { leerRespuestasDivorcio, resumenDivorcio } from '@/lib/cuestionario-divorcio';
import { leerRespuestasHacienda, resumenHacienda } from '@/lib/cuestionario-hacienda';
import { leerAtribucion, paginaOrigen } from '@/lib/atribucion';
import { medir } from '@/lib/medicion';
import { apiUrl } from '@/lib/api';

type Estado = { tipo: 'editando' } | { tipo: 'enviando' } | { tipo: 'error'; mensaje: string } | { tipo: 'enviada'; area: AreaId; asunto?: string };

const ORDEN: (keyof ErroresConsulta)[] = ['nombre', 'area', 'servicio', 'detalle', 'organismo', 'documento', 'papel', 'incidencia', 'importe', 'representa', 'problema', 'situacion', 'fecha', 'mensaje', 'preferencia', 'telefono', 'email', 'privacidad'];
const ETIQUETA: Partial<Record<keyof ErroresConsulta, string>> = {
  nombre: 'Nombre', area: 'Área', servicio: 'Asunto', papel: 'Papel en el transporte', incidencia: 'Tipo de incidencia', importe: 'Importe', detalle: 'Detalle del asunto', organismo: 'Organismo', documento: 'Documento', representa: 'A quién representas', problema: 'Tipo de problema', situacion: 'Situación', fecha: 'Fecha', mensaje: 'Consulta', preferencia: 'Forma de contacto', telefono: 'Teléfono', email: 'Correo', privacidad: 'Privacidad',
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
  const [problema, setProblema] = useState<string>('');
  const [cuestionario, setCuestionario] = useState<{ tipo: 'divorcio' | 'hacienda'; texto: string } | null>(null);
  const [detalle, setDetalle] = useState<string>('');
  const [organismo, setOrganismo] = useState<string>('');
  const [documento, setDocumento] = useState<string>('');
  const [fechaInicial, setFechaInicial] = useState<string>('');
  const mensajeRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const resumenRef = useRef<HTMLDivElement>(null);
  const exitoRef = useRef<HTMLDivElement>(null);
  const cargado = useRef(0);
  const envioId = useRef('');
  const enCurso = useRef(false);
  const empezado = useRef(false); // form_start una sola vez
  const exitos = useRef(new Set<string>()); // form_success una sola vez por consulta // guarda inmediata contra doble envío (el estado de React se actualiza en el siguiente render)

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
      if (sv.problemaLaboral) setProblema(sv.problemaLaboral);
    } else if (ar) setArea(ar.id);
    // Respuestas del cuestionario de divorcio de esta sesión (nunca por la URL)
    if (q.get('cuestionario') === 'divorcio') {
      const resp = leerRespuestasDivorcio();
      if (resp) setCuestionario({ tipo: 'divorcio', texto: resumenDivorcio(resp) });
    }
    if (q.get('cuestionario') === 'hacienda') {
      const resp = leerRespuestasHacienda();
      if (resp) {
        setCuestionario({ tipo: 'hacienda', texto: resumenHacienda(resp) });
        setOrganismo(resp.organismo);
        setDocumento(resp.documento);
        setFechaInicial(resp.recibida);
        if (resp.descripcion && mensajeRef.current && !mensajeRef.current.value) mensajeRef.current.value = resp.descripcion;
      }
    }
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
      representa: fd.get('representa'),
      problema: fd.get('problema'),
      situacion: fd.get('situacion'),
      cuestionario: cuestionario?.texto ?? '',
      organismo,
      documento,
      detalle,
      // Atribución (#9): origen siempre (es funcional); landing y UTM solo si hay consentimiento
      origen: paginaOrigen(),
      ...(leerAtribucion() ?? {}),
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
      const res = await fetch(apiUrl('/api/consulta'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(raw),
        signal: AbortSignal.timeout(20_000),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.ok) {
        // Conversión solo cuando el servidor confirma que Netlify Forms aceptó la consulta (no al ver /gracias/)
        if (!exitos.current.has(envioId.current)) {
          exitos.current.add(envioId.current);
          medir('form_success', { area: v.data.area, servicio: v.data.servicio || undefined });
        }
        setEstado({ tipo: 'enviada', area: v.data.area, asunto: servicioPorId(v.data.servicio)?.nombre });
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
    const c = canalDe(estado.area);
    return (
      <div ref={exitoRef} className="form-ok" tabIndex={-1} role="status">
        <h2>Hemos recibido tu consulta</h2>
        {estado.asunto && (
          <p>
            Asunto: <strong>{estado.asunto}</strong>.
          </p>
        )}
        <p>
          La revisará {c.id === 'laboral' ? 'el área laboral del despacho' : 'el despacho'}. Te responderemos por el medio que has indicado lo
          antes posible. Si tu asunto tiene un plazo que vence en los próximos días, llama al <a href={`tel:${c.phoneIntl}`}>{c.phone}</a> (
          {c.etiqueta.toLowerCase()}) para revisarlo con prioridad.
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
  const preguntaMinima = servicio ? servicioPorId(servicio)?.preguntaMinima : undefined;

  return (
    <form
      ref={formRef}
      className="form"
      name="contacto"
      method="POST"
      action={apiUrl('/api/consulta')}
      noValidate
      onSubmit={onSubmit}
      aria-busy={enviando}
      onFocus={() => {
        if (empezado.current) return;
        empezado.current = true;
        medir('form_start', { area: area || undefined, servicio: servicio || undefined });
      }}
    >
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
            if (servicio && servicioPorId(servicio)?.area !== e.target.value) {
              setServicio('');
              setDetalle('');
            }
            if (e.target.value !== 'transporte') setIncidencia('');
            if (e.target.value !== 'laboral') setProblema('');
            if (!(AREAS_CON_CUESTIONARIO as readonly string[]).includes(e.target.value)) setCuestionario(null);
            if (e.target.value !== 'hacienda') {
              setOrganismo('');
              setDocumento('');
            }
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
            <button
              type="button"
              className="linklike"
              onClick={() => {
                setServicio('');
                setDetalle('');
              }}
            >
              Quitar o cambiar
            </button>
          </p>
        )}
        {cuestionario && (AREAS_CON_CUESTIONARIO as readonly string[]).includes(area) && (
          <div className="preselected preselected--quiz" id="cuestionario">
            <p>
              <strong>{cuestionario.tipo === 'divorcio' ? 'Tus respuestas del cuestionario de divorcio' : 'El resumen de tu notificación'}</strong> se enviará con la
              consulta:{' '}
              <button type="button" className="linklike" onClick={() => setCuestionario(null)}>
                No enviarlo
              </button>
            </p>
            <pre>{cuestionario.texto}</pre>
            <input type="hidden" name="cuestionario" value={cuestionario.texto} />
          </div>
        )}
        {!servicio && (AREAS_CON_ASUNTO as readonly string[]).includes(area) && (
          <div className="field">
            <label htmlFor="asunto">
              Asunto <span className="muted">(opcional)</span>
            </label>
            <select
              id="asunto"
              value=""
              onChange={(e) => {
                setServicio(e.target.value);
                setDetalle('');
              }}
            >
              <option value="">Elige el más parecido, si lo sabes</option>
              {serviciosDe(area as ServicioArea).map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nombre}
                </option>
              ))}
            </select>
          </div>
        )}
        {preguntaMinima && (
          <fieldset className="field" {...(err('detalle') ? { 'aria-describedby': 'err-detalle' } : {})}>
            <legend className="sublegend">
              {preguntaMinima.label} <span className="muted">(opcional)</span>
            </legend>
            <div className="radios">
              {preguntaMinima.opciones.map((o, i) => (
                <label key={o}>
                  <input type="radio" id={i === 0 ? 'detalle' : undefined} name="detalle" value={o} checked={detalle === o} onChange={() => setDetalle(o)} /> {o}
                </label>
              ))}
            </div>
            <FieldError k="detalle" msg={errores.detalle} />
          </fieldset>
        )}
        <FieldError k="servicio" msg={errores.servicio} />
        {area === 'laboral' && (
          <p className="small muted">
            Los asuntos laborales los atiende el área laboral del despacho ({contactos.laboral.phone}, llamadas y WhatsApp).
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

      {area === 'hacienda' && (
        <fieldset className="field form-extra">
          <legend>Sobre la notificación</legend>
          <fieldset className="field" {...(err('organismo') ? { 'aria-describedby': 'err-organismo' } : {})}>
            <legend className="sublegend">¿Quién la envía?</legend>
            <div className="radios">
              {ORGANISMOS.map((x) => (
                <label key={x.id}>
                  <input type="radio" id={`org-${x.id}`} name="organismo" value={x.id} required checked={organismo === x.id} onChange={() => setOrganismo(x.id)} /> {x.label}
                </label>
              ))}
            </div>
            <FieldError k="organismo" msg={errores.organismo} />
          </fieldset>
          {(organismo === 'inss' || documento === 'prestacion') && (
            <p className="small">
              Las resoluciones sobre prestaciones (incapacidad, altas médicas) las atiende el{' '}
              <Link href="/abogado-laboralista-valencia/">área laboral</Link>. Puedes cambiar el área arriba o enviarla así: la derivaremos.
            </p>
          )}
          <div className="row">
            <div className="field">
              <label htmlFor="documento">Tipo de documento</label>
              <select id="documento" name="documento" value={documento} onChange={(e) => setDocumento(e.target.value)} {...a11y('documento')}>
                <option value="">Sin indicar</option>
                {DOCUMENTOS.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.label}
                  </option>
                ))}
              </select>
              <FieldError k="documento" msg={errores.documento} />
            </div>
            <div className="field">
              <label htmlFor="fecha">Fecha de recepción o apertura</label>
              <input id="fecha" name="fecha" type="date" min="2000-01-01" defaultValue={fechaInicial} {...a11y('fecha')} aria-describedby={err('fecha') ? 'err-fecha fecha-ayuda' : 'fecha-ayuda'} />
              <p className="small muted" id="fecha-ayuda">
                Para revisar antes las que tienen plazo. El plazo exacto lo comprobaremos en el documento.
              </p>
              <FieldError k="fecha" msg={errores.fecha} />
            </div>
          </div>
          <p className="small muted">No adjuntes la notificación: si hace falta, te la pediremos por un canal seguro.</p>
        </fieldset>
      )}

      {area === 'laboral' && (
        <fieldset className="field form-extra">
          <legend>Sobre tu asunto laboral</legend>
          <fieldset className="field" {...(err('representa') ? { 'aria-describedby': 'err-representa' } : {})}>
            <legend className="sublegend">¿A quién representas?</legend>
            <div className="radios radios--stack">
              {REPRESENTA.map((x) => (
                <label key={x.id}>
                  <input type="radio" id={`rep-${x.id}`} name="representa" value={x.id} required /> {x.label}
                </label>
              ))}
            </div>
            <FieldError k="representa" msg={errores.representa} />
          </fieldset>
          <div className="row">
            <div className="field">
              <label htmlFor="problema">Tipo de problema</label>
              <select id="problema" name="problema" value={problema} onChange={(e) => setProblema(e.target.value)} {...a11y('problema')}>
                <option value="">Sin indicar</option>
                {PROBLEMAS_LABORALES.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.label}
                  </option>
                ))}
              </select>
              <FieldError k="problema" msg={errores.problema} />
            </div>
            <div className="field">
              <label htmlFor="situacion">Situación actual</label>
              <select id="situacion" name="situacion" defaultValue="" {...a11y('situacion')}>
                <option value="">Sin indicar</option>
                {SITUACIONES.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.label}
                  </option>
                ))}
              </select>
              <FieldError k="situacion" msg={errores.situacion} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="fecha">Fecha en que te lo comunicaron o en que tiene efectos (opcional)</label>
            <input id="fecha" name="fecha" type="date" min="2000-01-01" {...a11y('fecha')} aria-describedby={err('fecha') ? 'err-fecha fecha-ayuda' : 'fecha-ayuda'} />
            <p className="small muted" id="fecha-ayuda">
              Nos ayuda a revisar antes los asuntos con plazos cortos. No calculamos plazos automáticamente: te lo confirmaremos al revisar tu caso.
            </p>
            <FieldError k="fecha" msg={errores.fecha} />
          </div>
          <p className="small muted">
            No incluyas diagnósticos, informes médicos ni otros documentos, ni en este formulario ni en el mensaje. Si hacen falta, te los pediremos por un canal seguro.
          </p>
        </fieldset>
      )}

      {area === 'penal' && (
        <div className="field">
          <label htmlFor="fecha">Fecha de la citación, del juicio o de los hechos (opcional)</label>
          <input id="fecha" name="fecha" type="date" min="2000-01-01" {...a11y('fecha')} aria-describedby={err('fecha') ? 'err-fecha fecha-ayuda' : 'fecha-ayuda'} />
          <p className="small muted" id="fecha-ayuda">
            Si tienes una citación, indica la fecha para revisar antes tu consulta. Enviar el formulario no suspende ni aplaza ninguna citación. Si es para hoy o mañana,
            llama al despacho.
          </p>
          <FieldError k="fecha" msg={errores.fecha} />
        </div>
      )}

      <div className="field">
        <label htmlFor="mensaje">¿Qué ha pasado y qué te gustaría conseguir?</label>
        <textarea ref={mensajeRef} id="mensaje" name="mensaje" required minLength={LIMITES.mensajeMin} maxLength={LIMITES.mensaje} {...a11y('mensaje')} />
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
          {estado.mensaje} También puedes llamar al <a href={`tel:${canalDe(area).phoneIntl}`}>{canalDe(area).phone}</a> ({canalDe(area).etiqueta.toLowerCase()}).
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
