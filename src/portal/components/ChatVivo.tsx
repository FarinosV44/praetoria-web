'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConCitas, type Cita } from './ConCitas';
import { useEjecucion, type EstadoEjecucion } from './useEjecucion';

export type OpcionesIA = { modo: 'rapido' | 'equilibrado' | 'maximo'; proveedores: ('anthropic' | 'openai')[]; proveedor: 'anthropic' | 'openai' };
type Resultado = { mensaje: string; texto: string; citas: Cita[]; limites: string[]; modelo: string };
const NOMBRE = { anthropic: 'Claude', openai: 'OpenAI' };

/** Caja de consulta con respuesta en streaming. Si se recarga la página durante una respuesta, la retoma con `reanudar`. */
export function ChatVivo({ solicitud, hilo, opciones, rapidas = [], reanudar = null, compacto = false, marcador, alTerminar }: {
  solicitud: string | null; hilo: string | null; opciones: OpcionesIA; rapidas?: string[]; reanudar?: string | null; compacto?: boolean; marcador?: string;
  alTerminar?: (r: { hilo: string; resultado: Resultado | null }) => void;
}) {
  const router = useRouter();
  const [texto, setTexto] = useState('');
  const [pregunta, setPregunta] = useState<string | null>(null);
  const [modo, setModo] = useState(opciones.modo);
  const [proveedor, setProveedor] = useState(opciones.proveedor);
  const [adjuntos, setAdjuntos] = useState<{ nombre: string; texto: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const hiloActual = useRef(hilo);
  const entrada = useRef<HTMLTextAreaElement>(null);
  const eje = useEjecucion(reanudar, (x: EstadoEjecucion, limpiar) => {
    if (x.estado === 'error') { setError(x.error ?? 'No se ha podido completar la consulta.'); return; }
    const r = (x.resultado ?? null) as Resultado | null;
    setPregunta(null);
    limpiar();
    if (alTerminar) alTerminar({ hilo: hiloActual.current!, resultado: r });
    else if (hiloActual.current && hiloActual.current !== hilo) router.replace(`?hilo=${hiloActual.current}`);
    else router.refresh();
  });

  async function enviar(t: string) {
    const q = t.trim();
    if (q.length < 3 || eje.ocupado) return;
    setError(null);
    setPregunta(q);
    try {
      const r = await fetch('/api/ia/chat/', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ solicitud, hilo: hiloActual.current, texto: q, modo, proveedor, adjuntos: adjuntos.length ? adjuntos : undefined }) });
      const j = await r.json().catch(() => ({})) as { ejecucion?: string; hilo?: string; error?: string };
      if (!r.ok || !j.ejecucion) { setError(j.error ?? 'No se ha podido enviar la consulta.'); setPregunta(null); return; }
      hiloActual.current = j.hilo ?? hiloActual.current;
      setTexto(''); setAdjuntos([]);
      eje.seguir(j.ejecucion);
    } catch { setError('Sin conexión con el servidor. Tu texto sigue aquí.'); setPregunta(null); }
  }

  async function adjuntar(f: File | undefined) {
    if (!f) return;
    setLeyendo(true); setError(null);
    const fd = new FormData(); fd.set('archivo', f);
    try {
      const r = await fetch('/api/ia/adjunto/', { method: 'POST', body: fd });
      const j = await r.json().catch(() => ({})) as { nombre?: string; texto?: string; error?: string };
      if (!r.ok || !j.texto) setError(j.error ?? 'No se ha podido leer el archivo.');
      else setAdjuntos((a) => [...a, { nombre: j.nombre ?? f.name, texto: j.texto! }].slice(0, 5));
    } catch { setError('No se ha podido subir el archivo.'); }
    setLeyendo(false);
  }

  return (
    <div className="grid gap-2">
      {pregunta || eje.ocupado ? (
        <ol className="cronologia" aria-live="polite">
          {pregunta ? <li className="burbuja burbuja-interna" data-ia="usuario"><p className="whitespace-pre-wrap">{pregunta}</p></li> : null}
          <li className="burbuja burbuja-documento" data-ia-vivo>
            <p className="meta" role="status"><span className="punto-vivo" aria-hidden="true" /> {eje.progreso ?? 'Preparando la consulta…'}</p>
            {eje.parcial ? <ConCitas texto={eje.parcial} citas={[]} /> : null}
          </li>
        </ol>
      ) : null}
      {!compacto && rapidas.length ? (
        <div className="flex flex-wrap gap-2">
          {rapidas.map((t) => <button key={t} type="button" className="chip chip-neutro" style={{ cursor: 'pointer', border: 0 }} disabled={eje.ocupado} onClick={() => void enviar(t)}>{t}</button>)}
        </div>
      ) : null}
      <form className="caja-compositor" onSubmit={(e) => { e.preventDefault(); void enviar(texto); }}>
        <label htmlFor={compacto ? 'ia-texto-panel' : 'ia-texto'} className="sr-only">Pregunta al asistente</label>
        <textarea id={compacto ? 'ia-texto-panel' : 'ia-texto'} ref={entrada} name="texto" rows={compacto ? 2 : 3} maxLength={8000} value={texto} onChange={(e) => setTexto(e.target.value)}
          placeholder={marcador ?? (solicitud ? 'Pregunta sobre este expediente…' : 'Pregunta a la biblioteca del despacho…')}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void enviar(texto); } }} />
        {adjuntos.length ? <ul className="flex flex-wrap gap-2 text-xs mb-1">{adjuntos.map((a, i) => (
          <li key={i} className="chip chip-neutro">{a.nombre} <button type="button" aria-label={`Quitar ${a.nombre}`} onClick={() => setAdjuntos((l) => l.filter((_, n) => n !== i))} style={{ background: 'none', border: 0, cursor: 'pointer' }}>×</button></li>
        ))}</ul> : null}
        <div className="fila">
          <span className="flex flex-wrap gap-2 items-center text-sm">
            <label className="flex gap-1 items-center">Calidad
              <select value={modo} onChange={(e) => setModo(e.target.value as OpcionesIA['modo'])} disabled={eje.ocupado} data-modo-ia>
                <option value="rapido">Rápido</option><option value="equilibrado">Equilibrado</option><option value="maximo">Máxima calidad</option>
              </select>
            </label>
            {opciones.proveedores.length > 1 ? (
              <label className="flex gap-1 items-center">Proveedor
                <select value={proveedor} onChange={(e) => setProveedor(e.target.value as OpcionesIA['proveedor'])} disabled={eje.ocupado} data-proveedor-ia>
                  {opciones.proveedores.map((p) => <option key={p} value={p}>{NOMBRE[p]}</option>)}
                </select>
              </label>
            ) : null}
            {!solicitud ? (
              <label className="btn-texto" style={{ cursor: 'pointer' }}>{leyendo ? 'Leyendo…' : 'Adjuntar PDF o Word'}
                <input type="file" accept=".pdf,.docx" className="sr-only" disabled={leyendo || eje.ocupado} onChange={(e) => { void adjuntar(e.target.files?.[0]); e.target.value = ''; }} />
              </label>
            ) : null}
          </span>
          <button className="btn btn-primario" style={{ minHeight: 38 }} disabled={eje.ocupado || leyendo || texto.trim().length < 3}>{eje.ocupado ? 'Trabajando…' : 'Preguntar'}</button>
        </div>
        {compacto ? null : <p className="ayuda text-xs mt-1">La IA solo propone: nada se envía, guarda ni publica sin que tú lo hagas. <kbd>Ctrl</kbd>+<kbd>Intro</kbd> para enviar.</p>}
      </form>
      {error ? <p className="error text-sm" role="alert">{error}</p> : null}
    </div>
  );
}
