import 'server-only';
import type { Tx } from './db';

// Expediente conversacional (#78): una sola cronología con todo lo que hay en el asunto.
// Se ejecuta SIEMPRE dentro de comoUsuario(): la RLS limita lo que ve cada persona.

export type Entrada =
  | { clase: 'nota'; id: string; at: Date; autor: string; texto: string; fuente: string }
  | { clase: 'mensaje'; id: string; at: Date; autor: string; texto: string; del_despacho: boolean }
  | { clase: 'documento'; id: string; at: Date; autor: string; nombre: string; carpeta: string; version: number; visible: boolean;
      estado: string; mime: string; tamano: number; analisis: string; del_despacho: boolean; origen: string }
  | { clase: 'tarea'; id: string; at: Date; autor: string; titulo: string; inicio: Date; estado: string; tipo: string; verificado: boolean;
      sugerida: boolean; fuente: string | null; documento: { id: string; nombre: string } | null }
  | { clase: 'evento'; id: string; at: Date; autor: string | null; tipo: string; detalle: Record<string, unknown>; visible: boolean }
  | { clase: 'borrador'; id: string; at: Date; autor: string; escrito: string; titulo: string; version: number; origen: string; instruccion: string | null;
      modelos: { etiqueta: string; titulo: string; version: number }[]; avisos: number; pendientes: number; hilo: string | null };

const EVENTOS_EN_CRONOLOGIA = ['solicitud_enviada', 'estado_solicitud', 'estado_visible', 'expediente_abierto', 'documento_compartido',
  'documento_solicitado', 'requisito_actualizado', 'documento_revisado', 'conflictos_revisados', 'responsable_asignado',
  'asignacion', 'asignacion_retirada', 'tarea_encargada', 'tarea_reasignada', 'tarea_completada', 'tarea_reprogramada', 'plazo_verificado',
  'expediente_cerrado', 'expediente_reabierto', 'documento_eliminado', 'documento_restaurado', 'documento_purgado'];

