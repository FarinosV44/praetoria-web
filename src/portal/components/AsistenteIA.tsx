'use client';
import { useActionState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { guardarComoNota, preguntar, type ResultadoIA } from '@/app/(portal)/admin/expedientes/[id]/asistente/acciones';

type Cita = { id: string; etiqueta: string; enlace?: string };
export type MensajeIA = { id: string; rol: 'usuario' | 'asistente'; texto: string; citas: Cita[]; limites: string[]; autor: string; at: string };

const RAPIDAS = ['Resúmeme el asunto', '¿Qué falta para avanzar?', '¿Qué plazos y fechas constan y cuáles están sin verificar?',
  'Prepara un borrador de informe para el cliente', 'Prepara un borrador de escrito con lo que consta'];

/** Muestra el texto con las citas [D1-p2] como enlaces a su fuente. */
function ConCitas({ texto, citas }: { texto: string; citas: Cita[] }) {
  const mapa = new Map(citas.map((c) => [c.id, c]));
  const partes = texto.split(/(\[(?:[NMTF]\d+|D\d+-p\d+)\])/g);
  return (
    <p className="whitespace-pre-wrap">
      {partes.map((p, i) => {
        const c = mapa.get(p.slice(1, -1));
        if (!c) return <span key={i}>{p}</span>;
        return c.enlace ? <a key={i} href={c.enlace} target="_blank" rel="noopener" title={c.etiqueta} className="chip chip-info no-underline text-xs" data-cita={c.id}>{c.id}</a>
          : <span key={i} title={c.etiqueta} className="chip chip-neutro text-xs" data-cita={c.id}>{c.id}</span>;
      })}
    </p>
  );
}

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

export function AsistenteIA({ solicitud, hilo, mensajes, estilos = [] }: { solicitud: string; hilo: string | null; mensajes: MensajeIA[]; estilos?: { id: string; nombre: string }[] }) {
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
            {m.rol === 'asistente' ? <ConCitas texto={m.texto} citas={m.citas} /> : <p className="whitespace-pre-wrap">{m.texto}</p>}
            {m.limites.length ? <ul className="text-xs mt-1" data-limites>{m.limites.map((l, i) => <li key={i}>⚠️ {l}</li>)}</ul> : null}
            {m.rol === 'asistente' ? (
              <p className="flex flex-wrap gap-3 items-center mt-1">
                <button type="button" className="btn-texto text-sm" onClick={() => navigator.clipboard?.writeText(m.texto)}>Copiar</button>
                <GuardarNota solicitud={solicitud} mensaje={m.id} />
              </p>
            ) : null}
            {m.rol === 'asistente' ? (
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
      {r.error ? <p className="error text-sm" role="alert">{r.error}</p> : null}
    </div>
  );
}
