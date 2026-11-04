import type { Metadata } from 'next';
import { FilaEmpleado, InvitarEmpleado } from '@/portal/components/Equipo';
import { comoUsuario } from '@/portal/lib/db';
import { ROLES } from '@/portal/lib/equipo';
import { requerirGlobal } from '@/portal/lib/sesion';

export const metadata: Metadata = { title: 'Equipo' };

export default async function Equipo() {
  const u = await requerirGlobal();
  const filas = await comoUsuario(u.id, async (tx) => (await tx.query(`
    select p.user_id id, p.nombre_visible nombre, u.email, p.rol::text rol, p.activo, coalesce(u."twoFactorEnabled", false) mfa,
      u."emailVerified" activada,
      (select count(*)::int from portal.solicitudes s where s.responsable_id = p.user_id and s.estado in ('enviada','en_revision','aceptada')) responsable,
      (select count(*)::int from portal.asignaciones a join portal.solicitudes s on s.id = a.solicitud_id where a.user_id = p.user_id and s.estado in ('enviada','en_revision','aceptada')) colabora,
      (select count(*)::int from portal.agenda_eventos g where g.propietario_id = p.user_id and g.estado = 'pendiente' and g.solicitud_id is not null) tareas
    from portal.personal p join identidad."user" u on u.id = p.user_id order by p.activo desc, p.nombre_visible`)).rows);
  return (
    <div className="grid gap-5">
      <h1 className="titulo">Equipo</h1>
      <section className="card"><h2 className="subtitulo">Invitar a una persona del despacho</h2><InvitarEmpleado /></section>
      <section className="card overflow-x-auto">
        <h2 className="subtitulo">Personas con acceso</h2>
        <p className="ayuda text-sm mb-2">La carga se cuenta con los asuntos abiertos y las tareas pendientes registradas; no hay otras estadísticas.</p>
        <table className="tabla">
          <thead><tr><th>Nombre</th><th>Rol</th><th>Acceso</th><th>Carga</th><th></th></tr></thead>
          <tbody>
            {filas.map((p) => (
              <tr key={p.id} data-empleado={p.email}>
                <td>{p.nombre}<br /><span className="ayuda">{p.email}</span></td>
                <td>{ROLES[p.rol] ?? p.rol}</td>
                <td className="text-sm">{!p.activo ? <span className="chip chip-aviso">Desactivado</span> : !p.activada ? <span className="chip chip-neutro">Invitación pendiente</span>
                  : p.mfa ? <span className="chip chip-ok">Activo · doble factor</span> : <span className="chip chip-aviso">Sin doble factor</span>}</td>
                <td className="text-sm">{p.responsable} como responsable · {p.colabora} colaborando · {p.tareas} tareas</td>
                <td><FilaEmpleado id={p.id} rol={p.rol} activo={p.activo} propio={p.id === u.id} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
