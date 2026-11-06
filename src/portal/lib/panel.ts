import 'server-only';
import type { Tx } from './db';

// Lo que necesita atención en la pantalla de inicio. Datos reales y bajo RLS: cada persona solo ve lo de sus asuntos.
export async function panelInicio(tx: Tx, uid: string) {
  const asunto = `coalesce((select e.titulo from portal.expedientes e where e.solicitud_id = g.solicitud_id), (select s.referencia from portal.solicitudes s where s.id = g.solicitud_id))`;
  const [vencidos, sinVerificar, borradores, actividad, propuestas, errores] = await Promise.all([
    tx.query(`select g.id, g.solicitud_id sid, g.titulo, g.inicio, ${asunto} asunto from portal.agenda_eventos g
      where g.tipo = 'plazo' and g.estado = 'pendiente' and g.inicio < now() and g.solicitud_id is not null order by g.inicio limit 10`),
    tx.query(`select g.id, g.solicitud_id sid, g.titulo, g.inicio, ${asunto} asunto from portal.agenda_eventos g
      where g.tipo = 'plazo' and g.estado = 'pendiente' and g.inicio >= now() and g.plazo_verificado_at is null and g.solicitud_id is not null order by g.inicio limit 8`),
    tx.query(`select e.id, e.solicitud_id sid, e.titulo, coalesce(x.titulo, s.referencia) asunto, (select max(v.version) from portal.escrito_versiones v where v.escrito_id = e.id) version
      from portal.escritos e join portal.solicitudes s on s.id = e.solicitud_id left join portal.expedientes x on x.solicitud_id = s.id order by e.updated_at desc limit 6`),
    tx.query(`select x.id, x.solicitud_id sid, x.tipo, x.estado, x.created_at at, coalesce(h.titulo, x.tipo) titulo from portal.ia_ejecuciones x left join portal.ia_hilos h on h.id = x.hilo_id
      where x.creado_por = $1 order by x.created_at desc limit 6`, [uid]),
    tx.query(`select count(*)::int n from portal.ia_propuestas where estado = 'pendiente'`),
    tx.query(`select count(*)::int n from portal.ia_indexacion where estado = 'error'`),
  ]);
  const TIPO: Record<string, string> = { chat: 'Consulta', redaccion: 'Redacción', edicion: 'Edición', analisis: 'Análisis de documento' };
  return {
    vencidos: vencidos.rows as { id: string; sid: string; titulo: string; inicio: Date; asunto: string }[],
    sinVerificar: sinVerificar.rows as { id: string; sid: string; titulo: string; inicio: Date; asunto: string }[],
    borradores: borradores.rows as { id: string; sid: string; titulo: string; asunto: string; version: number }[],
    actividad: actividad.rows.map((a) => ({ id: a.id as string, sid: a.sid as string | null, estado: a.estado as string, at: a.at as Date, texto: `${TIPO[a.tipo] ?? 'Tarea'}${a.titulo && a.titulo !== a.tipo ? `: ${String(a.titulo).slice(0, 60)}` : ''}` })),
    propuestas: propuestas.rows[0].n as number,
    errores: errores.rows[0].n as number,
  };
}
