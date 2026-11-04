import type { Metadata } from 'next';
import Link from 'next/link';
import { comoUsuario } from '@/portal/lib/db';
import { requerirPersonal } from '@/portal/lib/sesion';
import { fechaHora, textoAntelacion, TIPO_ETIQUETA } from '@/portal/lib/agenda';
import { cambiarEstado, marcarLeidos, posponer } from '../agenda/acciones';

export const metadata: Metadata = { title: 'Avisos' };

// Bandeja de avisos: es el canal que siempre funciona, llegue o no la notificación al teléfono.
export default async function Avisos({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const u = await requerirPersonal();
  const q = await searchParams;
  const d = await comoUsuario(u.id, async (tx) => ({
    recibidos: (await tx.query(`select i.id, i.created_at, i.leido_at, a.id aviso_id, a.antelacion_min, a.canales, e.id evento_id, e.titulo, e.tipo, e.inicio, e.todo_el_dia, e.estado
      from portal.avisos_internos i join portal.agenda_avisos a on a.id = i.aviso_id join portal.agenda_eventos e on e.id = i.evento_id
      where i.user_id = $1 order by i.created_at desc limit 50`, [u.id])).rows,
    proximos: (await tx.query(`select a.disparo_at, a.antelacion_min, e.id evento_id, e.titulo from portal.agenda_avisos a join portal.agenda_eventos e on e.id = a.evento_id
      where a.user_id = $1 and a.estado = 'programado' order by a.disparo_at limit 15`, [u.id])).rows,
  }));
  const sinLeer = d.recibidos.filter((r) => !r.leido_at).length;
  return (
    <div className="grid gap-5">
      <div className="fila"><h1 className="titulo">Avisos</h1>
        {sinLeer ? <form action={marcarLeidos}><button className="btn btn-secundario" style={{ minHeight: 38 }}>Marcar todo como visto</button></form> : null}</div>
      {q.ok ? <p className="exito" role="status">{q.ok}</p> : null}
      {q.error ? <p className="error" role="alert">{q.error}</p> : null}
      <section className="card">
        <h2 className="subtitulo">Pendientes de atender ({sinLeer})</h2>
        {d.recibidos.length === 0 ? <p className="ayuda">Todavía no has recibido avisos.</p> : (
          <ul className="grid gap-3">
            {d.recibidos.map((r) => (
              <li key={r.id} className="grid gap-2" style={{ borderTop: '1px solid var(--color-line)', paddingTop: 10, opacity: r.leido_at ? 0.65 : 1 }} data-aviso={r.titulo}>
                <div>
                  <Link href={`/admin/agenda/${r.evento_id}/`} className="font-semibold">{r.titulo}</Link>
                  <p className="ayuda text-sm">{TIPO_ETIQUETA[r.tipo]} · {fechaHora(r.inicio, !r.todo_el_dia)} · aviso {r.antelacion_min ? textoAntelacion(r.antelacion_min) : 'a la hora'} · recibido {fechaHora(r.created_at)} ({r.canales})</p>
                </div>
                {!r.leido_at && r.estado === 'pendiente' ? (
                  <div className="flex flex-wrap gap-2">
                    {[[60, 'Posponer 1 h'], [1440, 'Posponer 1 día']].map(([m, t]) => (
                      <form key={m} action={posponer}><input type="hidden" name="aviso" value={r.aviso_id} /><input type="hidden" name="minutos" value={m} />
                        <button className="btn btn-secundario" style={{ minHeight: 36 }}>{t}</button></form>
                    ))}
                    <form action={cambiarEstado}><input type="hidden" name="id" value={r.evento_id} /><input type="hidden" name="estado" value="completado" />
                      <input type="hidden" name="destino" value="/admin/avisos/" /><button className="btn btn-secundario" style={{ minHeight: 36 }}>Completada</button></form>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="card">
        <h2 className="subtitulo">Próximos avisos programados</h2>
        {d.proximos.length === 0 ? <p className="ayuda">No hay avisos programados. <Link href="/admin/agenda/">Crea un evento</Link>.</p> : (
          <ul className="grid gap-1 text-sm">{d.proximos.map((a, i) => <li key={i}>{fechaHora(a.disparo_at)} · <Link href={`/admin/agenda/${a.evento_id}/`}>{a.titulo}</Link> ({a.antelacion_min ? textoAntelacion(a.antelacion_min) : 'a la hora'})</li>)}</ul>
        )}
        <p className="mt-3 text-sm"><Link href="/admin/app/">Activar los avisos en el móvil</Link></p>
      </section>
    </div>
  );
}
