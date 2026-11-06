'use client';
import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { decidirPropuesta, guardarDatosProceso } from '@/app/(portal)/admin/expedientes/acciones';
import { reindexar } from '@/app/(portal)/admin/ia/acciones';
import { useEjecucion } from './useEjecucion';

type Res = { ok?: string; error?: string; n?: number };

/** Editar contrario, procedimiento, órgano y autos sin salir de la cabecera. */
export function DatosProceso({ solicitud, contraparte, procedimiento, organo, autos }: { solicitud: string; contraparte: string | null; procedimiento: string | null; organo: string | null; autos: string | null }) {
  const [r, accion, pendiente] = useActionState<Res, FormData>(guardarDatosProceso, {});
  return (
    <details className="text-xs mt-1" data-editar-proceso>
      <summary className="cursor-pointer">Editar datos del procedimiento</summary>
      <form action={accion} className="grid sm:grid-cols-2 gap-2 mt-2 text-sm">
        <input type="hidden" name="solicitud" value={solicitud} />
        <label className="grid gap-1">Contrario<input name="contraparte" defaultValue={contraparte ?? ''} maxLength={300} className="border rounded p-1" /></label>
        <label className="grid gap-1">Procedimiento (catálogo)<input name="procedimiento" defaultValue={procedimiento ?? ''} maxLength={160} className="border rounded p-1" /></label>
        <label className="grid gap-1">Órgano judicial<input name="organo" defaultValue={organo ?? ''} maxLength={200} className="border rounded p-1" /></label>
        <label className="grid gap-1">N.º de autos<input name="autos" defaultValue={autos ?? ''} maxLength={80} className="border rounded p-1" /></label>
        <p className="flex gap-2 items-center sm:col-span-2"><button className="btn btn-secundario" style={{ minHeight: 34 }} disabled={pendiente}>Guardar</button>
          {r.ok ? <span className="chip chip-ok" role="status">{r.ok}</span> : null}{r.error ? <span className="error" role="alert">{r.error}</span> : null}</p>
      </form>
    </details>
  );
}

/** Aceptar o descartar una propuesta. Es siempre una decisión expresa, con la fecha a la vista y editable. */
export function DecidirPropuesta({ propuesta, solicitud, fecha }: { propuesta: string; solicitud: string; fecha: string }) {
  const [r, accion, pendiente] = useActionState<Res, FormData>(decidirPropuesta, {});
  return (
    <form action={accion} className="flex flex-wrap gap-2 items-center mt-1 text-xs">
      <input type="hidden" name="propuesta" value={propuesta} /><input type="hidden" name="solicitud" value={solicitud} />
      <label className="flex gap-1 items-center">Fecha <input type="date" name="fecha" defaultValue={fecha} className="border rounded p-1" /></label>
      <button name="decision" value="aceptar" className="chip chip-ok" style={{ border: 0, cursor: 'pointer' }} disabled={pendiente}>Añadir a la agenda</button>
      <button name="decision" value="descartar" className="chip chip-neutro" style={{ border: 0, cursor: 'pointer' }} disabled={pendiente}>Descartar</button>
      {r.error ? <span className="error" role="alert">{r.error}</span> : null}
    </form>
  );
}

export function Reindexar({ tipo, origen, solicitud }: { tipo: 'documento' | 'biblioteca'; origen: string; solicitud?: string }) {
  const [r, accion, pendiente] = useActionState<Res, FormData>(reindexar, {});
  return (
    <form action={accion} className="inline">
      <input type="hidden" name="tipo" value={tipo} /><input type="hidden" name="origen" value={origen} /><input type="hidden" name="solicitud" value={solicitud ?? ''} />
      <button className="btn-texto" disabled={pendiente}>Reprocesar</button>
      {r.ok ? <span role="status"> {r.ok}</span> : null}{r.error ? <span role="alert"> {r.error}</span> : null}
    </form>
  );
}

/** Lanza el análisis con IA de un documento y lo recoge al terminar, también si la página se ha recargado. */
export function AnalizarDocumento({ documento, ya }: { documento: string; ya: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const eje = useEjecucion(null, (x, limpiar) => { if (x.estado === 'error') setError(x.error ?? 'No se ha podido analizar.'); else router.refresh(); limpiar(); });
  async function lanzar() {
    setError(null);
    try {
      const r = await fetch('/api/ia/analizar/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ documento }) });
      const j = await r.json().catch(() => ({})) as { ejecucion?: string; error?: string };
      if (!r.ok || !j.ejecucion) setError(j.error ?? 'No se ha podido iniciar el análisis.'); else eje.seguir(j.ejecucion);
    } catch { setError('Sin conexión con el servidor.'); }
  }
  if (eje.ocupado) return <span className="ayuda" role="status"><span className="punto-vivo" aria-hidden="true" /> {eje.progreso ?? 'Analizando…'}</span>;
  return <><button type="button" className="btn-texto" onClick={() => void lanzar()} data-analizar>{ya ? 'Volver a analizar' : 'Analizar con IA'}</button>{error ? <span className="error" role="alert">{error}</span> : null}</>;
}
