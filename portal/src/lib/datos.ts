import 'server-only';
import type { Tx } from './db';

// Consultas compartidas. TODAS se ejecutan dentro de comoUsuario(): la RLS de la base de datos
// limita las filas al usuario de la sesión, también si un identificador viene manipulado en la URL.

export type ResumenSolicitud = {
  id: string; referencia: string; estado: string; tipo: string | null; tipo_nombre: string | null;
  created_at: Date; enviada_at: Date | null; estado_visible: string | null; motivo_no_aceptada: string | null;
  expediente_id: string | null; expediente_ref: string | null; expediente_titulo: string | null;
  total: number; aportados: number; validados: number; pendientes_oblig: number; subsanar: number; paso: number;
  cliente_nombre?: string; cliente_email?: string; responsable?: string | null; por_revisar?: number;
};

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const resumenSql = `
  select s.id, s.referencia, s.estado, s.tipo_asunto_id tipo, t.nombre tipo_nombre, s.created_at, s.enviada_at, s.paso,
         s.estado_visible, s.motivo_no_aceptada, e.id expediente_id, e.referencia expediente_ref, e.titulo expediente_titulo,
         count(r.id) filter (where r.estado <> 'no_aplicable')::int total,
         count(r.id) filter (where r.estado in ('recibido', 'en_revision', 'validado'))::int aportados,
         count(r.id) filter (where r.estado = 'validado')::int validados,
         count(r.id) filter (where r.obligatorio and r.estado in ('pendiente', 'subsanacion'))::int pendientes_oblig,
         count(r.id) filter (where r.estado = 'subsanacion')::int subsanar
  from portal.solicitudes s
  left join portal.tipos_asunto t on t.id = s.tipo_asunto_id
  left join portal.expedientes e on e.solicitud_id = s.id
  left join portal.requisitos r on r.solicitud_id = s.id`;

export async function misSolicitudes(tx: Tx, uid: string): Promise<ResumenSolicitud[]> {
  const r = await tx.query(`${resumenSql} where s.cliente_id = $1 or exists (select 1 from portal.accesos a where a.solicitud_id = s.id and a.user_id = $1 and a.revocado_at is null)
    group by s.id, t.nombre, e.id order by coalesce(s.enviada_at, s.created_at) desc`, [uid]);
  return r.rows;
}

export async function resumenSolicitud(tx: Tx, id: string): Promise<ResumenSolicitud | null> {
  if (!UUID.test(id)) return null;
  const r = await tx.query(`${resumenSql} where s.id = $1 group by s.id, t.nombre, e.id`, [id]);
  return r.rows[0] ?? null;
}

export type Requisito = {
  id: string; titulo: string; explicacion: string; ejemplo: string | null; obligatorio: boolean; multiple: boolean; sensible: boolean;
  estado: string; comentario: string | null; orden: number; solicitado_por: string | null;
  documentos: { id: string; version: number; nombre_original: string; mime: string; tamano: number; subido_at: Date; estado: string; motivo: string | null; sustituye_a: string | null; analisis: string; del_despacho: boolean }[];
};

export async function requisitos(tx: Tx, solicitudId: string): Promise<Requisito[]> {
  const r = await tx.query(`
    select q.id, q.titulo, q.explicacion, q.ejemplo, q.obligatorio, q.multiple, q.sensible, q.estado, q.comentario, q.orden, q.solicitado_por,
      coalesce((select json_agg(json_build_object('id', d.id, 'version', d.version, 'nombre_original', d.nombre_original, 'mime', d.mime,
        'tamano', d.tamano, 'subido_at', d.subido_at, 'estado', d.estado, 'motivo', d.motivo, 'sustituye_a', d.sustituye_a,
        'analisis', d.analisis, 'del_despacho', d.subido_por <> d.cliente_id) order by d.version desc)
        from portal.documentos d where d.requisito_id = q.id), '[]') documentos
    from portal.requisitos q where q.solicitud_id = $1 order by q.orden, q.created_at`, [solicitudId]);
  return r.rows;
}

export type Mensaje = { id: string; texto: string; del_despacho: boolean; created_at: Date; autor: string };
export async function mensajes(tx: Tx, solicitudId: string): Promise<Mensaje[]> {
  const r = await tx.query(`
    select m.id, m.texto, m.del_despacho, m.created_at,
      case when m.del_despacho then coalesce((select p.nombre_visible from portal.personal p where p.user_id = m.autor_id), 'Praetoria Abogados')
           else coalesce((select u.name from identidad."user" u where u.id = m.autor_id), 'Cliente') end autor
    from portal.mensajes m where m.solicitud_id = $1 order by m.created_at`, [solicitudId]);
  return r.rows;
}

export type Evento = { id: string; tipo: string; detalle: Record<string, unknown>; visible_cliente: boolean; happened_at: Date; actor: string | null };
export async function eventos(tx: Tx, solicitudId: string): Promise<Evento[]> {
  const r = await tx.query(`
    select e.id, e.tipo, e.detalle, e.visible_cliente, e.happened_at,
      (select coalesce(p.nombre_visible, u.name) from identidad."user" u left join portal.personal p on p.user_id = u.id where u.id = e.actor_id) actor
    from portal.eventos e where e.solicitud_id = $1 order by e.id desc limit 200`, [solicitudId]);
  return r.rows;
}

export async function tiposAsunto(tx: Tx) {
  const r = await tx.query('select id, nombre, descripcion from portal.tipos_asunto where activo order by orden');
  return r.rows as { id: string; nombre: string; descripcion: string }[];
}

export async function vistaPreviaPlantilla(tx: Tx, tipo: string) {
  const r = await tx.query(`select i.titulo, i.explicacion, i.obligatorio from portal.plantilla_items i
    join portal.plantillas p on p.id = i.plantilla_id where p.tipo_asunto_id = $1 and p.activa and i.activo order by i.orden`, [tipo]);
  return r.rows as { titulo: string; explicacion: string; obligatorio: boolean }[];
}
