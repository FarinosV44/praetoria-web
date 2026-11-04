'use client';
import { useActionState, useState } from 'react';
import { compartirDocumento, completarTarea, equipoAsunto, estadoCliente, moverDocumento, reasignarTarea, reprogramarTarea, verificarPlazo, type Resultado } from '@/app/(portal)/admin/expedientes/acciones';

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

/** Completar con una línea de resultado o siguiente paso, que queda en la cronología. */
export function Completar({ tarea, solicitud }: { tarea: string; solicitud: string }) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, pendiente] = useActionState<Resultado, FormData>(completarTarea, {});
  if (estado.ok) return <span className="chip chip-ok">Completada</span>;
  if (!abierto) return <button key="abrir" type="button" className="btn-texto" onClick={() => setAbierto(true)}>Marcar hecha</button>;
  return (
    <form action={accion} className="flex gap-2 items-center w-full mt-1">
      <input type="hidden" name="tarea" value={tarea} /><input type="hidden" name="solicitud" value={solicitud} />
      <input name="resultado" maxLength={2000} autoFocus aria-label="Resultado o siguiente paso" placeholder="Resultado o siguiente paso (opcional)" className="border rounded px-2 py-1 text-sm flex-1 min-w-0" />
      <button key="hecha" className="btn-texto" disabled={pendiente}>Hecha</button>
      {estado.error ? <span className="text-xs" role="alert"> {estado.error}</span> : null}
    </form>
  );
}

export function Reasignar({ tarea, solicitud }: { tarea: string; solicitud: string }) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, pendiente] = useActionState<Resultado, FormData>(reasignarTarea, {});
  if (estado.ok) return <span className="chip chip-ok">Reasignada</span>;
  if (!abierto) return <button key="abrir" type="button" className="btn-texto" style={{ color: 'var(--color-muted)' }} onClick={() => setAbierto(true)}>Reasignar</button>;
  return (
    <form action={accion} className="inline-flex gap-1 items-center">
      <input type="hidden" name="tarea" value={tarea} /><input type="hidden" name="solicitud" value={solicitud} />
      <input name="para" list="personal-equipo" autoFocus aria-label="Reasignar a" placeholder="Nombre" className="border rounded px-1 text-sm" />
      <button key="ok" className="btn-texto" disabled={pendiente}>Encargar</button>
      {estado.error ? <span className="text-xs" role="alert"> {estado.error}</span> : null}
    </form>
  );
}

type Miembro = { id: string; nombre: string; papel: string };
/** Equipo del asunto en la cabecera: chips con el responsable y quien colabora; añadir se hace escribiendo el nombre. */
export function EquipoAsunto({ solicitud, miembros, gestiona }: { solicitud: string; miembros: Miembro[]; gestiona: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, pendiente] = useActionState<Resultado, FormData>(equipoAsunto, {});
  const boton = (m: Miembro, accionNombre: string, texto: string) => (
    <form action={accion} className="inline">
      <input type="hidden" name="solicitud" value={solicitud} /><input type="hidden" name="persona" value={m.id} /><input type="hidden" name="accion" value={accionNombre} />
      <button className="btn-texto text-xs" disabled={pendiente} title={`${texto}: ${m.nombre}`}>{texto}</button>
    </form>
  );
  return (
    <div className="flex flex-wrap gap-2 items-center text-sm" aria-label="Equipo del asunto">
      <span className="ayuda">Equipo:</span>
      {miembros.length === 0 ? <em className="ayuda">sin responsable</em> : null}
      {miembros.map((m) => (
        <span key={m.id} className={`chip ${m.papel === 'responsable' ? 'chip-info' : 'chip-neutro'} inline-flex gap-1 items-center`} data-miembro={m.nombre}>
          {m.nombre}{m.papel === 'responsable' ? ' · responsable' : m.papel === 'suplente' ? ' · suplente' : ''}
          {gestiona && m.papel !== 'responsable' ? <>{boton(m, 'responsable', 'Hacer responsable')}{boton(m, 'quitar', 'Quitar')}</> : null}
        </span>
      ))}
      {gestiona ? (abierto ? (
        <form action={accion} className="inline-flex gap-1 items-center" onSubmit={() => setAbierto(false)}>
          <input type="hidden" name="solicitud" value={solicitud} /><input type="hidden" name="accion" value="asignar" />
          <input name="nombre" list="personal-equipo" autoFocus aria-label="Añadir al asunto" placeholder="Nombre" className="border rounded px-1 text-sm" />
          <button key="anadir" className="btn-texto">Añadir</button>
        </form>
      ) : <button key="abrir" type="button" className="btn-texto" onClick={() => setAbierto(true)}>+ Persona</button>) : null}
      {estado.error ? <span className="text-xs" role="alert">{estado.error}</span> : null}
      {estado.ok ? <span className="text-xs" role="status">{estado.ok}</span> : null}
    </div>
  );
}

/** Verificar un plazo: dos pasos y una confirmación expresa del cómputo. */
export function VerificarPlazo({ tarea, solicitud }: { tarea: string; solicitud: string }) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, pendiente] = useActionState<Resultado, FormData>(verificarPlazo, {});
  if (estado.ok) return <span className="chip chip-ok">Verificado</span>;
  if (!abierto) return <button key="abrir" type="button" className="btn-texto" onClick={() => setAbierto(true)}>Verificar plazo</button>;
  return (
    <form action={accion} className="flex flex-wrap gap-2 items-center text-sm w-full mt-1">
      <input type="hidden" name="tarea" value={tarea} /><input type="hidden" name="solicitud" value={solicitud} />
      <label className="flex gap-1 items-center"><input type="checkbox" name="comprobado" value="1" required /> He comprobado el cómputo y la fecha es correcta</label>
      <button key="ok" className="btn-texto" disabled={pendiente}>Confirmar verificación</button>
      <button type="button" className="btn-texto" style={{ color: 'var(--color-muted)' }} onClick={() => setAbierto(false)}>Cancelar</button>
      {estado.error ? <span className="text-xs" role="alert">{estado.error}</span> : null}
    </form>
  );
}

export function Reprogramar({ tarea, solicitud, fecha }: { tarea: string; solicitud: string; fecha: string }) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, pendiente] = useActionState<Resultado, FormData>(reprogramarTarea, {});
  if (!abierto) return <button key="abrir" type="button" className="btn-texto" style={{ color: 'var(--color-muted)' }} onClick={() => setAbierto(true)}>Cambiar fecha</button>;
  return (
    <form action={accion} className="inline-flex flex-wrap gap-1 items-center" onSubmit={() => setAbierto(false)}>
      <input type="hidden" name="tarea" value={tarea} /><input type="hidden" name="solicitud" value={solicitud} />
      <input name="fecha" type="date" defaultValue={fecha} required aria-label="Nueva fecha" className="border rounded px-1 text-sm" />
      <input name="hora" type="time" aria-label="Nueva hora (opcional)" className="border rounded px-1 text-sm" />
      <button key="ok" className="btn-texto" disabled={pendiente}>Cambiar</button>
      {estado.error ? <span className="text-xs" role="alert">{estado.error}</span> : null}
    </form>
  );
}
