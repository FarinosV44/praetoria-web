'use client';
import { useActionState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { guardarComoNota, preguntar, type ResultadoIA } from '@/app/(portal)/admin/expedientes/[id]/asistente/acciones';

import { ConCitas, type Cita } from './ConCitas';
import { Redactor, type EscritoActual } from './Redactor';

type Borrador = { escrito: string; version: number; titulo: string; modelos: { etiqueta: string; titulo: string; version: number; secciones: string; modelo_id: string }[]; avisos: { tipo: string; texto: string }[] };
export type MensajeIA = { id: string; rol: 'usuario' | 'asistente'; texto: string; citas: Cita[]; limites: string[]; autor: string; at: string; borrador?: Borrador | null };

const TIPO_AVISO: Record<string, string> = { laguna: 'Falta o contradicción', pendiente: 'Marcadores', norma: 'Norma sin verificar', jurisprudencia: 'Jurisprudencia retirada',
  trasvase: 'Datos de otro asunto retirados', cita: 'Citas', limite: 'Límite de lectura' };

/** Tarjeta de un borrador guardado: modelos utilizados, avisos y enlace a sus versiones. */
function TarjetaBorrador({ solicitud, b, texto, citas }: { solicitud: string; b: Borrador; texto: string; citas: Cita[] }) {
  const grupos = Object.entries(b.avisos.reduce<Record<string, string[]>>((a, x) => { (a[x.tipo] ??= []).push(x.texto); return a; }, {}));
  return (
    <div className="grid gap-2" data-borrador={b.version}>
      <p><span className="chip chip-aviso">BORRADOR · requiere revisión</span>{' '}
        <a href={`/admin/expedientes/${solicitud}/escritos/${b.escrito}/?v=${b.version}`} className="font-semibold">Abrir «{b.titulo}» · versión {b.version}</a></p>
      <div className="text-sm" data-modelos-usados>
        <strong>Modelos utilizados</strong>
        {b.modelos.length ? <ul>{b.modelos.map((m) => <li key={m.etiqueta}>{m.etiqueta} · <a href={`/admin/biblioteca/${m.modelo_id}/`}>{m.titulo}</a> v{m.version} — {m.secciones}</li>)}</ul>
          : <p className="ayuda">Ninguno: redactado solo con el expediente.</p>}
      </div>
      {grupos.length ? (
        <details className="text-sm" data-avisos>
          <summary>⚠️ {b.avisos.length} aviso{b.avisos.length > 1 ? 's' : ''} para revisar</summary>
          {grupos.map(([t, l]) => <div key={t}><strong>{TIPO_AVISO[t] ?? t}</strong><ul>{l.map((x, i) => <li key={i}>{x}</li>)}</ul></div>)}
        </details>
      ) : null}
      <details className="text-sm"><summary>Ver el comienzo del borrador</summary><ConCitas texto={texto} citas={citas} /></details>
    </div>
  );
}

const RAPIDAS = ['Resúmeme el asunto', '¿Qué falta para avanzar?', '¿Qué plazos y fechas constan y cuáles están sin verificar?',
  'Prepara un borrador de informe para el cliente', 'Prepara un borrador de escrito con lo que consta'];

function GuardarNota({ solicitud, mensaje }: { solicitud: string; mensaje: string }) {
  const [r, accion, pendiente] = useActionState<ResultadoIA, FormData>(guardarComoNota, {});
  if (r.ok) return <span className="chip chip-ok">{r.ok}</span>;
  return (
    <form action={accion} className="inline">
      <input type="hidden" name="solicitud" value={solicitud} /><input type="hidden" name="mensaje" value={mensaje} />
      <button className="btn-texto text-sm" disabled={pendiente}>Guardar como nota interna</button>
      {r.error ? <span className="text-xs" role="alert"> {r.error}</span> : null}
    </form>
  );
}

export function AsistenteIA({ solicitud, hilo, mensajes, estilos = [], modo = 'preguntar', escrito = null }: { solicitud: string; hilo: string | null; mensajes: MensajeIA[]; estilos?: { id: string; nombre: string }[]; modo?: 'preguntar' | 'redactar'; escrito?: EscritoActual | null }) {
  const router = useRouter();
  const [r, accion, pendiente] = useActionState<ResultadoIA, FormData>(preguntar, {});
  const texto = useRef<HTMLTextAreaElement>(null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (r.hilo && r.hilo !== hilo) router.replace(`?hilo=${r.hilo}`);
  }, [r.hilo, r.n, hilo, router]);
  const enviar = (t: string) => { if (texto.current) { texto.current.value = t; form.current?.requestSubmit(); } };
  return (
    <div className="grid gap-3">
      <ol className="cronologia" aria-label="Conversación con el asistente" aria-live="polite">
        {mensajes.length === 0 ? <li className="evento-linea">Pregunta lo que necesites sobre este expediente. Solo se usa lo que consta en él, con citas a cada fuente.</li> : null}
        {mensajes.map((m) => (
          <li key={m.id} className={`burbuja ${m.rol === 'usuario' ? 'burbuja-interna' : 'burbuja-documento'}`} data-ia={m.rol}>
            <p className="meta">{m.rol === 'usuario' ? m.autor : 'Asistente (borrador, revísalo)'} · {new Date(m.at).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}</p>
            {m.borrador ? <TarjetaBorrador solicitud={solicitud} b={m.borrador} texto={m.texto} citas={m.citas} />
              : m.rol === 'asistente' ? <ConCitas texto={m.texto} citas={m.citas} /> : <p className="whitespace-pre-wrap">{m.texto}</p>}
            {m.limites.length ? <ul className="text-xs mt-1" data-limites>{m.limites.map((l, i) => <li key={i}>⚠️ {l}</li>)}</ul> : null}
            {m.rol === 'asistente' && !m.borrador ? (
              <p className="flex flex-wrap gap-3 items-center mt-1">
                <button type="button" className="btn-texto text-sm" onClick={() => navigator.clipboard?.writeText(m.texto)}>Copiar</button>
                <GuardarNota solicitud={solicitud} mensaje={m.id} />
              </p>
            ) : null}
            {m.rol === 'asistente' && !m.borrador ? (
              <form method="post" action="/api/escritos/exportar/" className="flex flex-wrap gap-2 items-center text-sm mt-1" data-exportar>
                <input type="hidden" name="mensaje" value={m.id} />
                {estilos.length ? estilos.map((e, i) => <label key={e.id} className="flex gap-1 items-center"><input type="radio" name="estilo" value={e.id} defaultChecked={i === 0} /> {e.nombre}</label>)
                  : <span className="ayuda">Estilo base</span>}
                <button name="formato" value="docx" className="btn-texto">Descargar Word</button>
                <button name="formato" value="pdf" className="btn-texto">Descargar PDF</button>
                <span className="ayuda text-xs">(borrador: revísalo antes de usarlo)</span>
              </form>
            ) : null}
          </li>
        ))}
        {pendiente ? <li className="evento-linea" role="status">El asistente está leyendo el expediente…</li> : null}
      </ol>
      <nav className="flex gap-2" aria-label="Modo del asistente">
        <a href={`?${hilo ? `hilo=${hilo}&` : ''}modo=preguntar`} className={`chip ${modo === 'preguntar' ? 'chip-info' : 'chip-neutro'} no-underline`} aria-current={modo === 'preguntar' ? 'page' : undefined}>Preguntar</a>
        <a href={`?${hilo ? `hilo=${hilo}&` : ''}modo=redactar`} className={`chip ${modo === 'redactar' ? 'chip-info' : 'chip-neutro'} no-underline`} aria-current={modo === 'redactar' ? 'page' : undefined}>✍️ Redactar escrito con la biblioteca</a>
      </nav>
      {modo === 'redactar' ? <Redactor solicitud={solicitud} hilo={hilo} escrito={escrito} /> : (<>
      <div className="flex flex-wrap gap-2">
        {RAPIDAS.map((t) => <button key={t} type="button" className="chip chip-neutro" style={{ cursor: 'pointer', border: 0 }} disabled={pendiente} onClick={() => enviar(t)}>{t}</button>)}
      </div>
      <form ref={form} action={accion} className="caja-compositor">
        <input type="hidden" name="solicitud" value={solicitud} /><input type="hidden" name="hilo" value={hilo ?? ''} />
        <label htmlFor="ia-texto" className="sr-only">Pregunta al asistente</label>
        <textarea id="ia-texto" ref={texto} name="texto" rows={3} maxLength={8000} placeholder="Pregunta sobre este expediente…"
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); form.current?.requestSubmit(); } }} />
        <div className="fila">
          <span className="ayuda text-xs">La IA solo propone: nada se envía, guarda ni publica sin que tú lo hagas.</span>
          <button className="btn btn-primario" style={{ minHeight: 38 }} disabled={pendiente}>{pendiente ? 'Pensando…' : 'Preguntar'}</button>
        </div>
      </form>
      </>)}
      {r.error ? <p className="error text-sm" role="alert">{r.error}</p> : null}
    </div>
  );
}
