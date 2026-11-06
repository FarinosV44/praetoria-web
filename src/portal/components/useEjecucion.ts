'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

export type EstadoEjecucion = { estado: 'inactivo' | 'en_curso' | 'listo' | 'error'; parcial: string; progreso: string | null; error: string | null; resultado: unknown };
const INICIAL: EstadoEjecucion = { estado: 'inactivo', parcial: '', progreso: null, error: null, resultado: null };

/** Sigue una ejecución del Copiloto: en directo si el servidor lo permite y, si no (proxy, recarga, corte), consultando su estado. */
export function useEjecucion(inicial: string | null = null, alTerminar?: (e: EstadoEjecucion, limpiar: () => void) => void) {
  const [id, setId] = useState<string | null>(inicial);
  const [e, setE] = useState<EstadoEjecucion>(inicial ? { ...INICIAL, estado: 'en_curso' } : INICIAL);
  const fin = useRef(alTerminar);
  useEffect(() => { fin.current = alTerminar; });
  const limpiar = useCallback(() => { setId(null); setE(INICIAL); }, []);

  useEffect(() => {
    if (!id) return;
    const corte = new AbortController();
    let vivo = true;
    const terminar = (x: EstadoEjecucion) => { if (!vivo) return; setE(x); fin.current?.(x, limpiar); };

    const consultar = async () => {
      while (vivo) {
        try {
          const r = await fetch(`/api/ia/ejecuciones/${id}/`, { signal: corte.signal, cache: 'no-store' });
          if (r.status === 404 || r.status === 401) return terminar({ ...INICIAL, estado: 'error', error: 'No se encuentra esta tarea.' });
          if (r.ok) {
            const j = await r.json() as { estado: EstadoEjecucion['estado']; parcial: string; progreso: string | null; error: string | null; resultado: unknown };
            const x: EstadoEjecucion = { estado: j.estado, parcial: j.parcial ?? '', progreso: j.progreso, error: j.error, resultado: j.resultado };
            if (j.estado !== 'en_curso') return terminar(x);
            if (vivo) setE(x);
          }
        } catch { if (!vivo) return; }
        await new Promise((res) => setTimeout(res, 2500));
      }
    };

    void (async () => {
      try {
        const r = await fetch(`/api/ia/ejecuciones/${id}/?flujo=1`, { signal: corte.signal, cache: 'no-store' });
        if (!r.ok || !r.body || !(r.headers.get('content-type') ?? '').includes('event-stream')) return consultar();
        const lector = r.body.pipeThrough(new TextDecoderStream()).getReader();
        let resto = '';
        for (;;) {
          const { value, done } = await lector.read();
          if (done) break;
          resto += value;
          const partes = resto.split('\n\n');
          resto = partes.pop() ?? '';
          for (const p of partes) {
            if (!p.startsWith('data: ')) continue;
            const ev = JSON.parse(p.slice(6)) as { t: string; d?: string; parcial?: string; progreso?: string | null; estado?: 'listo' | 'error'; error?: string; resultado?: unknown };
            if (ev.t === 'inicio') setE((a) => ({ ...a, estado: 'en_curso', parcial: ev.parcial ?? '', progreso: ev.progreso ?? null }));
            else if (ev.t === 'texto') setE((a) => ({ ...a, parcial: a.parcial + (ev.d ?? '') }));
            else if (ev.t === 'estado') setE((a) => ({ ...a, progreso: ev.d ?? null }));
            else if (ev.t === 'fin') { setE((a) => { const x = { ...a, estado: ev.estado!, error: ev.error ?? null, resultado: ev.resultado ?? null }; queueMicrotask(() => terminar(x)); return x; }); return; }
          }
        }
        return consultar(); // el flujo se cortó sin llegar al final: el trabajo sigue en el servidor
      } catch { if (vivo) return consultar(); }
    })();
    return () => { vivo = false; corte.abort(); };
  }, [id, limpiar]);

  const seguir = useCallback((nuevo: string) => { setE({ ...INICIAL, estado: 'en_curso' }); setId(nuevo); }, []);
  return { ...e, seguir, limpiar, ocupado: e.estado === 'en_curso' };
}
