import type { Metadata } from 'next';
import Link from 'next/link';
import { comoUsuario } from '@/lib/db';
import { requerirCliente } from '@/lib/sesion';
import { fecha } from '@/lib/textos';

export const metadata: Metadata = { title: 'Mensajes' };

export default async function MensajesPagina() {
  const u = await requerirCliente();
  const hilos = await comoUsuario(u.id, async (tx) => (await tx.query(`
    select s.id, s.referencia, e.id eid, coalesce(e.titulo, t.nombre) asunto,
      (select m.texto from portal.mensajes m where m.solicitud_id = s.id order by m.created_at desc limit 1) ultimo,
      (select max(m.created_at) from portal.mensajes m where m.solicitud_id = s.id) cuando
    from portal.solicitudes s left join portal.tipos_asunto t on t.id = s.tipo_asunto_id left join portal.expedientes e on e.solicitud_id = s.id
    where s.estado <> 'borrador' order by cuando desc nulls last, s.enviada_at desc`)).rows);
  return (
    <div className="grid gap-5">
      <h1 className="titulo">Mensajes</h1>
      <p className="ayuda">Los mensajes van siempre dentro de cada solicitud o expediente, para que nada se mezcle.</p>
      {hilos.length === 0 ? <p className="card">Cuando envíes una solicitud, podrás escribir al despacho desde aquí.</p> : (
        <ul className="lista">
          {hilos.map((h) => (
            <li key={h.id} className="card">
              <Link className="font-semibold" href={`${h.eid ? `/expedientes/${h.eid}` : `/solicitudes/${h.id}`}/#mensajes`}>{h.asunto}</Link>
              <p className="ayuda">{h.referencia}{h.cuando ? ` · último mensaje ${fecha(h.cuando)}` : ' · sin mensajes'}</p>
              {h.ultimo ? <p className="mt-1 line-clamp-2">{h.ultimo}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
