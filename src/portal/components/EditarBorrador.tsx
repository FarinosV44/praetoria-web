'use client';
import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { guardarVersion, type ResultadoEscrito } from '@/app/(portal)/admin/expedientes/[id]/escritos/[escrito]/acciones';

/** Edición a mano del borrador: guardar crea una versión nueva (nunca sobrescribe). */
export function EditarBorrador({ solicitud, escrito, base, texto }: { solicitud: string; escrito: string; base: number; texto: string }) {
  const router = useRouter();
  const [r, accion, pendiente] = useActionState<ResultadoEscrito, FormData>(guardarVersion, {});
  useEffect(() => { if (r.version) router.replace(`?v=${r.version}`); }, [r.version, r.n, router]);
  return (
    <form action={accion} className="grid gap-2">
      <input type="hidden" name="solicitud" value={solicitud} /><input type="hidden" name="escrito" value={escrito} /><input type="hidden" name="base" value={base} />
      <label htmlFor="borrador-texto" className="text-sm">Texto del borrador (versión {base})</label>
      <textarea id="borrador-texto" name="texto" rows={24} defaultValue={texto} maxLength={200000} className="font-mono text-sm" />
      <p className="flex gap-3 items-center">
        <button className="btn btn-primario" disabled={pendiente}>{pendiente ? 'Guardando…' : 'Guardar como versión nueva'}</button>
        <span className="ayuda text-xs">La versión {base} se conserva tal cual.</span>
      </p>
      {r.error ? <p className="error text-sm" role="alert">{r.error}</p> : null}
      {r.ok ? <p className="chip chip-ok" role="status">{r.ok}</p> : null}
    </form>
  );
}
