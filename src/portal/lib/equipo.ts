import 'server-only';
import type { Tx } from './db';

// Equipo, relevo y «Mi trabajo» (#81). Siempre dentro de comoUsuario(): la RLS ya limita cada consulta
// a los asuntos que la persona tiene asignados, así que aquí no hay filtros de permisos que olvidar.

export const ROLES: Record<string, string> = {
  administrador: 'Superadministración', abogado: 'Abogado/a', apoyo: 'Apoyo administrativo', facturacion: 'Facturación', lectura: 'Lectura limitada',
};

export type Miembro = { id: string; nombre: string; papel: 'responsable' | 'colaborador' | 'suplente' };

export async function equipoAsunto(tx: Tx, sid: string): Promise<{ miembros: Miembro[]; gestiona: boolean }> {
  const r = await tx.query(`
    select p.user_id id, p.nombre_visible nombre, 'responsable' papel from portal.solicitudes s join portal.personal p on p.user_id = s.responsable_id where s.id = $1
    union all
    select p.user_id, p.nombre_visible, a.papel from portal.asignaciones a join portal.personal p on p.user_id = a.user_id where a.solicitud_id = $1 and p.activo
    order by 3 desc, 2`, [sid]);
  const g = await tx.query('select portal.puede_gestionar_asunto($1) g', [sid]);
  return { miembros: r.rows, gestiona: !!g.rows[0].g };
}

/** Personal activo al que se puede encargar trabajo (para sugerencias al escribir un nombre). */
export async function personalActivo(tx: Tx): Promise<{ id: string; nombre: string }[]> {
  return (await tx.query(`select user_id id, nombre_visible nombre from portal.personal where activo and rol::text in ('administrador', 'abogado', 'apoyo') order by 2`)).rows;
}

export type Relevo = {
  ultimo: { at: Date; texto: string } | null;
  estado_visible: string | null;
  faltan: string[];
  por_revisar: number;
  tareas: { titulo: string; inicio: Date; responsable: string; vencida: boolean }[];
  plazos: { titulo: string; inicio: Date; verificado: boolean }[];
  sin_responder: { at: Date; texto: string } | null;
  ultima_nota: { at: Date; autor: string; texto: string } | null;
};

/** «Continuar este asunto»: solo datos registrados en el expediente, nada inferido ni inventado. */
export async function relevo(tx: Tx, sid: string): Promise<Relevo> {
  const q = async (sql: string) => (await tx.query(sql, [sid])).rows;
  const [ultimo] = await q(`select at, texto from (
      select n.created_at at, 'Nota interna: ' || left(n.texto, 140) texto from portal.notas_internas n where n.solicitud_id = $1
      union all select m.created_at, case when m.del_despacho then 'Mensaje al cliente: ' else 'Mensaje del cliente: ' end || left(m.texto, 140) from portal.mensajes m where m.solicitud_id = $1
      union all select d.subido_at, 'Documento: ' || d.nombre_original from portal.documentos d where d.solicitud_id = $1
    ) x order by at desc limit 1`);
  const [s] = await q(`select coalesce(e.estado_visible, s.estado_visible) estado_visible,
      (select count(*)::int from portal.documentos d where d.solicitud_id = s.id and d.estado = 'pendiente') por_revisar
    from portal.solicitudes s left join portal.expedientes e on e.solicitud_id = s.id where s.id = $1`);
  const faltan = (await q(`select titulo from portal.requisitos where solicitud_id = $1 and obligatorio and estado in ('pendiente', 'subsanacion') order by titulo`)).map((r) => r.titulo as string);
  const tareas = (await q(`select e.titulo, e.inicio, p.nombre_visible responsable, e.inicio < now() vencida from portal.agenda_eventos e
      join portal.personal p on p.user_id = e.propietario_id where e.solicitud_id = $1 and e.estado = 'pendiente' and e.tipo <> 'plazo' order by e.inicio limit 10`)) as Relevo['tareas'];
  const plazos = (await q(`select titulo, inicio, plazo_verificado_at is not null verificado from portal.agenda_eventos
      where solicitud_id = $1 and estado = 'pendiente' and tipo = 'plazo' order by inicio limit 10`)) as Relevo['plazos'];
  // Último mensaje del cliente que el despacho aún no ha contestado
  const [sinResp] = await q(`select m.created_at at, left(m.texto, 160) texto from portal.mensajes m where m.solicitud_id = $1 and not m.del_despacho
      and not exists (select 1 from portal.mensajes r where r.solicitud_id = m.solicitud_id and r.del_despacho and r.created_at > m.created_at)
    order by m.created_at desc limit 1`);
  const [nota] = await q(`select n.created_at at, p.nombre_visible autor, left(n.texto, 300) texto from portal.notas_internas n
      join portal.personal p on p.user_id = n.autor_id where n.solicitud_id = $1 order by n.created_at desc limit 1`);
  return { ultimo: ultimo ?? null, estado_visible: s?.estado_visible ?? null, faltan, por_revisar: s?.por_revisar ?? 0, tareas, plazos,
    sin_responder: sinResp ?? null, ultima_nota: nota ?? null };
}

