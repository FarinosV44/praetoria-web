'use client';
import { useActionState, useEffect, useRef } from 'react';
import { fecha } from '@/lib/textos';

type M = { id: string; texto: string; del_despacho: boolean; created_at: string | Date; autor: string };
export function Mensajes({ mensajes, solicitudId, accion, propio }: {
  mensajes: M[]; solicitudId: string; propio: 'cliente' | 'despacho';
  accion: (s: { error?: string; ok?: number }, f: FormData) => Promise<{ error?: string; ok?: number }>;
}) {
  const [estado, enviar, pendiente] = useActionState(accion, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (estado.ok) ref.current?.reset(); }, [estado.ok]);
  return (
    <div>
      {mensajes.length === 0 ? <p className="ayuda mb-3">Todavía no hay mensajes.</p> : (
        <ul className="grid gap-2 mb-4">
          {mensajes.map((m) => {
            const mio = (propio === 'despacho') === m.del_despacho;
            return (
              <li key={m.id} className="rounded-lg p-3 max-w-[85%]" style={{ background: mio ? 'var(--color-ink)' : 'var(--color-stone)', color: mio ? '#fff' : undefined, marginLeft: mio ? 'auto' : undefined }}>
                <p className="text-xs opacity-80 mb-1">{m.autor} · {fecha(m.created_at)}</p>
                <p className="whitespace-pre-wrap">{m.texto}</p>
              </li>
            );
          })}
        </ul>
      )}
      <form action={enviar} ref={ref}>
        <input type="hidden" name="solicitud" value={solicitudId} />
        {estado.error ? <p className="error mb-2" role="alert">{estado.error}</p> : null}
        <div className="campo">
          <label htmlFor={`msg-${solicitudId}`}>Escribe un mensaje</label>
          <textarea id={`msg-${solicitudId}`} name="texto" required maxLength={4000} rows={3} />
        </div>
        <button className="btn btn-secundario" disabled={pendiente}>{pendiente ? 'Enviando…' : 'Enviar mensaje'}</button>
      </form>
    </div>
  );
}
