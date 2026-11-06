import { z } from 'zod';
import { q, q1, type Db, pool, transaccion } from '../db';
import type { Usuario } from '../auth/sesiones';
import { esUuid, exigirPoliza } from '../acceso';
import { auditar } from '../auditoria';
import { Invalido, NoEncontrado } from '../errores';
import { fechaOpc, textoOpc, textoReq, validar } from '../validacion';
import { MEDIOS, TIPOS_ASUNTO, marcarAsuntoDesactualizado } from './expediente';
import type { Cita, ResumenAsunto } from '../ia/expediente';

/**
 * Escritos del seguro: borradores con versiones. Generar o editar un escrito NO lo comunica: el envío y la respuesta
 * se registran aparte (y quedan como comunicaciones del expediente, vinculadas al asunto).
 */
export const TIPOS_ESCRITO: Record<string, string> = {
  declaracion_siniestro: 'Declaración de siniestro', respuesta_documentacion: 'Respuesta a petición de documentación',
  reclamacion_falta_respuesta: 'Reclamación por falta de respuesta', revision_denegacion: 'Solicitud de revisión de una denegación',
  revision_prima: 'Solicitud de revisión de la prima', comunicacion_circunstancia: 'Comunicación de una circunstancia', otro: 'Escrito',
};
export const ESTADOS_ESCRITO = { borrador: 'Borrador (no enviado)', enviado: 'Enviado', respondido: 'Respondido', descartado: 'Descartado' } as const;

export async function exigirEscrito(u: Usuario, id: string, db: Db = pool()) {
  if (!esUuid(id)) throw new NoEncontrado('escrito');
  const e = await q1<{ id: string; poliza_id: string; asunto_id: string | null; conversacion_id: string | null; tipo: string; titulo: string; destinatario: string | null; estado: keyof typeof ESTADOS_ESCRITO; creado_en: Date }>(
    'SELECT id, poliza_id, asunto_id, conversacion_id, tipo, titulo, destinatario, estado, creado_en FROM escritos WHERE id = $1 AND eliminado_en IS NULL', [id], db);
  if (!e) throw new NoEncontrado('escrito');
  const titular = await exigirPoliza(u, e.poliza_id, db);
  return { ...e, titular };
}

export async function obtenerEscrito(u: Usuario, id: string, db: Db = pool()) {
  const e = await exigirEscrito(u, id, db);
  const versiones = await q<{ id: string; version: number; texto: string; origen: 'ia' | 'manual'; citas: Cita[] | null; creado_en: Date }>(
    'SELECT id, version, texto, origen, citas, creado_en FROM escrito_versiones WHERE escrito_id = $1 ORDER BY version DESC', [id], db);
  const comunicaciones = await q<{ id: string; fecha: string; direccion: string; medio: string; interlocutor: string | null; resumen: string | null; escrito_version_id: string | null; documento_id: string | null }>(
    `SELECT c.id, c.fecha, c.direccion, c.medio, c.interlocutor, c.resumen, c.escrito_version_id, c.documento_id FROM comunicaciones c
      WHERE c.eliminado_en IS NULL AND (c.escrito_version_id IN (SELECT id FROM escrito_versiones WHERE escrito_id = $1)
        OR (c.direccion = 'recibida' AND c.asunto_id IS NOT DISTINCT FROM $2 AND $2::uuid IS NOT NULL AND c.fecha >= $3::date))
      ORDER BY c.fecha`, [id, e.asunto_id, e.creado_en.toISOString().slice(0, 10)], db);
  return { ...e, versiones, comunicaciones };
}

export const listarEscritos = async (u: Usuario, polizaId: string, db: Db = pool()) => {
  await exigirPoliza(u, polizaId, db);
  return q<{ id: string; titulo: string; tipo: string; estado: keyof typeof ESTADOS_ESCRITO; asunto_id: string | null; creado_en: Date; versiones: number }>(
    `SELECT e.id, e.titulo, e.tipo, e.estado, e.asunto_id, e.creado_en, (SELECT count(*)::int FROM escrito_versiones v WHERE v.escrito_id = e.id) AS versiones
       FROM escritos e WHERE e.poliza_id = $1 AND e.eliminado_en IS NULL ORDER BY e.creado_en DESC`, [polizaId], db);
};

