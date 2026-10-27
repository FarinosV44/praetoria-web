import type { Metadata } from 'next';
import Link from 'next/link';
import { ChipRequisito } from '@/components/ui';
import { comoUsuario } from '@/lib/db';
import { requerirCliente } from '@/lib/sesion';

export const metadata: Metadata = { title: 'Documentación pendiente' };

export default async function Pendiente() {
  const u = await requerirCliente();
  const filas = await comoUsuario(u.id, async (tx) => (await tx.query(`
    select r.id, r.titulo, r.explicacion, r.estado, r.obligatorio, r.comentario, s.id sid, s.referencia, e.id eid,
           coalesce(e.titulo, t.nombre) asunto
    from portal.requisitos r join portal.solicitudes s on s.id = r.solicitud_id
    left join portal.tipos_asunto t on t.id = s.tipo_asunto_id left join portal.expedientes e on e.solicitud_id = s.id
    where r.estado in ('pendiente', 'subsanacion') and s.estado in ('enviada', 'en_revision', 'aceptada')
    order by (r.estado = 'subsanacion') desc, r.obligatorio desc, s.enviada_at, r.orden`)).rows);
  return (
    <div className="grid gap-5">
      <h1 className="titulo">Documentación pendiente</h1>
      {filas.length === 0 ? <p className="card">No te falta ningún documento. Si necesitamos algo más, te avisaremos.</p> : (
        <ul className="lista">
          {filas.map((r) => (
            <li key={r.id} className="card">
              <div className="fila mb-1"><strong>{r.titulo}{r.obligatorio ? '' : ' (si lo tienes)'}</strong><ChipRequisito estado={r.estado} /></div>
              <p className="ayuda">{r.asunto} · {r.referencia}</p>
              {r.comentario ? <p className="error mt-2">{r.comentario}</p> : <p className="ayuda mt-1">{r.explicacion}</p>}
              <p className="mt-3"><Link className="btn btn-primario" href={`${r.eid ? `/expedientes/${r.eid}` : `/solicitudes/${r.sid}`}/#documentacion`}>Subir</Link></p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
