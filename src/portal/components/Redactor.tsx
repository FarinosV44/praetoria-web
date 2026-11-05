'use client';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { estadoRedaccion, iniciarRedaccion, proponerModelos, type Propuesta } from '@/app/(portal)/admin/expedientes/[id]/asistente/redaccion';
import type { ModeloCandidato } from '@/portal/lib/redactor';

const CLASE: Record<string, string> = { maestro: 'Maestro', historico_anonimizado: 'Histórico anonimizado', clausula: 'Cláusula' };
export type EscritoActual = { id: string; titulo: string; version: number; modelos: { version_id: string; titulo: string; etiqueta: string }[] };
export type EscritoHilo = EscritoActual & { hilo: string };

/** Redactar un escrito con modelos aprobados de la biblioteca (#94): proponer, elegir, redactar e iterar.
 *  En el asistente trabaja sobre la conversación abierta; dentro del expediente (#78) se elige «nuevo» o un borrador
 *  existente y el resultado aparece en la cronología, sin cambiar de pantalla. */
export function Redactor({ solicitud, hilo: hiloFijo, escrito: escritoFijo, inicial = '', escritos, enExpediente = false, inicialSobre = null }: {
  solicitud: string; hilo: string | null; escrito: EscritoActual | null; inicial?: string; escritos?: EscritoHilo[]; enExpediente?: boolean; inicialSobre?: string | null;
}) {
  const router = useRouter();
  const [sobre, setSobre] = useState(escritoFijo?.id ?? (inicialSobre && escritos?.some((e) => e.id === inicialSobre) ? inicialSobre : ''));
  const elegido = escritos ? escritos.find((e) => e.id === sobre) ?? null : null;
  const escrito: EscritoActual | null = escritos ? elegido : escritoFijo;
  const hilo = escritos ? elegido?.hilo ?? null : hiloFijo;
  const [hecho, setHecho] = useState<string | null>(null);
  const [instruccion, setInstruccion] = useState(inicial);
  const [titulo, setTitulo] = useState('');
  const [propuesta, setPropuesta] = useState<Propuesta | null>(null);
  const [seleccion, setSeleccion] = useState<string[]>(() => escrito?.modelos.map((m) => m.version_id) ?? []);
  const [filtro, setFiltro] = useState('');
  const [trabajo, setTrabajo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [buscando, empezar] = useTransition();
  const [segundos, setSegundos] = useState(0);

  // Consulta el estado de la redacción en curso cada 4 s.
  useEffect(() => {
    if (!trabajo) return;
    const inicio = Date.now();
    const t = setInterval(async () => {
      setSegundos(Math.round((Date.now() - inicio) / 1000));
      const r = await estadoRedaccion(trabajo).catch(() => null);
      if (!r || r.estado === 'en_curso') return;
      clearInterval(t);
      setTrabajo(null);
      if (r.estado === 'listo') {
        setInstruccion(''); setPropuesta(null);
        if (enExpediente) { setHecho(`Guardada la versión ${r.version} del borrador en la cronología.`); if (r.escrito) setSobre(r.escrito); router.refresh(); }
        else { router.replace(`?hilo=${r.hilo}&modo=redactar`); router.refresh(); }
      }
      else setError(r.error ?? 'No se ha podido redactar.');
    }, 4000);
    return () => clearInterval(t);
  }, [trabajo, router, enExpediente]);

  const modelos = useMemo(() => {
    const todos = propuesta?.modelos ?? [];
    const f = filtro.trim().toLowerCase();
    return f ? todos.filter((m) => `${m.titulo} ${m.procedimiento ?? ''} ${m.materia ?? ''} ${m.variante ?? ''}`.toLowerCase().includes(f)) : todos;
  }, [propuesta, filtro]);
  const etiqueta = (vid: string) => { const i = seleccion.indexOf(vid); return i >= 0 ? `B${i + 1}` : null; };
  const conmutar = (vid: string) => setSeleccion((s) => (s.includes(vid) ? s.filter((x) => x !== vid) : s.length >= 5 ? s : [...s, vid]));

  const buscar = () => empezar(async () => {
    setError(null);
    const r = await proponerModelos(solicitud, instruccion);
    if (r.error) { setError(r.error); return; }
    setPropuesta(r);
    if (!escrito) {
      setSeleccion((r.modelos ?? []).filter((m) => m.recomendado).map((m) => m.version_id));
      if (!titulo) setTitulo(r.procedimiento?.nombre ?? instruccion.slice(0, 80));
    }
  });
  const redactarYa = () => empezar(async () => {
    setError(null); setHecho(null);
    const r = await iniciarRedaccion({ sid: solicitud, hilo, instruccion, versiones: seleccion, titulo, procedimiento: propuesta?.procedimiento?.id ?? null });
    if (r.error) { setError(r.error); return; }
    setSegundos(0);
    setTrabajo(r.trabajo!);
  });
  const ocupado = buscando || !!trabajo;

  return (
    <div className="grid gap-3" data-redactor>
      {escritos && escritos.length ? (
        <label className="text-sm flex flex-wrap gap-2 items-center">Sobre
          <select value={sobre} disabled={ocupado} data-sobre onChange={(e) => {
            const id = e.target.value; setSobre(id); setPropuesta(null);
            setSeleccion(escritos.find((x) => x.id === id)?.modelos.map((m) => m.version_id) ?? []);
          }}>
            <option value="">Un escrito nuevo</option>
            {escritos.map((e) => <option key={e.id} value={e.id}>«{e.titulo}» · v{e.version}</option>)}
          </select>
        </label>
      ) : null}
      {escrito ? (
        <p className="aviso text-sm" data-escrito-actual>
          Trabajando sobre <a href={`/admin/expedientes/${solicitud}/escritos/${escrito.id}/`}><strong>«{escrito.titulo}»</strong> · versión {escrito.version}</a>.
          Cada instrucción crea una versión nueva; las anteriores se conservan.
        </p>
      ) : null}
      <div className="caja-compositor">
        <label htmlFor="red-texto" className="sr-only">Qué escrito necesitas</label>
        <textarea id="red-texto" rows={3} maxLength={8000} value={instruccion} onChange={(e) => setInstruccion(e.target.value)} disabled={ocupado}
          placeholder={escrito ? 'Ej.: usa el modelo B2 para el suplico; añade el hecho de la carta del 3 de marzo; suprime el tercer fundamento…' : 'Ej.: prepara la demanda de divorcio contencioso con nuestras plantillas'} />
        <div className="fila">
          <span className="ayuda text-xs">Solo modelos aprobados de la biblioteca y lo que consta en este expediente. Resultado: borrador para revisar.</span>
          <span className="flex gap-2">
            <button type="button" className="btn btn-secundario" style={{ minHeight: 38 }} disabled={ocupado || instruccion.trim().length < 3} onClick={buscar}>
              {buscando && !trabajo ? 'Buscando…' : escrito ? 'Cambiar modelos' : 'Buscar modelos'}
            </button>
            {propuesta || escrito ? (
              <button type="button" className="btn btn-primario" style={{ minHeight: 38 }} disabled={ocupado || instruccion.trim().length < 3} onClick={redactarYa}>
                {escrito ? 'Crear versión nueva' : 'Redactar borrador'}
              </button>
            ) : null}
          </span>
        </div>
      </div>

      {propuesta ? (
        <section className="border rounded p-3 grid gap-2" aria-label="Modelos de la biblioteca" data-propuesta>
          <p className="text-sm">
            {propuesta.procedimiento ? <>Procedimiento identificado: <strong data-procedimiento>{propuesta.procedimiento.nombre}</strong>. </> : <>No se ha identificado un procedimiento concreto. </>}
            {seleccion.length ? `${seleccion.length} modelo${seleccion.length > 1 ? 's' : ''} elegido${seleccion.length > 1 ? 's' : ''} (máximo 5).` : 'Ningún modelo elegido: se redactará solo con el expediente.'}
          </p>
          {!escrito ? (
            <label className="text-sm grid gap-1">Título del borrador
              <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={200} disabled={ocupado} />
            </label>
          ) : null}
          {(propuesta.modelos ?? []).length > 6 ? (
            <label className="text-sm grid gap-1">Filtrar modelos<input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="título, procedimiento, variante…" /></label>
          ) : null}
          {(propuesta.modelos ?? []).length === 0 ? <p className="ayuda text-sm">No hay modelos aprobados que puedas usar. Se redactará solo con lo que consta en el expediente.</p> : null}
          <ul className="grid gap-2">
            {modelos.map((m: ModeloCandidato) => {
              const e = etiqueta(m.version_id);
              return (
                <li key={m.version_id} className="border rounded p-2 text-sm" data-modelo={m.titulo}>
                  <label className="flex gap-2 items-start">
                    <input type="checkbox" checked={!!e} onChange={() => conmutar(m.version_id)} disabled={ocupado || (!e && seleccion.length >= 5)} aria-label={`Usar «${m.titulo}»`} />
                    <span className="grid gap-1">
                      <span>{e ? <strong className="chip chip-info">{e}</strong> : null} <strong>{m.titulo}</strong> · v{m.version} {m.recomendado ? <span className="chip chip-ok">Recomendado</span> : null}</span>
                      <span className="ayuda">{CLASE[m.clase] ?? m.clase}{m.procedimiento ? ` · ${m.procedimiento}` : m.materia ? ` · ${m.materia}` : ''}{m.variante ? ` · variante: ${m.variante}` : ''}{m.posicion ? ` · posición: ${m.posicion}` : ''}</span>
                      {m.motivos.length ? <span className="ayuda">Por qué: {m.motivos.join('; ')}</span> : null}
                      {m.vigencia ? <span className="text-xs">⚠️ {m.vigencia}</span> : null}
                      <a href={`/admin/biblioteca/${m.modelo_id}/`} target="_blank" rel="noopener" className="text-xs">Ver el modelo</a>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {trabajo ? <p className="evento-linea" role="status" data-redactando>Redactando el borrador con {seleccion.length} modelo{seleccion.length === 1 ? '' : 's'}… {segundos} s (suele tardar entre 1 y 4 minutos). Puedes seguir en otra pestaña.</p> : null}
      {error ? <p className="error text-sm" role="alert">{error}</p> : null}
      {hecho ? <p className="exito text-sm" role="status" data-hecho>{hecho}</p> : null}
    </div>
  );
}