export async function cronologia(tx: Tx, sid: string, limite = 400): Promise<Entrada[]> {
  const r = await tx.query(`
    select * from (
      select 'nota' clase, n.id::text id, n.created_at at, p.nombre_visible autor, jsonb_build_object('texto', n.texto, 'fuente', n.fuente) d
        from portal.notas_internas n join portal.personal p on p.user_id = n.autor_id where n.solicitud_id = $1
      union all
      select 'mensaje', m.id::text, m.created_at,
        case when m.del_despacho then coalesce((select nombre_visible from portal.personal where user_id = m.autor_id), 'Despacho')
             else coalesce((select name from identidad."user" where id = m.autor_id), 'Cliente') end,
        jsonb_build_object('texto', m.texto, 'del_despacho', m.del_despacho)
        from portal.mensajes m where m.solicitud_id = $1
      union all
      select 'documento', d.id::text, d.subido_at,
        coalesce((select nombre_visible from portal.personal where user_id = d.subido_por), (select name from identidad."user" where id = d.subido_por)),
        jsonb_build_object('nombre', d.nombre_original, 'carpeta', coalesce(q.carpeta, d.carpeta, 'Documentación'), 'version', d.version,
          'visible', d.visible_cliente, 'estado', d.estado, 'mime', d.mime, 'tamano', d.tamano, 'analisis', d.analisis,
          'del_despacho', d.subido_por <> d.cliente_id, 'origen', d.origen, 'requisito', q.titulo)
        from portal.documentos d left join portal.requisitos q on q.id = d.requisito_id where d.solicitud_id = $1
      union all
      select 'tarea', e.id::text, e.created_at, (select nombre_visible from portal.personal where user_id = e.propietario_id),
        jsonb_build_object('titulo', e.titulo, 'inicio', e.inicio, 'estado', e.estado, 'tipo', e.tipo, 'verificado', e.plazo_verificado_at is not null,
          'sugerida', e.origen_fecha = 'sugerida', 'fuente', e.plazo_fuente, 'doc_id', e.documento_id,
          'doc_nombre', (select nombre_original from portal.documentos where id = e.documento_id))
        from portal.agenda_eventos e where e.solicitud_id = $1
      union all
      select 'borrador', w.id::text, w.created_at, (select nombre_visible from portal.personal where user_id = w.autor_id),
        jsonb_build_object('escrito', w.escrito_id, 'titulo', es.titulo, 'version', w.version, 'origen', w.origen, 'instruccion', w.instruccion, 'hilo', es.hilo_id,
          'modelos', (select coalesce(jsonb_agg(jsonb_build_object('etiqueta', x->>'etiqueta', 'titulo', x->>'titulo', 'version', (x->>'version')::int)), '[]') from jsonb_array_elements(w.modelos) x),
          'avisos', jsonb_array_length(w.avisos),
          'pendientes', (length(w.texto) - length(replace(w.texto, '[PENDIENTE:', ''))) / 11)
        from portal.escrito_versiones w join portal.escritos es on es.id = w.escrito_id where w.solicitud_id = $1
      union all
      select 'evento', v.id::text, v.happened_at,
        (select coalesce(p.nombre_visible, u.name) from identidad."user" u left join portal.personal p on p.user_id = u.id where u.id = v.actor_id),
        jsonb_build_object('tipo', v.tipo, 'visible', v.visible_cliente, 'detalle', v.detalle || jsonb_strip_nulls(jsonb_build_object(
          'nombre_empleado', (select nombre_visible from portal.personal where user_id::text = v.detalle->>'empleado'),
          'nombre_a', (select nombre_visible from portal.personal where user_id::text = v.detalle->>'a'),
          'nombre_responsable', (select nombre_visible from portal.personal where user_id::text = v.detalle->>'responsable'))))
        from portal.eventos v where v.solicitud_id = $1 and v.tipo = any($2)
    ) x order by at desc limit $3`, [sid, EVENTOS_EN_CRONOLOGIA, limite]);
  return r.rows.reverse().map((f) => {
    const d = f.d as Record<string, unknown>;
    switch (f.clase) {
      case 'nota': return { clase: 'nota', id: f.id, at: f.at, autor: f.autor, texto: String(d.texto), fuente: String(d.fuente) };
      case 'mensaje': return { clase: 'mensaje', id: f.id, at: f.at, autor: f.autor, texto: String(d.texto), del_despacho: !!d.del_despacho };
      case 'documento': return { clase: 'documento', id: f.id, at: f.at, autor: f.autor, nombre: String(d.nombre), carpeta: String(d.requisito ?? d.carpeta),
        version: Number(d.version), visible: !!d.visible, estado: String(d.estado), mime: String(d.mime), tamano: Number(d.tamano), analisis: String(d.analisis),
        del_despacho: !!d.del_despacho, origen: String(d.origen) };
      case 'tarea': return { clase: 'tarea', id: f.id, at: f.at, autor: f.autor, titulo: String(d.titulo), inicio: new Date(String(d.inicio)),
        estado: String(d.estado), tipo: String(d.tipo), verificado: !!d.verificado, sugerida: !!d.sugerida, fuente: (d.fuente as string) || null,
        documento: d.doc_id && d.doc_nombre ? { id: String(d.doc_id), nombre: String(d.doc_nombre) } : null };
      case 'borrador': return { clase: 'borrador', id: f.id, at: f.at, autor: f.autor, escrito: String(d.escrito), titulo: String(d.titulo), version: Number(d.version),
        origen: String(d.origen), instruccion: (d.instruccion as string) || null, modelos: (d.modelos ?? []) as { etiqueta: string; titulo: string; version: number }[],
        avisos: Number(d.avisos), pendientes: Number(d.pendientes), hilo: (d.hilo as string) || null };
      default: return { clase: 'evento', id: f.id, at: f.at, autor: f.autor, tipo: String(d.tipo), detalle: (d.detalle ?? {}) as Record<string, unknown>, visible: !!d.visible };
    }
  });
}

export type Cabecera = {
  id: string; referencia: string; expediente_ref: string | null; titulo: string; estado: string; estado_visible: string | null;
  cliente_id: string; cliente: string; cliente_email: string; responsable: string | null; proxima: Date | null; proxima_titulo: string | null;
  docs: number; faltan: number; por_revisar: number; cuenta_activa: boolean; expediente_estado: string | null;
  contraparte: string | null; organo: string | null; numero_autos: string | null; procedimiento: string | null; abierto_at: Date | null;
};

