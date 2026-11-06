import { z } from 'zod';
import { q, q1, type Db, pool } from '../db';
import type { Usuario } from '../auth/sesiones';
import { esUuid, exigirPoliza } from '../acceso';
import { auditar } from '../auditoria';
import { NoEncontrado, Invalido } from '../errores';
import { fechaOpc, textoOpc, textoReq, validar } from '../validacion';
import { esFecha, hoyMadrid } from '../fechas';
import { TIPOS_DOCUMENTO } from './documentos';

/**
 * Expediente permanente de un seguro: todo lo que le ocurre a la póliza a lo largo de los años queda en la misma
 * ficha (documentos de cualquier tipo, periodos, suplementos, recibos, comunicaciones, notas y siniestros), con una
 * cronología única y búsqueda. Las notas son afirmaciones propias: se distinguen siempre de lo acreditado.
 */

export const DIRECCIONES = { enviada: 'Enviada', recibida: 'Recibida' } as const;
export const MEDIOS = { correo: 'Correo electrónico', carta: 'Carta', burofax: 'Burofax', telefono: 'Teléfono', web: 'Web / área de clientes', presencial: 'En persona', otro: 'Otro' } as const;
export const TIPOS_ASUNTO = { siniestro: 'Siniestro', reclamacion: 'Reclamación', documentacion: 'Petición de documentación', prima: 'Prima / renovación', comunicacion: 'Comunicación de circunstancias', otro: 'Otro' } as const;

export type ItemCronologia = {
  clase: 'documento' | 'nota' | 'comunicacion' | 'modificacion' | 'recibo' | 'periodo' | 'siniestro' | 'siniestro_evento' | 'siniestro_archivo' | 'escrito';
  id: string;
  fecha: string | null;            // fecha del hecho/documento (YYYY-MM-DD); null = sin fecha
  titulo: string;
  detalle: string | null;
  acreditado: boolean;             // respaldado por un documento; false = nota o dato sin documento
  enlace: string | null;
  etiqueta: string;                // tipo legible
  siniestro_id?: string | null;
  asunto_id?: string | null;
};

const B = '/admin/seguros';

