import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FormEvento } from '@/components/FormEvento';
import { comoUsuario } from '@/lib/db';
import { UUID } from '@/lib/datos';
import { requerirPersonal } from '@/lib/sesion';
import { fechaHora, partesMadrid, textoAntelacion } from '@/lib/agenda';
import { cambiarEstado, editarEvento } from '../acciones';

export const metadata: Metadata = { title: 'Evento' };

export default async function Evento({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const u = await requerirPersonal();
  const { id } = await params;
  const q = await searchParams;
  if (!UUID.test(id)) notFound();
  const d = await comoUsuario(u.id, async (tx) => {
    const e = (await tx.query('select * from portal.agenda_eventos where id = $1', [id])).rows[0];
    if (!e) return null;
    return {
      e,
      avisos: (await tx.query(`select a.*, (select string_agg(p.resultado || coalesce(' (' || p.http_status || ')', ''), ', ') from portal.entregas_push p where p.aviso_id = a.id) entregas
        from portal.agenda_avisos a where a.evento_id = $1 and a.estado <> 'cancelado' order by a.disparo_at limit 60`, [id])).rows,
      asuntos: (await tx.query(`select s.id, coalesce(x.referencia || ' · ' || x.titulo, s.referencia) texto from portal.solicitudes s
        left join portal.expedientes x on x.solicitud_id = s.id where s.estado in ('enviada', 'en_revision', 'aceptada') or s.id = $1 order by 2`, [e.solicitud_id])).rows,
    };
  });
  if (!d) notFound();
  const { e } = d;
  const p = partesMadrid(e.inicio);
  return (
    <div className="grid gap-5 max-w-3xl">
      <p><Link href="/despacho/agenda/">← Agenda</Link></p>
      {q.ok ? <p className="exito" role="status">{q.ok}</p> : null}
      {q.error ? <p className="error" role="alert">{q.error}</p> : null}
      <div className="fila"><h1 className="titulo">{e.titulo}</h1>
        {e.estado === 'pendiente' ? (
          <div className="flex gap-2">
            {['completado', 'cancelado'].map((s) => (
              <form key={s} action={cambiarEstado}>
                <input type="hidden" name="id" value={id} /><input type="hidden" name="estado" value={s} /><input type="hidden" name="destino" value={`/despacho/agenda/${id}/`} />
                <button className="btn btn-secundario" style={{ minHeight: 38 }}>{s === 'completado' ? 'Marcar completada' : 'Cancelar evento'}</button>
              </form>
            ))}
          </div>
        ) : (
          <form action={cambiarEstado}><input type="hidden" name="id" value={id} /><input type="hidden" name="estado" value="pendiente" /><input type="hidden" name="destino" value={`/despacho/agenda/${id}/`} />
            <button className="btn btn-secundario" style={{ minHeight: 38 }}>Reabrir</button></form>
        )}
      </div>
      <section className="card">
        <h2 className="subtitulo">Avisos</h2>
        {d.avisos.length === 0 ? <p className="ayuda">No hay avisos programados.</p> : (
          <ul className="grid gap-1 text-sm">
            {d.avisos.map((a) => (
              <li key={a.id}>{fechaHora(a.disparo_at)} · {a.antelacion_min ? textoAntelacion(a.antelacion_min) : 'a la hora'} ·{' '}
                <strong>{a.estado === 'programado' ? 'Programado' : a.estado === 'enviado' ? `Enviado (${a.canales})` : 'Error'}</strong>
                {a.entregas ? <span className="ayuda"> · {a.entregas}</span> : null}</li>
            ))}
          </ul>
        )}
      </section>
      <section className="card">
        <h2 className="subtitulo">Editar</h2>
        <FormEvento accion={editarEvento} asuntos={d.asuntos} boton="Guardar cambios" e={{
          id, titulo: e.titulo, tipo: e.tipo, fecha: p.fecha, hora: p.hora, todo_el_dia: e.todo_el_dia, duracion_min: e.duracion_min, repeticion: e.repeticion,
          repetir_hasta: e.repetir_hasta ? partesMadrid(e.repetir_hasta).fecha : '', prioridad: e.prioridad, nota: e.nota, solicitud_id: e.solicitud_id,
          avisos_min: e.avisos_min, plazo_fuente: e.plazo_fuente, plazo_verificado: !!e.plazo_verificado_at,
        }} />
      </section>
    </div>
  );
}