export async function guardarVersion(u: Usuario, escritoId: string, texto: string, db: Db = pool()) {
  const e = await exigirEscrito(u, escritoId, db);
  const t = texto.trim();
  if (!t) throw new Invalido({ texto: 'El escrito está vacío.' });
  if (t.length > 60000) throw new Invalido({ texto: 'Demasiado largo.' });
  const ultima = await q1<{ version: number; texto: string }>('SELECT version, texto FROM escrito_versiones WHERE escrito_id = $1 ORDER BY version DESC LIMIT 1', [escritoId], db);
  if (ultima && ultima.texto === t) return ultima.version;
  const v = (ultima?.version ?? 0) + 1;
  await q(`INSERT INTO escrito_versiones (escrito_id, version, texto, origen, creado_por) VALUES ($1,$2,$3,'manual',$4)`, [escritoId, v, t, u.id], db);
  await q('UPDATE escritos SET actualizado_en = now() WHERE id = $1', [escritoId], db);
  await auditar(u.id, 'escrito_version', 'escrito', escritoId, e.titular, { version: v }, db);
  return v;
}

const esquemaEnvio = z.object({
  fecha: fechaOpc.refine((v) => v !== null, 'Indica la fecha de envío.'),
  medio: z.enum(Object.keys(MEDIOS) as [keyof typeof MEDIOS]), destinatario: textoOpc(200), version_id: z.string().uuid({ error: 'Elige la versión enviada.' }),
});
/** Registra que una versión concreta se envió (no lo hace la generación del borrador). */
export async function registrarEnvio(u: Usuario, escritoId: string, datos: Record<string, unknown>, db: Db = pool()) {
  const e = await exigirEscrito(u, escritoId, db);
  const d = validar(esquemaEnvio, datos);
  if (!(await q1('SELECT 1 FROM escrito_versiones WHERE id = $1 AND escrito_id = $2', [d.version_id, escritoId], db))) throw new Invalido({ version_id: 'Versión no válida.' });
  return transaccion(async (tx) => {
    await q(`INSERT INTO comunicaciones (poliza_id, asunto_id, fecha, direccion, medio, interlocutor, asunto, resumen, escrito_version_id, creado_por)
             VALUES ($1,$2,$3,'enviada',$4,$5,$6,$7,$8,$9)`,
      [e.poliza_id, e.asunto_id, d.fecha, d.medio, d.destinatario ?? e.destinatario, e.titulo, `Enviado el escrito «${e.titulo}».`, d.version_id, u.id], tx);
    await q(`UPDATE escritos SET estado = 'enviado', destinatario = coalesce($2, destinatario), actualizado_en = now() WHERE id = $1`, [escritoId, d.destinatario], tx);
    if (e.asunto_id) await marcarAsuntoDesactualizado(e.asunto_id, tx);
    await auditar(u.id, 'escrito_enviado', 'escrito', escritoId, e.titular, { fecha: d.fecha, medio: d.medio }, tx);
  });
}

const esquemaRespuesta = z.object({
  fecha: fechaOpc.refine((v) => v !== null, 'Indica la fecha de la respuesta.'),
  medio: z.enum(Object.keys(MEDIOS) as [keyof typeof MEDIOS]), interlocutor: textoOpc(200), resumen: textoReq(4000, 'Resume la respuesta.'),
  documento_id: z.preprocess((v) => v || null, z.string().uuid().nullable()),
});
export async function registrarRespuesta(u: Usuario, escritoId: string, datos: Record<string, unknown>, db: Db = pool()) {
  const e = await exigirEscrito(u, escritoId, db);
  if (e.estado === 'borrador') throw new Invalido({ _: 'Registra primero el envío: un borrador no ha podido recibir respuesta.' });
  const d = validar(esquemaRespuesta, datos);
  if (d.documento_id && !(await q1('SELECT 1 FROM documentos WHERE id = $1 AND poliza_id = $2', [d.documento_id, e.poliza_id], db))) throw new Invalido({ documento_id: 'El documento no es de este seguro.' });
  return transaccion(async (tx) => {
    await q(`INSERT INTO comunicaciones (poliza_id, asunto_id, fecha, direccion, medio, interlocutor, asunto, resumen, documento_id, creado_por)
             VALUES ($1,$2,$3,'recibida',$4,$5,$6,$7,$8,$9)`,
      [e.poliza_id, e.asunto_id, d.fecha, d.medio, d.interlocutor, `Respuesta a «${e.titulo}»`, d.resumen, d.documento_id, u.id], tx);
    await q(`UPDATE escritos SET estado = 'respondido', actualizado_en = now() WHERE id = $1`, [escritoId], tx);
    if (e.asunto_id) await marcarAsuntoDesactualizado(e.asunto_id, tx);
    await auditar(u.id, 'escrito_respuesta', 'escrito', escritoId, e.titular, null, tx);
  });
}