export async function cabecera(tx: Tx, sid: string, uid: string): Promise<Cabecera | null> {
  const r = await tx.query(`
    select s.id, s.referencia, e.referencia expediente_ref, e.estado::text expediente_estado, coalesce(e.titulo, t.nombre, 'Solicitud') titulo, s.estado,
      coalesce(e.estado_visible, s.estado_visible) estado_visible, s.cliente_id, us.name cliente, us.email cliente_email,
      p.nombre_visible responsable,
      (select min(a.inicio) from portal.agenda_eventos a where a.solicitud_id = s.id and a.estado = 'pendiente' and a.inicio >= now()) proxima,
      (select a.titulo from portal.agenda_eventos a where a.solicitud_id = s.id and a.estado = 'pendiente' and a.inicio >= now() order by a.inicio limit 1) proxima_titulo,
      (select count(*) from portal.documentos d where d.solicitud_id = s.id)::int docs,
      (select count(*) from portal.requisitos q where q.solicitud_id = s.id and q.obligatorio and q.estado in ('pendiente','subsanacion'))::int faltan,
      (select count(*) from portal.documentos d where d.solicitud_id = s.id and d.estado = 'pendiente')::int por_revisar,
      us."emailVerified" cuenta_activa, s.contraparte, e.organo, e.numero_autos, e.abierto_at,
      (select nombre from portal.bib_procedimientos pr where pr.id = e.procedimiento_id) procedimiento
    from portal.solicitudes s join identidad."user" us on us.id = s.cliente_id
    left join portal.expedientes e on e.solicitud_id = s.id left join portal.tipos_asunto t on t.id = s.tipo_asunto_id
    left join portal.personal p on p.user_id = coalesce(e.responsable_id, s.responsable_id)
    where s.id = $1`, [sid]);
  if (!r.rowCount) return null;
  await tx.query(`insert into portal.recientes (user_id, solicitud_id) values ($1, $2)
    on conflict (user_id, solicitud_id) do update set visto_at = now()`, [uid, sid]);
  return r.rows[0];
}

export async function recientes(tx: Tx, uid: string) {
  return (await tx.query(`select s.id, coalesce(e.titulo, t.nombre, s.referencia) titulo, us.name cliente, coalesce(e.referencia, s.referencia) ref
    from portal.recientes r join portal.solicitudes s on s.id = r.solicitud_id join identidad."user" us on us.id = s.cliente_id
    left join portal.expedientes e on e.solicitud_id = s.id left join portal.tipos_asunto t on t.id = s.tipo_asunto_id
    where r.user_id = $1 order by r.visto_at desc limit 12`, [uid])).rows as { id: string; titulo: string; cliente: string; ref: string }[];
}

/** Búsqueda global del despacho: clientes, asuntos y documentos. */
export async function buscar(tx: Tx, q: string) {
  const patron = `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
  const [clientes, asuntos, documentos] = await Promise.all([
    tx.query(`select us.id, us.name, us.email, pf.empresa, pf.nif,
        (select count(*) from portal.solicitudes s where s.cliente_id = us.id and s.estado <> 'borrador')::int asuntos
      from identidad."user" us join portal.perfiles pf on pf.user_id = us.id
      where us.name ilike $1 or us.email ilike $1 or pf.empresa ilike $1 or pf.nif ilike $1 or pf.telefono ilike $1
      order by us.name limit 20`, [patron]),
    tx.query(`select s.id, coalesce(e.referencia, s.referencia) ref, coalesce(e.titulo, t.nombre, 'Solicitud') titulo, us.name cliente, s.estado
      from portal.solicitudes s join identidad."user" us on us.id = s.cliente_id
      left join portal.expedientes e on e.solicitud_id = s.id left join portal.tipos_asunto t on t.id = s.tipo_asunto_id
      left join portal.perfiles pf on pf.user_id = s.cliente_id
      where s.estado <> 'borrador' and (s.referencia ilike $1 or e.referencia ilike $1 or e.titulo ilike $1 or us.name ilike $1 or us.email ilike $1
        or pf.nif ilike $1 or pf.empresa ilike $1 or s.contraparte ilike $1)
      order by coalesce(e.abierto_at, s.enviada_at) desc nulls last limit 20`, [patron]),
    tx.query(`select d.id, d.nombre_original, d.solicitud_id, us.name cliente from portal.documentos d join identidad."user" us on us.id = d.cliente_id
      where d.nombre_original ilike $1 order by d.subido_at desc limit 20`, [patron]),
  ]);
  return { clientes: clientes.rows, asuntos: asuntos.rows, documentos: documentos.rows };
}
