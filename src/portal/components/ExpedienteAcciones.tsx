'use client';
import { useActionState, useState } from 'react';
import { compartirDocumento, completarTarea, estadoCliente, moverDocumento, type Resultado } from '@/app/(portal)/admin/expedientes/acciones';

/** Compartir un documento privado con el cliente: requiere un segundo clic de confirmación. */
export function Compartir({ documento, solicitud }: { documento: string; solicitud: string }) {
  const [seguro, setSeguro] = useState(false);
  const [estado, accion, pendiente] = useActionState<Resultado, FormData>(compartirDocumento, {});
  if (estado.ok) return <span className="chip chip-ok">Compartido</span>;
  return (
    <form action={accion} className="inline-flex gap-2 items-center">
      <input type="hidden" name="documento" value={documento} /><input type="hidden" name="solicitud" value={solicitud} />
      {seguro ? (
        <>
          <button key="confirmar" className="btn-texto" disabled={pendiente}>Confirmar: lo verá el cliente</button>
          <button type="button" className="btn-texto" style={{ color: 'var(--color-muted)' }} onClick={() => setSeguro(false)}>Cancelar</button>
        </>
      ) : <button key="compartir" type="button" className="btn-texto" onClick={() => setSeguro(true)}>Compartir con el cliente</button>}
      {estado.error ? <span className="text-xs" role="alert">{estado.error}</span> : null}
    </form>
  );
}

/** Cambiar de carpeta con un clic: el nombre de la carpeta se escribe en el mismo sitio. */
export function Carpeta({ documento, solicitud, carpeta, editable }: { documento: string; solicitud: string; carpeta: string; editable: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion] = useActionState<Resultado, FormData>(moverDocumento, {});
  if (!editable || !abierto) {
    return editable
      ? <button type="button" className="btn-texto" style={{ color: 'var(--color-muted)' }} onClick={() => setAbierto(true)} title="Cambiar de carpeta">📁 {estado.ok ? estado.ok.replace(/^Movido a «|»\.$/g, '') : carpeta}</button>
      : <span className="ayuda">📁 {carpeta}</span>;
  }
  return (
    <form action={accion} className="inline-flex gap-1 items-center" onSubmit={() => setAbierto(false)}>
      <input type="hidden" name="documento" value={documento} /><input type="hidden" name="solicitud" value={solicitud} />
      <input name="carpeta" defaultValue={carpeta} maxLength={80} list="carpetas-expediente" autoFocus aria-label="Carpeta" className="border rounded px-1 text-sm" />
      <button className="btn-texto">Mover</button>
    </form>
  );
}

export function EstadoCliente({ solicitud, actual }: { solicitud: string; actual: string | null }) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, pendiente] = useActionState<Resultado, FormData>(estadoCliente, {});
  const texto = estado.ok ? undefined : actual;
  if (!abierto) {
    return (
      <button type="button" className="btn-texto text-left" onClick={() => setAbierto(true)} style={{ color: 'var(--color-ink-2)' }}>
        <span className="ayuda">Estado visible para el cliente: </span>{estado.ok ? 'publicado ✓' : texto ?? <em>sin publicar</em>} ✎
      </button>
    );
  }
  return (
    <form action={accion} className="flex gap-2 items-center w-full" onSubmit={() => setAbierto(false)}>
      <input type="hidden" name="solicitud" value={solicitud} />
      <input name="texto" defaultValue={actual ?? ''} maxLength={600} autoFocus aria-label="Estado visible para el cliente"
        placeholder="Por ejemplo: Estamos preparando la demanda" className="border rounded-md p-2 flex-1 min-w-0" />
      <button className="btn btn-secundario" style={{ minHeight: 36 }} disabled={pendiente}>Publicar</button>
      {estado.error ? <span className="text-xs" role="alert">{estado.error}</span> : null}
    </form>
  );
}

export function Completar({ tarea, solicitud }: { tarea: string; solicitud: string }) {
  const [estado, accion] = useActionState<Resultado, FormData>(completarTarea, {});
  if (estado.ok) return <span className="chip chip-ok">Completada</span>;
  return (
    <form action={accion} className="inline">
      <input type="hidden" name="tarea" value={tarea} /><input type="hidden" name="solicitud" value={solicitud} />
      <button className="btn-texto">Marcar hecha</button>
      {estado.error ? <span className="text-xs" role="alert"> {estado.error}</span> : null}
    </form>
  );
}