export type MiTrabajo = {
  asuntos: { id: string; cliente: string; titulo: string; papel: string; ultimo: Date | null }[];
  hoy: { id: string; sid: string | null; titulo: string; inicio: Date; tipo: string; vencida: boolean; asunto: string | null }[];
  proximas: { id: string; sid: string | null; titulo: string; inicio: Date; tipo: string; verificado: boolean; asunto: string | null }[];
  por_revisar: { sid: string; asunto: string; n: number }[];
  sin_responder: { sid: string; asunto: string; at: Date }[];
  sin_responsable: { sid: string; asunto: string; estado: string }[];
  movimientos: { sid: string; asunto: string; at: Date; texto: string }[];
};

const ASUNTO = `coalesce(e.titulo, t.nombre, s.referencia) || ' · ' || u.name`;
const DESDE = `from portal.solicitudes s join identidad."user" u on u.id = s.cliente_id left join portal.expedientes e on e.solicitud_id = s.id
  left join portal.tipos_asunto t on t.id = s.tipo_asunto_id`;

/** Panel «Mi trabajo»: lo que me toca a mí (responsable, asignado o tareas a mi nombre). */
export async function miTrabajo(tx: Tx, uid: string): Promise<MiTrabajo> {
  const q = async (sql: string, p: unknown[] = [uid]) => (await tx.query(sql, p)).rows;
  const mios = `(s.responsable_id = $1 or exists (select 1 from portal.asignaciones a where a.solicitud_id = s.id and a.user_id = $1))`;
  const asuntos = await q(`select s.id, u.name cliente, coalesce(e.titulo, t.nombre, s.referencia) titulo,
      case when s.responsable_id = $1 then 'responsable' else (select papel from portal.asignaciones a where a.solicitud_id = s.id and a.user_id = $1) end papel,
      greatest((select max(created_at) from portal.notas_internas where solicitud_id = s.id), (select max(created_at) from portal.mensajes where solicitud_id = s.id),
               (select max(subido_at) from portal.documentos where solicitud_id = s.id)) ultimo
    ${DESDE} where ${mios} and s.estado in ('enviada', 'en_revision', 'aceptada') order by ultimo desc nulls last limit 50`);
  const tareas = `from portal.agenda_eventos g left join portal.solicitudes s on s.id = g.solicitud_id left join identidad."user" u on u.id = s.cliente_id
    left join portal.expedientes e on e.solicitud_id = s.id left join portal.tipos_asunto t on t.id = s.tipo_asunto_id
    where (g.propietario_id = $1 or g.suplente_id = $1) and g.estado = 'pendiente'`;
  const hoy = await q(`select g.id, g.solicitud_id sid, g.titulo, g.inicio, g.tipo::text tipo, g.inicio < now() vencida, case when s.id is null then null else ${ASUNTO} end asunto
    ${tareas} and g.inicio < (date_trunc('day', now() at time zone 'Europe/Madrid') + interval '1 day') at time zone 'Europe/Madrid' order by g.inicio limit 50`);
  const proximas = await q(`select g.id, g.solicitud_id sid, g.titulo, g.inicio, g.tipo::text tipo, g.plazo_verificado_at is not null verificado,
      case when s.id is null then null else ${ASUNTO} end asunto
    ${tareas} and g.inicio >= (date_trunc('day', now() at time zone 'Europe/Madrid') + interval '1 day') at time zone 'Europe/Madrid'
      and g.inicio < now() + interval '14 days' order by g.inicio limit 30`);
  const por_revisar = await q(`select s.id sid, ${ASUNTO} asunto, count(*)::int n ${DESDE} join portal.documentos d on d.solicitud_id = s.id
    where ${mios} and d.estado = 'pendiente' group by 1, 2 order by 3 desc limit 20`);
  const sin_responder = await q(`select s.id sid, ${ASUNTO} asunto, max(m.created_at) at ${DESDE} join portal.mensajes m on m.solicitud_id = s.id
    where ${mios} and not m.del_despacho and not exists (select 1 from portal.mensajes r where r.solicitud_id = s.id and r.del_despacho and r.created_at > m.created_at)
    group by 1, 2 order by 3 limit 20`);
  // Bandeja común: solicitudes nuevas sin responsable (la RLS ya decide quién las ve; lectura y facturación, no).
  const sin_responsable = await q(`select s.id sid, ${ASUNTO} asunto, s.estado::text estado ${DESDE}
    where s.responsable_id is null and s.estado in ('enviada', 'en_revision') and $1::uuid is not null order by s.enviada_at limit 20`);
  const movimientos = await q(`select x.sid, ${ASUNTO} asunto, x.at, x.texto from (
      select m.solicitud_id sid, m.created_at at, 'Mensaje del cliente' texto from portal.mensajes m where not m.del_despacho
      union all select d.solicitud_id, d.subido_at, 'Documento: ' || d.nombre_original from portal.documentos d where d.subido_por <> $1
      union all select n.solicitud_id, n.created_at, 'Nota de ' || p.nombre_visible from portal.notas_internas n join portal.personal p on p.user_id = n.autor_id where n.autor_id <> $1
    ) x join portal.solicitudes s on s.id = x.sid join identidad."user" u on u.id = s.cliente_id left join portal.expedientes e on e.solicitud_id = s.id
      left join portal.tipos_asunto t on t.id = s.tipo_asunto_id
    where ${mios} and x.at > now() - interval '7 days' order by x.at desc limit 15`);
  return { asuntos, hoy, proximas, por_revisar, sin_responder, sin_responsable, movimientos } as MiTrabajo;
}
