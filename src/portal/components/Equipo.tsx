'use client';
import { useActionState, useState } from 'react';
import { cambiarEmpleado, invitarEmpleado, reinvitarEmpleado, type ResultadoEquipo } from '@/app/(portal)/admin/equipo/acciones';

const ROLES: [string, string][] = [['abogado', 'Abogado/a'], ['apoyo', 'Apoyo administrativo'], ['lectura', 'Lectura limitada'], ['facturacion', 'Facturación'], ['administrador', 'Superadministración']];

function Enlace({ r }: { r: ResultadoEquipo }) {
  if (!r.enlace) return null;
  return (
    <div className="grid gap-1 text-sm" role="status">
      <p>{r.ok} {r.correo === 'enviado' ? 'Le hemos enviado el enlace por correo.' : 'No se pudo enviar el correo: entrégale este enlace por un canal privado.'}</p>
      <input readOnly value={r.enlace} aria-label="Enlace de activación (un solo uso, 72 horas)" data-enlace-empleado className="control w-full font-mono text-xs" onFocus={(e) => e.target.select()} />
    </div>
  );
}

export function InvitarEmpleado() {
  const [r, accion, pendiente] = useActionState<ResultadoEquipo, FormData>(invitarEmpleado, {});
  return (
    <form action={accion} className="grid gap-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="grid gap-1"><span className="etiqueta">Nombre</span><input name="nombre" required minLength={2} maxLength={120} className="control" /></label>
        <label className="grid gap-1"><span className="etiqueta">Correo</span><input name="email" type="email" required className="control" /></label>
      </div>
      <fieldset className="flex flex-wrap gap-3 text-sm"><legend className="etiqueta mb-1">Rol</legend>
        {ROLES.map(([v, t], i) => <label key={v} className="flex gap-1 items-center"><input type="radio" name="rol" value={v} defaultChecked={i === 0} /> {t}</label>)}
      </fieldset>
      <p className="ayuda text-sm">Solo verá los asuntos que le asignes. Entrará con un enlace de un solo uso y tendrá que activar el doble factor.</p>
      <div><button className="btn btn-primario" disabled={pendiente}>Invitar</button></div>
      {r.error ? <p className="error text-sm" role="alert">{r.error}</p> : null}
      <Enlace r={r} />
    </form>
  );
}

export function FilaEmpleado({ id, rol, activo, propio }: { id: string; rol: string; activo: boolean; propio: boolean }) {
  const [r, accion, pendiente] = useActionState<ResultadoEquipo, FormData>(cambiarEmpleado, {});
  const [inv, invitar, pendienteInv] = useActionState<ResultadoEquipo, FormData>(reinvitarEmpleado, {});
  const [editar, setEditar] = useState(false);
  if (propio) return <span className="ayuda text-sm">Tu cuenta</span>;
  return (
    <div className="grid gap-1">
      <div className="flex flex-wrap gap-3 items-center text-sm">
        {editar ? (
          <form action={accion} className="flex flex-wrap gap-2 items-center">
            <input type="hidden" name="empleado" value={id} /><input type="hidden" name="activo" value="1" />
            {ROLES.map(([v, t]) => <label key={v} className="flex gap-1 items-center"><input type="radio" name="rol" value={v} defaultChecked={v === rol} /> {t}</label>)}
            <button key="guardar" className="btn-texto" disabled={pendiente}>Guardar</button>
          </form>
        ) : <button key="cambiar" type="button" className="btn-texto" onClick={() => setEditar(true)}>Cambiar rol</button>}
        <form action={accion}>
          <input type="hidden" name="empleado" value={id} /><input type="hidden" name="rol" value={rol} /><input type="hidden" name="activo" value={activo ? '0' : '1'} />
          <button className="btn-texto" disabled={pendiente}>{activo ? 'Desactivar acceso' : 'Reactivar'}</button>
        </form>
        {activo ? <form action={invitar}><input type="hidden" name="empleado" value={id} /><button className="btn-texto" disabled={pendienteInv}>Nueva invitación</button></form> : null}
      </div>
      {r.error ? <p className="error text-xs" role="alert">{r.error}</p> : r.ok ? <p className="text-xs" role="status">{r.ok}</p> : null}
      {inv.error ? <p className="error text-xs" role="alert">{inv.error}</p> : <Enlace r={inv} />}
    </div>
  );
}
