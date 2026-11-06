'use client';
import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { guardarVersion, type ResultadoEscrito } from '@/app/(portal)/admin/expedientes/[id]/escritos/[escrito]/acciones';
import { useEjecucion } from './useEjecucion';

const ACCIONES: { id: string; t: string }[] = [
  { id: 'reformular', t: 'Reformular' }, { id: 'ampliar', t: 'Ampliar fundamentos' }, { id: 'acortar', t: 'Acortar' },
  { id: 'argumentar', t: 'Mejorar argumentación' }, { id: 'tono', t: 'Cambiar tono' }, { id: 'hechos', t: 'Añadir hechos del expediente' },
];
type Seleccion = { ini: number; fin: number; texto: string };
type Propuesta = { texto: string; avisos: string[]; modelo: string };

/** Editor del borrador. Se selecciona un párrafo, la IA propone y el abogado acepta o rechaza; guardar crea una versión nueva.
 *  Lo que se escribe se conserva en este navegador hasta guardarlo, para no perder trabajo si se cierra la pestaña. */
export function EditorEscrito({ solicitud, escrito, base, texto, ia }: { solicitud: string; escrito: string; base: number; texto: string; ia: boolean }) {
  const router = useRouter();
  const clave = `praetoria:borrador:${escrito}:${base}`;
  const [valor, setValor] = useState(texto);
  const [recuperado, setRecuperado] = useState(false);
  const [sel, setSel] = useState<Seleccion | null>(null);
  const [instruccion, setInstruccion] = useState('');
  const [modo, setModo] = useState<'rapido' | 'equilibrado' | 'maximo'>('equilibrado');
  const [propuesta, setPropuesta] = useState<(Propuesta & { sel: Seleccion }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const pendiente = useRef<Seleccion | null>(null);
  const [r, accion, guardando] = useActionState<ResultadoEscrito, FormData>(guardarVersion, {});
  const eje = useEjecucion(null, (x, limpiar) => {
    if (x.estado === 'error') { setError(x.error ?? 'No se ha podido preparar la propuesta.'); limpiar(); return; }
    const p = x.resultado as Propuesta | null;
    if (p && pendiente.current) setPropuesta({ ...p, sel: pendiente.current });
    limpiar();
  });

  useEffect(() => {
    // Solo se puede leer en el navegador: leerlo al iniciar el estado rompería la hidratación.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    try { const g = localStorage.getItem(clave); if (g && g !== texto) { setValor(g); setRecuperado(true); } } catch { /* sin almacenamiento local */ }
  }, [clave, texto]);
  useEffect(() => {
    const t = setTimeout(() => { try { if (valor !== texto) localStorage.setItem(clave, valor); else localStorage.removeItem(clave); } catch { /* sin almacenamiento local */ } }, 600);
    return () => clearTimeout(t);
  }, [valor, clave, texto]);
  useEffect(() => {
    if (r.version) { try { localStorage.removeItem(clave); } catch { /* sin almacenamiento local */ } router.replace(`?v=${r.version}`); }
  }, [r.version, r.n, router, clave]);
  useEffect(() => {
    const aviso = (e: BeforeUnloadEvent) => { if (valor !== texto) e.preventDefault(); };
    window.addEventListener('beforeunload', aviso);
    return () => window.removeEventListener('beforeunload', aviso);
  }, [valor, texto]);

  const cambiado = valor !== texto;
  const palabras = useMemo(() => valor.trim().split(/\s+/).filter(Boolean).length, [valor]);
  const pendientes = useMemo(() => (valor.match(/\[PENDIENTE:/g) ?? []).length, [valor]);
  const leerSel = () => {
    const a = area.current;
    if (!a) return;
    setSel(a.selectionEnd > a.selectionStart ? { ini: a.selectionStart, fin: a.selectionEnd, texto: valor.slice(a.selectionStart, a.selectionEnd) } : null);
  };

  async function pedir(acc: string) {
    if (!sel || eje.ocupado) return;
    setError(null); setPropuesta(null);
    pendiente.current = sel;
    try {
      const resp = await fetch('/api/ia/editar/', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ solicitud, escrito, accion: acc, seleccion: sel.texto, instruccion: instruccion.trim() || undefined, texto: valor, modo }) });
      const j = await resp.json().catch(() => ({})) as { ejecucion?: string; error?: string };
      if (!resp.ok || !j.ejecucion) { setError(j.error ?? 'No se ha podido pedir la propuesta.'); return; }
      eje.seguir(j.ejecucion);
    } catch { setError('Sin conexión con el servidor. Tu texto sigue aquí.'); }
  }
  const aceptar = () => {
    if (!propuesta) return;
    // Si el texto ha cambiado mientras tanto, la selección ya no es fiable: no se reemplaza a ciegas.
    if (valor.slice(propuesta.sel.ini, propuesta.sel.fin) !== propuesta.sel.texto) { setError('El texto ha cambiado desde que pediste la propuesta. Selecciónalo y vuelve a pedirla.'); setPropuesta(null); return; }
    setValor(valor.slice(0, propuesta.sel.ini) + propuesta.texto + valor.slice(propuesta.sel.fin));
    setPropuesta(null); setSel(null);
  };

  return (
    <section className="grid gap-2" aria-label="Editor del borrador" data-editor>
      {recuperado ? <p className="nota text-sm" role="status" data-recuperado>Hemos recuperado cambios sin guardar de este navegador. <button type="button" className="btn-texto" onClick={() => { setValor(texto); setRecuperado(false); }}>Descartarlos</button></p> : null}
      {ia ? (
        <div className="editor-herramientas" role="toolbar" aria-label="Asistente de edición">
          {ACCIONES.map((a) => <button key={a.id} type="button" className="chip chip-neutro" disabled={!sel || eje.ocupado} onClick={() => void pedir(a.id)} data-accion-ia={a.id}>{a.t}</button>)}
          <span className="flex gap-1 items-center flex-1 min-w-[14rem]">
            <input value={instruccion} onChange={(e) => setInstruccion(e.target.value)} maxLength={2000} placeholder="Otra instrucción sobre lo seleccionado…" aria-label="Instrucción para la IA" className="border rounded px-2 py-1 text-sm flex-1 min-w-0"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (instruccion.trim()) void pedir('libre'); } }} />
            <button type="button" className="chip chip-info" disabled={!sel || eje.ocupado || !instruccion.trim()} onClick={() => void pedir('libre')}>Pedir</button>
          </span>
          <select value={modo} onChange={(e) => setModo(e.target.value as typeof modo)} aria-label="Calidad" className="text-sm"><option value="rapido">Rápido</option><option value="equilibrado">Equilibrado</option><option value="maximo">Máxima calidad</option></select>
          <p className="ayuda text-xs w-full">{sel ? `${sel.texto.length.toLocaleString('es-ES')} caracteres seleccionados.` : 'Selecciona un párrafo para pedir un cambio a la IA.'}</p>
        </div>
      ) : null}
      {eje.ocupado ? <div className="burbuja burbuja-documento" style={{ maxWidth: '100%', width: '100%' }} role="status"><p className="meta"><span className="punto-vivo" aria-hidden="true" /> {eje.progreso ?? 'Preparando la propuesta…'}</p><p className="whitespace-pre-wrap text-sm">{eje.parcial}</p></div> : null}
      {propuesta ? (
        <div className="propuesta" data-propuesta-ia>
          <p className="etiqueta text-sm">Propuesta de la IA · {propuesta.modelo}</p>
          <div className="propuesta-comparar">
            <div><p className="ayuda text-xs">Texto actual</p><p className="whitespace-pre-wrap text-sm" data-cambio="-">{propuesta.sel.texto}</p></div>
            <div><p className="ayuda text-xs">Propuesta</p><p className="whitespace-pre-wrap text-sm" data-cambio="+">{propuesta.texto}</p></div>
          </div>
          {propuesta.avisos.length ? <ul className="text-xs">{propuesta.avisos.map((a, i) => <li key={i}>⚠️ {a}</li>)}</ul> : null}
          <p className="flex gap-2 mt-2"><button type="button" className="btn btn-primario" style={{ minHeight: 36 }} onClick={aceptar}>Aceptar</button><button type="button" className="btn btn-secundario" style={{ minHeight: 36 }} onClick={() => setPropuesta(null)}>Rechazar</button></p>
        </div>
      ) : null}
      {error ? <p className="error text-sm" role="alert">{error}</p> : null}
      <form action={accion} className="grid gap-2">
        <input type="hidden" name="solicitud" value={solicitud} /><input type="hidden" name="escrito" value={escrito} /><input type="hidden" name="base" value={base} />
        <label htmlFor="borrador-texto" className="etiqueta text-sm">Texto del borrador (versión {base})</label>
        <textarea id="borrador-texto" ref={area} name="texto" value={valor} maxLength={200000} className="editor-texto" onChange={(e) => setValor(e.target.value)} onSelect={leerSel} onKeyUp={leerSel} onMouseUp={leerSel} />
        <p className="fila">
          <span className="ayuda text-xs" role="status">{palabras.toLocaleString('es-ES')} palabras{pendientes ? ` · ${pendientes} [PENDIENTE] por completar` : ''} · {cambiado ? 'cambios sin guardar (conservados en este navegador)' : 'sin cambios'}</span>
          <span className="flex gap-2 items-center">
            {cambiado ? <button type="button" className="btn-texto text-sm" onClick={() => setValor(texto)}>Descartar cambios</button> : null}
            <button className="btn btn-primario" style={{ minHeight: 38 }} disabled={guardando || !cambiado}>{guardando ? 'Guardando…' : 'Guardar como versión nueva'}</button>
          </span>
        </p>
        {r.error ? <p className="error text-sm" role="alert">{r.error}</p> : null}
        {r.ok ? <p className="chip chip-ok" role="status">{r.ok}</p> : null}
      </form>
    </section>
  );
}