/** Cronología completa del seguro. `buscar` filtra por texto, también dentro del contenido de los documentos. */
export async function cronologia(u: Usuario, polizaId: string, opciones: { clase?: string | null; buscar?: string | null } = {}, db: Db = pool()): Promise<ItemCronologia[]> {
  await exigirPoliza(u, polizaId, db);
  const items: ItemCronologia[] = [];
  const docs = await q<{ id: string; tipo: string; nombre_original: string; fecha_documento: string | null; subido_en: Date; descripcion: string | null; siniestros: string[] | null }>(
    `SELECT d.id, d.tipo, d.nombre_original, d.fecha_documento, d.subido_en, d.descripcion,
            (SELECT array_agg(siniestro_id::text) FROM documento_siniestros ds WHERE ds.documento_id = d.id) AS siniestros
       FROM documentos d WHERE d.poliza_id = $1 AND d.eliminado_en IS NULL`, [polizaId], db);
  for (const d of docs) items.push({
    clase: 'documento', id: d.id, fecha: d.fecha_documento ?? hoyMadrid(new Date(d.subido_en)), titulo: d.nombre_original,
    detalle: [d.descripcion, d.fecha_documento ? null : 'fecha de subida (el documento no tiene fecha registrada)'].filter(Boolean).join(' · ') || null,
    acreditado: true, enlace: `/api/seguros/documentos/${d.id}/`, etiqueta: TIPOS_DOCUMENTO[d.tipo as keyof typeof TIPOS_DOCUMENTO] ?? d.tipo,
    siniestro_id: d.siniestros?.[0] ?? null,
  });
  for (const n of await q<{ id: string; fecha: string; texto: string; asunto_id: string | null }>(
    'SELECT id, fecha, texto, asunto_id FROM notas WHERE poliza_id = $1 AND eliminado_en IS NULL', [polizaId], db)) {
    items.push({ clase: 'nota', id: n.id, fecha: n.fecha, titulo: 'Nota propia', detalle: n.texto, acreditado: false, enlace: null, etiqueta: 'Nota (sin acreditar)', asunto_id: n.asunto_id });
  }
  for (const c of await q<{ id: string; fecha: string; direccion: string; medio: string; interlocutor: string | null; asunto: string | null; resumen: string | null; documento_id: string | null; asunto_id: string | null }>(
    'SELECT id, fecha, direccion, medio, interlocutor, asunto, resumen, documento_id, asunto_id FROM comunicaciones WHERE poliza_id = $1 AND eliminado_en IS NULL', [polizaId], db)) {
    items.push({
      clase: 'comunicacion', id: c.id, fecha: c.fecha,
      titulo: `${c.direccion === 'enviada' ? 'Enviada a' : 'Recibida de'} ${c.interlocutor ?? 'aseguradora / mediador'}${c.asunto ? `: ${c.asunto}` : ''}`,
      detalle: [MEDIOS[c.medio as keyof typeof MEDIOS], c.resumen].filter(Boolean).join(' · '),
      acreditado: !!c.documento_id, enlace: c.documento_id ? `/api/seguros/documentos/${c.documento_id}/` : null,
      etiqueta: c.direccion === 'enviada' ? 'Comunicación enviada' : 'Comunicación recibida', asunto_id: c.asunto_id,
    });
  }
  for (const m of await q<{ id: string; fecha_efecto: string | null; descripcion: string; documento_id: string | null; pagina: number | null }>(
    'SELECT id, fecha_efecto, descripcion, documento_id, pagina FROM modificaciones WHERE poliza_id = $1 AND anulada_en IS NULL', [polizaId], db)) {
    items.push({ clase: 'modificacion', id: m.id, fecha: m.fecha_efecto, titulo: 'Modificación de condiciones', detalle: m.descripcion, acreditado: !!m.documento_id,
      enlace: m.documento_id ? `/api/seguros/documentos/${m.documento_id}/${m.pagina ? `#page=${m.pagina}` : ''}` : null, etiqueta: 'Suplemento / modificación' });
  }
  for (const r of await q<{ id: string; numero: string | null; periodo_desde: string | null; periodo_hasta: string | null; fecha_cargo: string | null; fecha_pago: string | null; importe: string | null; estado: string; documento_id: string | null; justificante_id: string | null }>(
    `SELECT id, numero, periodo_desde, periodo_hasta, fecha_cargo, fecha_pago, importe, estado, documento_id, justificante_id FROM recibos WHERE poliza_id = $1`, [polizaId], db)) {
    items.push({
      clase: 'recibo', id: r.id, fecha: r.fecha_pago ?? r.fecha_cargo ?? r.periodo_desde,
      titulo: `Recibo${r.numero ? ` ${r.numero}` : ''}${r.importe ? ` · ${r.importe.replace('.', ',')} €` : ''}`,
      detalle: [r.periodo_desde && r.periodo_hasta ? `periodo ${r.periodo_desde} – ${r.periodo_hasta}` : null, `estado: ${r.estado}`, r.fecha_pago ? `pagado el ${r.fecha_pago}` : null].filter(Boolean).join(' · '),
      acreditado: !!(r.documento_id || r.justificante_id), enlace: `${B}/polizas/${polizaId}/?pestana=recibos#r-${r.id}`, etiqueta: 'Recibo',
    });
  }
  for (const a of await q<{ id: string; inicio: string | null; fin: string | null }>('SELECT id, inicio, fin FROM anualidades WHERE poliza_id = $1 AND anulada_en IS NULL', [polizaId], db)) {
    if (a.inicio) items.push({ clase: 'periodo', id: a.id, fecha: a.inicio, titulo: `Periodo de cobertura ${a.inicio} – ${a.fin ?? '¿?'}`, detalle: null, acreditado: true, enlace: `${B}/polizas/${polizaId}/anualidades/${a.id}`, etiqueta: 'Periodo' });
  }
  const sins = await q<{ id: string; titulo: string; fecha_hecho: string | null; estado: string; creado_en: Date }>(
    `SELECT s.id, s.titulo, s.fecha_hecho, s.estado, s.creado_en FROM siniestros s JOIN siniestro_polizas sp ON sp.siniestro_id = s.id
      WHERE sp.poliza_id = $1 AND s.archivado_en IS NULL`, [polizaId], db);
  for (const s of sins) {
    items.push({ clase: 'siniestro', id: s.id, fecha: s.fecha_hecho ?? hoyMadrid(new Date(s.creado_en)), titulo: `Siniestro: ${s.titulo}`, detalle: `estado: ${s.estado}`, acreditado: false, enlace: `${B}/siniestros/${s.id}`, etiqueta: 'Siniestro', siniestro_id: s.id });
  }
  if (sins.length) {
    const ids = sins.map((s) => s.id);
    for (const e of await q<{ id: string; siniestro_id: string; tipo: string; fecha: string; texto: string | null }>(
      'SELECT id::text, siniestro_id, tipo, fecha, texto FROM siniestro_eventos WHERE siniestro_id = ANY($1::uuid[])', [ids], db)) {
      items.push({ clase: 'siniestro_evento', id: e.id, fecha: e.fecha, titulo: `Seguimiento del siniestro (${e.tipo})`, detalle: e.texto, acreditado: false, enlace: `${B}/siniestros/${e.siniestro_id}`, etiqueta: 'Siniestro · seguimiento', siniestro_id: e.siniestro_id });
    }
    for (const f of await q<{ id: string; siniestro_id: string; tipo: string; nombre_original: string; subido_en: Date }>(
      'SELECT id, siniestro_id, tipo, nombre_original, subido_en FROM siniestro_archivos WHERE siniestro_id = ANY($1::uuid[]) AND eliminado_en IS NULL', [ids], db)) {
      items.push({ clase: 'siniestro_archivo', id: f.id, fecha: hoyMadrid(new Date(f.subido_en)), titulo: f.nombre_original, detalle: `archivo del siniestro (${f.tipo})`, acreditado: true, enlace: `/api/seguros/siniestros/archivos/${f.id}/`, etiqueta: 'Siniestro · archivo', siniestro_id: f.siniestro_id });
    }
  }
  const escritos = await q<{ id: string; titulo: string; estado: string; creado_en: Date; asunto_id: string | null }>(
    `SELECT id, titulo, estado, creado_en, asunto_id FROM escritos WHERE poliza_id = $1 AND eliminado_en IS NULL`, [polizaId], db);
  for (const e of escritos) items.push({ clase: 'escrito', id: e.id, fecha: hoyMadrid(new Date(e.creado_en)), titulo: `Escrito: ${e.titulo}`, detalle: e.estado === 'borrador' ? 'borrador (no enviado)' : e.estado, acreditado: false, enlace: `${B}/polizas/${polizaId}/escritos/${e.id}`, etiqueta: 'Escrito', asunto_id: e.asunto_id });

  let r = items;
  if (opciones.clase) r = r.filter((i) => i.clase === opciones.clase || (opciones.clase === 'siniestro' && i.clase.startsWith('siniestro')));
  const b = opciones.buscar?.trim().toLowerCase();
  if (b) {
    const enTexto = new Set((await q<{ documento_id: string }>(
      `SELECT DISTINCT dp.documento_id FROM documento_paginas dp JOIN documentos d ON d.id = dp.documento_id
        WHERE d.poliza_id = $1 AND d.eliminado_en IS NULL AND dp.texto ILIKE '%' || $2 || '%'`, [polizaId, b.replace(/[%_]/g, '')], db)).map((x) => x.documento_id));
    r = r.filter((i) => enTexto.has(i.id) || `${i.titulo} ${i.detalle ?? ''} ${i.etiqueta}`.toLowerCase().includes(b));
  }
  return r.sort((a, b2) => (b2.fecha ?? '').localeCompare(a.fecha ?? '') || a.titulo.localeCompare(b2.titulo));
}

// ---------------------------------------------------------------- Notas
const esquemaNota = z.object({ fecha: fechaOpc, texto: textoReq(8000, 'Escribe la nota.'), asunto_id: z.string().uuid().nullable().optional() });
export async function crearNota(u: Usuario, polizaId: string, datos: Record<string, unknown>, db: Db = pool()) {
  const titular = await exigirPoliza(u, polizaId, db);
  const d = validar(esquemaNota, { ...datos, asunto_id: datos.asunto_id || null });
  if (d.asunto_id) await exigirAsunto(u, d.asunto_id, polizaId, db);
  const r = await q1<{ id: string }>('INSERT INTO notas (poliza_id, asunto_id, fecha, texto, creado_por) VALUES ($1,$2,$3,$4,$5) RETURNING id',
    [polizaId, d.asunto_id ?? null, d.fecha ?? hoyMadrid(), d.texto, u.id], db);
  if (d.asunto_id) await marcarAsuntoDesactualizado(d.asunto_id, db);
  await auditar(u.id, 'nota_creada', 'nota', r!.id, titular, null, db);
  return r!.id;
}
export async function eliminarNota(u: Usuario, polizaId: string, notaId: string, db: Db = pool()) {
  const titular = await exigirPoliza(u, polizaId, db);
  if (!esUuid(notaId)) throw new NoEncontrado('nota');
  const r = await q1('UPDATE notas SET eliminado_en = now() WHERE id = $1 AND poliza_id = $2 AND eliminado_en IS NULL RETURNING id', [notaId, polizaId], db);
  if (!r) throw new NoEncontrado('nota');
  await auditar(u.id, 'nota_eliminada', 'nota', notaId, titular, null, db);
}

// ---------------------------------------------------------------- Comunicaciones
const esquemaComunicacion = z.object({
  fecha: fechaOpc.refine((v) => v !== null, 'Indica la fecha.'),
  direccion: z.enum(['enviada', 'recibida'], { error: 'Indica si se envió o se recibió.' }),
  medio: z.enum(Object.keys(MEDIOS) as [keyof typeof MEDIOS], { error: 'Medio no válido.' }),
  interlocutor: textoOpc(200), asunto: textoOpc(300), resumen: textoOpc(4000),
  documento_id: z.string().uuid().nullable(), asunto_id: z.string().uuid().nullable(),
});
export async function crearComunicacion(u: Usuario, polizaId: string, datos: Record<string, unknown>, origen: 'manual' | 'ia' = 'manual', db: Db = pool()) {
  const titular = await exigirPoliza(u, polizaId, db);
  const d = validar(esquemaComunicacion, { medio: 'otro', ...datos, documento_id: datos.documento_id || null, asunto_id: datos.asunto_id || null });
  if (d.documento_id && !(await q1('SELECT 1 FROM documentos WHERE id = $1 AND poliza_id = $2 AND eliminado_en IS NULL', [d.documento_id, polizaId], db))) throw new Invalido({ documento_id: 'El documento no es de este seguro.' });
  if (d.asunto_id) await exigirAsunto(u, d.asunto_id, polizaId, db);
  const r = await q1<{ id: string }>(
    `INSERT INTO comunicaciones (poliza_id, asunto_id, fecha, direccion, medio, interlocutor, asunto, resumen, documento_id, origen, creado_por)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
    [polizaId, d.asunto_id, d.fecha, d.direccion, d.medio, d.interlocutor, d.asunto, d.resumen, d.documento_id, origen, u.id], db);
  if (d.asunto_id) await marcarAsuntoDesactualizado(d.asunto_id, db);
  await auditar(u.id, 'comunicacion_registrada', 'comunicacion', r!.id, titular, { direccion: d.direccion }, db);
  return r!.id;
}
export async function eliminarComunicacion(u: Usuario, polizaId: string, id: string, db: Db = pool()) {
  const titular = await exigirPoliza(u, polizaId, db);
  if (!esUuid(id)) throw new NoEncontrado('comunicación');
  const r = await q1('UPDATE comunicaciones SET eliminado_en = now() WHERE id = $1 AND poliza_id = $2 AND eliminado_en IS NULL RETURNING id', [id, polizaId], db);
  if (!r) throw new NoEncontrado('comunicación');
  await auditar(u.id, 'comunicacion_eliminada', 'comunicacion', id, titular, null, db);
}

// ---------------------------------------------------------------- Modificaciones y condiciones en una fecha
const esquemaModificacion = z.object({ fecha_efecto: fechaOpc, descripcion: textoReq(4000, 'Describe la modificación.'), documento_id: z.string().uuid().nullable() });
export async function crearModificacion(u: Usuario, polizaId: string, datos: Record<string, unknown>, db: Db = pool()) {
  const titular = await exigirPoliza(u, polizaId, db);
  const d = validar(esquemaModificacion, { ...datos, documento_id: datos.documento_id || null });
  if (d.documento_id && !(await q1('SELECT 1 FROM documentos WHERE id = $1 AND poliza_id = $2', [d.documento_id, polizaId], db))) throw new Invalido({ documento_id: 'El documento no es de este seguro.' });
  const anualidad = d.fecha_efecto ? await anualidadEnFecha(polizaId, d.fecha_efecto, db) : null;
  const r = await q1<{ id: string }>(
    'INSERT INTO modificaciones (poliza_id, anualidad_id, fecha_efecto, descripcion, documento_id, origen, creado_por) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
    [polizaId, anualidad?.id ?? null, d.fecha_efecto, d.descripcion, d.documento_id, 'manual', u.id], db);
  await auditar(u.id, 'modificacion_registrada', 'modificacion', r!.id, titular, null, db);
  return r!.id;
}
export async function anularModificacion(u: Usuario, polizaId: string, id: string, db: Db = pool()) {
  const titular = await exigirPoliza(u, polizaId, db);
  if (!esUuid(id)) throw new NoEncontrado('modificación');
  const r = await q1('UPDATE modificaciones SET anulada_en = now() WHERE id = $1 AND poliza_id = $2 AND anulada_en IS NULL RETURNING id', [id, polizaId], db);
  if (!r) throw new NoEncontrado('modificación');
  await auditar(u.id, 'modificacion_anulada', 'modificacion', id, titular, null, db);
}

export const anualidadEnFecha = (polizaId: string, fecha: string, db: Db = pool()) =>
  q1<{ id: string; inicio: string; fin: string }>(
    `SELECT id, inicio, fin FROM anualidades WHERE poliza_id = $1 AND anulada_en IS NULL AND inicio <= $2 AND (fin IS NULL OR fin > $2)
      ORDER BY inicio DESC LIMIT 1`, [polizaId, fecha], db);

export type CondicionesEnFecha = {
  fecha: string;
  anualidad: Record<string, unknown> | null;
  modificaciones: { id: string; fecha_efecto: string | null; descripcion: string; documento_id: string | null; pagina: number | null; cita: string | null }[];
  documentos: { id: string; tipo: string; nombre_original: string; fecha_documento: string | null }[];
  vigente_hoy: boolean;
};

/**
 * Condiciones aplicables en una fecha: el periodo de cobertura que la incluye, las modificaciones con efecto hasta
 * esa fecha y los documentos de condiciones de ese periodo. Sirve tanto para «hoy» como para la fecha de un siniestro.
 */
export async function condicionesEnFecha(u: Usuario, polizaId: string, fecha: string, db: Db = pool()): Promise<CondicionesEnFecha> {
  await exigirPoliza(u, polizaId, db);
  if (!esFecha(fecha)) throw new Invalido({ fecha: 'Fecha no válida.' });
  const a = await q1<Record<string, unknown> & { id: string }>(
    `SELECT * FROM anualidades WHERE poliza_id = $1 AND anulada_en IS NULL AND inicio <= $2 AND (fin IS NULL OR fin > $2) ORDER BY inicio DESC LIMIT 1`, [polizaId, fecha], db);
  const modificaciones = a ? await q<CondicionesEnFecha['modificaciones'][number]>(
    `SELECT id, fecha_efecto, descripcion, documento_id, pagina, cita FROM modificaciones
      WHERE poliza_id = $1 AND anulada_en IS NULL AND (anualidad_id = $2 OR (fecha_efecto IS NOT NULL AND fecha_efecto >= $3 AND fecha_efecto <= $4))
        AND (fecha_efecto IS NULL OR fecha_efecto <= $4) ORDER BY fecha_efecto NULLS FIRST`, [polizaId, a.id, a.inicio, fecha], db) : [];
  const documentos = a ? await q<CondicionesEnFecha['documentos'][number]>(
    `SELECT id, tipo, nombre_original, fecha_documento FROM documentos WHERE poliza_id = $1 AND eliminado_en IS NULL
        AND tipo IN ('condiciones_particulares', 'condiciones_generales', 'suplemento', 'renovacion')
        AND (anualidad_id = $2 OR (anualidad_id IS NULL AND tipo = 'condiciones_generales'))
        AND (fecha_documento IS NULL OR fecha_documento <= $3)
      ORDER BY fecha_documento NULLS FIRST`, [polizaId, a.id, fecha], db) : [];
  const hoy = hoyMadrid();
  return { fecha, anualidad: a, modificaciones, documentos, vigente_hoy: !!a && String(a.inicio) <= hoy && (!a.fin || String(a.fin) > hoy) };
}

// ---------------------------------------------------------------- Documentos: tipo, fecha y siniestros
const esquemaDocumento = z.object({
  tipo: z.enum(Object.keys(TIPOS_DOCUMENTO) as [keyof typeof TIPOS_DOCUMENTO], { error: 'Tipo no válido.' }),
  fecha_documento: fechaOpc, descripcion: textoOpc(500), anualidad_id: z.string().uuid().nullable(),
});
export async function actualizarDocumento(u: Usuario, polizaId: string, documentoId: string, datos: Record<string, unknown>, db: Db = pool()) {
  const titular = await exigirPoliza(u, polizaId, db);
  const d = validar(esquemaDocumento, { ...datos, anualidad_id: datos.anualidad_id || null });
  if (d.anualidad_id && !(await q1('SELECT 1 FROM anualidades WHERE id = $1 AND poliza_id = $2', [d.anualidad_id, polizaId], db))) throw new Invalido({ anualidad_id: 'Periodo no válido.' });
  const r = await q1('UPDATE documentos SET tipo = $3, fecha_documento = $4, descripcion = $5, anualidad_id = $6 WHERE id = $1 AND poliza_id = $2 AND eliminado_en IS NULL RETURNING id',
    [documentoId, polizaId, d.tipo, d.fecha_documento, d.descripcion, d.anualidad_id], db);
  if (!r) throw new NoEncontrado('documento');
  await auditar(u.id, 'documento_modificado', 'documento', documentoId, titular, { campos: Object.keys(d) }, db);
}

/** Vincula un documento del seguro a un siniestro de ese mismo seguro (sin copiar el archivo). */
export async function vincularDocumentoSiniestro(u: Usuario, polizaId: string, documentoId: string, siniestroId: string | null, db: Db = pool()) {
  const titular = await exigirPoliza(u, polizaId, db);
  if (!esUuid(documentoId) || !(await q1('SELECT 1 FROM documentos WHERE id = $1 AND poliza_id = $2 AND eliminado_en IS NULL', [documentoId, polizaId], db))) throw new NoEncontrado('documento');
  await q('DELETE FROM documento_siniestros WHERE documento_id = $1', [documentoId], db);
  if (siniestroId) {
    if (!esUuid(siniestroId) || !(await q1('SELECT 1 FROM siniestro_polizas WHERE siniestro_id = $1 AND poliza_id = $2', [siniestroId, polizaId], db))) throw new Invalido({ siniestro_id: 'Ese siniestro no es de este seguro.' });
    await q('INSERT INTO documento_siniestros (documento_id, siniestro_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [documentoId, siniestroId], db);
    const a = await q1<{ id: string }>('SELECT id FROM asuntos WHERE siniestro_id = $1', [siniestroId], db);
    if (a) await marcarAsuntoDesactualizado(a.id, db);
  }
  await auditar(u.id, 'documento_siniestro', 'documento', documentoId, titular, { siniestro: siniestroId }, db);
}

/** Documentos de la póliza vinculados a un siniestro (para mostrarlos también en el siniestro). */
export const documentosDeSiniestro = (siniestroId: string, db: Db = pool()) =>
  q<{ id: string; poliza_id: string; tipo: string; nombre_original: string; fecha_documento: string | null }>(
    `SELECT d.id, d.poliza_id, d.tipo, d.nombre_original, d.fecha_documento FROM documento_siniestros ds JOIN documentos d ON d.id = ds.documento_id
      WHERE ds.siniestro_id = $1 AND d.eliminado_en IS NULL ORDER BY d.fecha_documento NULLS LAST`, [siniestroId], db);

// ---------------------------------------------------------------- Asuntos
export async function exigirAsunto(u: Usuario, asuntoId: string, polizaId?: string, db: Db = pool()) {
  if (!esUuid(asuntoId)) throw new NoEncontrado('asunto');
  const a = await q1<{ poliza_id: string }>('SELECT poliza_id FROM asuntos WHERE id = $1', [asuntoId], db);
  if (!a || (polizaId && a.poliza_id !== polizaId)) throw new NoEncontrado('asunto');
  await exigirPoliza(u, a.poliza_id, db);
  return a.poliza_id;
}
export const marcarAsuntoDesactualizado = (asuntoId: string, db: Db = pool()) => q('UPDATE asuntos SET resumen_desactualizado = true WHERE id = $1', [asuntoId], db);
export const marcarAsuntosPoliza = (polizaId: string, db: Db = pool()) => q('UPDATE asuntos SET resumen_desactualizado = true WHERE poliza_id = $1 AND estado = \'abierto\'', [polizaId], db);