export async function descartarEscrito(u: Usuario, escritoId: string, db: Db = pool()) {
  const e = await exigirEscrito(u, escritoId, db);
  await q(`UPDATE escritos SET estado = 'descartado', actualizado_en = now() WHERE id = $1 AND estado = 'borrador'`, [escritoId], db);
  await auditar(u.id, 'escrito_descartado', 'escrito', escritoId, e.titular, null, db);
}

// ---------------------------------------------------------------- Asuntos

export type Asunto = { id: string; tipo: keyof typeof TIPOS_ASUNTO; titulo: string; estado: 'abierto' | 'cerrado'; siniestro_id: string | null; resumen: ResumenAsunto | null; resumen_en: Date | null; resumen_desactualizado: boolean };

/** Asuntos del seguro; cada siniestro del seguro tiene el suyo (se crea si falta). */
export async function listarAsuntos(u: Usuario, polizaId: string, db: Db = pool()): Promise<Asunto[]> {
  await exigirPoliza(u, polizaId, db);
  await q(`INSERT INTO asuntos (poliza_id, siniestro_id, tipo, titulo, creado_por)
           SELECT sp.poliza_id, s.id, 'siniestro', s.titulo, $2 FROM siniestro_polizas sp JOIN siniestros s ON s.id = sp.siniestro_id
            WHERE sp.poliza_id = $1 AND s.archivado_en IS NULL AND NOT EXISTS (SELECT 1 FROM asuntos a WHERE a.siniestro_id = s.id)
           ON CONFLICT (siniestro_id) DO NOTHING`, [polizaId, u.id], db);
  return q<Asunto>('SELECT id, tipo, titulo, estado, siniestro_id, resumen, resumen_en, resumen_desactualizado FROM asuntos WHERE poliza_id = $1 ORDER BY estado, creado_en DESC', [polizaId], db);
}

const esquemaAsunto = z.object({ tipo: z.enum(Object.keys(TIPOS_ASUNTO) as [keyof typeof TIPOS_ASUNTO]), titulo: textoReq(160, 'Pon un título al asunto.') });
export async function crearAsunto(u: Usuario, polizaId: string, datos: Record<string, unknown>, db: Db = pool()) {
  const titular = await exigirPoliza(u, polizaId, db);
  const d = validar(esquemaAsunto, datos);
  const r = await q1<{ id: string }>('INSERT INTO asuntos (poliza_id, tipo, titulo, creado_por) VALUES ($1,$2,$3,$4) RETURNING id', [polizaId, d.tipo, d.titulo, u.id], db);
  await auditar(u.id, 'asunto_creado', 'asunto', r!.id, titular, { tipo: d.tipo }, db);
  return r!.id;
}

export async function cambiarEstadoAsunto(u: Usuario, polizaId: string, asuntoId: string, estado: 'abierto' | 'cerrado', db: Db = pool()) {
  const titular = await exigirPoliza(u, polizaId, db);
  if (!esUuid(asuntoId)) throw new NoEncontrado('asunto');
  const r = await q1(`UPDATE asuntos SET estado = $3, cerrado_en = CASE WHEN $3 = 'cerrado' THEN now() END WHERE id = $1 AND poliza_id = $2 RETURNING id`, [asuntoId, polizaId, estado], db);
  if (!r) throw new NoEncontrado('asunto');
  await auditar(u.id, 'asunto_estado', 'asunto', asuntoId, titular, { estado }, db);
}
