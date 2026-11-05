import { createHash } from 'node:crypto';
import { z } from 'zod';
import { q, q1, type Db, pool, transaccion } from '../db';
import type { Usuario } from '../auth/sesiones';
import { esUuid, exigirTitular, filtroSql, puedeVerTitular, titularesPermitidos } from '../acceso';
import { auditar } from '../auditoria';
import { almacen } from '../almacen';
import { Invalido, NoEncontrado } from '../errores';
import { detectarTipo } from '../tipos-archivo';
import { registrarIntento, superaLimite } from '../auth/limites';
import { fechaOpc, importeOpc, textoOpc, textoReq, validar } from '../validacion';
import { fechaLarga } from '../fechas';
import { formatoImporte } from '../dinero';
import { maxBytes } from './documentos';

export const ESTADOS_SINIESTRO = {
  borrador: 'Borrador',
  comunicado: 'Comunicado',
  en_tramitacion: 'En tramitación',
  documentacion_solicitada: 'Documentación solicitada',
  aceptado: 'Aceptado',
  rechazado: 'Rechazado',
  cerrado: 'Cerrado',
} as const;

export const TIPOS_ARCHIVO_SINIESTRO = { foto: 'Foto', parte: 'Parte / denuncia', comunicacion: 'Comunicación', presupuesto: 'Presupuesto / factura', otro: 'Otro' } as const;

export type Siniestro = {
  id: string; titular_id: string; titular: string; titulo: string; relato: string; fecha_hecho: string | null; fecha_conocimiento: string | null;
  lugar: string | null; riesgo_afectado: string | null; danos: string | null; terceros: string | null; importe_estimado: string | null;
  pruebas: string | null; estado: keyof typeof ESTADOS_SINIESTRO; referencia_aseguradora: string | null;
  plazo_comunicacion: string | null; plazo_comunicacion_fuente: string | null; creado_en: Date; actualizado_en: Date;
};

const esquema = z.object({
  titular_id: z.string().refine(esUuid, 'Elige el titular.'),
  titulo: textoReq(160, 'Pon un título breve (p. ej., «Golpe en la furgoneta en el polígono»).'),
  relato: textoReq(20000, 'Cuenta qué ha pasado con tus palabras.'),
  fecha_hecho: fechaOpc,
  fecha_conocimiento: fechaOpc,
  lugar: textoOpc(300),
  riesgo_afectado: textoOpc(300),
  danos: textoOpc(4000),
  terceros: textoOpc(4000),
  importe_estimado: importeOpc,
  pruebas: textoOpc(4000),
}).refine((d) => !d.fecha_hecho || !d.fecha_conocimiento || d.fecha_conocimiento >= d.fecha_hecho, { path: ['fecha_conocimiento'], message: 'No puede ser anterior a la fecha del hecho.' });

// ---------------------------------------------------------------- Consultas
export async function exigirSiniestro(u: Usuario, id: string, db: Db = pool()) {
  if (!esUuid(id)) throw new NoEncontrado('siniestro');
  const s = await q1<{ titular_id: string }>('SELECT titular_id FROM siniestros WHERE id = $1', [id], db);
  if (!s || !(await puedeVerTitular(u, s.titular_id, db))) throw new NoEncontrado('siniestro');
  return s.titular_id;
}

export async function listarSiniestros(u: Usuario, db: Db = pool()) {
  const params: unknown[] = [];
  const f = filtroSql(await titularesPermitidos(u, db), 's.titular_id', params);
  return q<Siniestro & { polizas: string[] }>(
    `SELECT s.*, t.nombre AS titular,
            coalesce((SELECT array_agg(p.nombre ORDER BY p.nombre) FROM siniestro_polizas sp JOIN polizas p ON p.id = sp.poliza_id WHERE sp.siniestro_id = s.id), '{}') AS polizas
       FROM siniestros s JOIN titulares t ON t.id = s.titular_id
      WHERE ${f} AND s.archivado_en IS NULL ORDER BY coalesce(s.fecha_hecho, s.creado_en::date) DESC`, params, db,
  );
}

export async function obtenerSiniestro(u: Usuario, id: string, db: Db = pool()) {
  await exigirSiniestro(u, id, db);
  return (await q1<Siniestro>('SELECT s.*, t.nombre AS titular FROM siniestros s JOIN titulares t ON t.id = s.titular_id WHERE s.id = $1', [id], db))!;
}

export type PolizaSiniestro = {
  poliza_id: string; nombre: string; ramo: string; aseguradora: string; numero: string | null; anualidad_id: string | null;
  inicio: string | null; fin: string | null; asistencia_telefono: string | null;
  anualidades: { id: string; inicio: string | null; fin: string | null }[];
};

export async function polizasDelSiniestro(u: Usuario, id: string, db: Db = pool()) {
  await exigirSiniestro(u, id, db);
  return q<PolizaSiniestro>(
    `SELECT p.id AS poliza_id, p.nombre, r.nombre AS ramo, p.aseguradora, p.numero, sp.anualidad_id, a.inicio, a.fin, p.asistencia_telefono,
            coalesce((SELECT json_agg(json_build_object('id', x.id, 'inicio', x.inicio, 'fin', x.fin) ORDER BY x.inicio DESC NULLS FIRST)
                        FROM anualidades x WHERE x.poliza_id = p.id AND x.anulada_en IS NULL), '[]') AS anualidades
       FROM siniestro_polizas sp JOIN polizas p ON p.id = sp.poliza_id JOIN ramos r ON r.id = p.ramo_id
       LEFT JOIN anualidades a ON a.id = sp.anualidad_id
      WHERE sp.siniestro_id = $1 ORDER BY p.nombre`, [id], db,
  );
}

/** Pólizas del mismo titular que pueden cubrir el siniestro (incluidas las que ya vencieron: cuenta la fecha del hecho). */
export async function polizasCandidatas(u: Usuario, id: string, db: Db = pool()) {
  const titular = await exigirSiniestro(u, id, db);
  const s = (await q1<{ fecha_hecho: string | null }>('SELECT fecha_hecho FROM siniestros WHERE id = $1', [id], db))!;
  return q<{ id: string; nombre: string; ramo: string; aseguradora: string; vigente: boolean; ya: boolean }>(
    `SELECT p.id, p.nombre, r.nombre AS ramo, p.aseguradora,
            EXISTS (SELECT 1 FROM anualidades a WHERE a.poliza_id = p.id AND a.anulada_en IS NULL AND $2::date IS NOT NULL
                      AND a.inicio <= $2::date AND (a.fin IS NULL OR a.fin > $2::date)) AS vigente,
            EXISTS (SELECT 1 FROM siniestro_polizas sp WHERE sp.siniestro_id = $3 AND sp.poliza_id = p.id) AS ya
       FROM polizas p JOIN ramos r ON r.id = p.ramo_id WHERE p.titular_id = $1
      ORDER BY 5 DESC, p.nombre`, [titular, s.fecha_hecho, id], db,
  );
}

// ---------------------------------------------------------------- Altas y cambios
export async function crearSiniestro(u: Usuario, datos: Record<string, unknown>, polizaInicial?: string | null) {
  const d = validar(esquema, datos);
  await exigirTitular(u, d.titular_id);
  return transaccion(async (db) => {
    const { id } = (await q1<{ id: string }>(
      `INSERT INTO siniestros (titular_id, titulo, relato, fecha_hecho, fecha_conocimiento, lugar, riesgo_afectado, danos, terceros, importe_estimado, pruebas, creado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [d.titular_id, d.titulo, d.relato, d.fecha_hecho, d.fecha_conocimiento, d.lugar, d.riesgo_afectado, d.danos, d.terceros, d.importe_estimado, d.pruebas, u.id], db,
    ))!;
    if (polizaInicial && esUuid(polizaInicial)) {
      const ok = await q1('SELECT 1 FROM polizas WHERE id = $1 AND titular_id = $2', [polizaInicial, d.titular_id], db);
      if (ok) await q('INSERT INTO siniestro_polizas (siniestro_id, poliza_id) VALUES ($1,$2)', [id, polizaInicial], db);
    }
    await q(`INSERT INTO siniestro_eventos (siniestro_id, tipo, fecha, texto, creado_por) VALUES ($1, 'estado', current_date, 'Expediente abierto', $2)`, [id, u.id], db);
    await auditar(u.id, 'siniestro_creado', 'siniestro', id, d.titular_id, null, db);
    return id;
  }).then(async (id) => { await autoAnualidades(id); return id; });
}

export async function actualizarSiniestro(u: Usuario, id: string, datos: Record<string, unknown>) {
  const titular = await exigirSiniestro(u, id);
  const d = validar(esquema, { ...datos, titular_id: titular }); // el titular no cambia
  await transaccion(async (db) => {
    await q(
      `UPDATE siniestros SET titulo=$2, relato=$3, fecha_hecho=$4, fecha_conocimiento=$5, lugar=$6, riesgo_afectado=$7, danos=$8, terceros=$9,
         importe_estimado=$10, pruebas=$11, actualizado_en=now() WHERE id=$1`,
      [id, d.titulo, d.relato, d.fecha_hecho, d.fecha_conocimiento, d.lugar, d.riesgo_afectado, d.danos, d.terceros, d.importe_estimado, d.pruebas], db,
    );
    await auditar(u.id, 'siniestro_modificado', 'siniestro', id, titular, null, db);
  });
  await autoAnualidades(id, true);
}

/**
 * Asigna a cada póliza la anualidad vigente en la fecha del hecho cuando hay exactamente una.
 * Si hay varias o ninguna, queda sin asignar y la ficha pide que la persona la elija.
 */
async function autoAnualidades(siniestroId: string, recalcular = false) {
  const s = await q1<{ fecha_hecho: string | null }>('SELECT fecha_hecho FROM siniestros WHERE id = $1', [siniestroId]);
  const filas = await q<{ poliza_id: string; anualidad_id: string | null }>('SELECT poliza_id, anualidad_id FROM siniestro_polizas WHERE siniestro_id = $1', [siniestroId]);
  for (const f of filas) {
    if (f.anualidad_id && !recalcular) continue;
    let elegida: string | null = null;
    if (s?.fecha_hecho) {
      const c = await q<{ id: string }>(
        `SELECT id FROM anualidades WHERE poliza_id = $1 AND anulada_en IS NULL AND inicio IS NOT NULL AND inicio <= $2 AND (fin IS NULL OR fin > $2)`, [f.poliza_id, s.fecha_hecho],
      );
      if (c.length === 1) elegida = c[0]!.id;
    }
    await q('UPDATE siniestro_polizas SET anualidad_id = $3 WHERE siniestro_id = $1 AND poliza_id = $2', [siniestroId, f.poliza_id, elegida]);
  }
}

export async function fijarPolizas(u: Usuario, id: string, polizaIds: string[]) {
  const titular = await exigirSiniestro(u, id);
  const ids = [...new Set(polizaIds.filter(esUuid))];
  const validas = (await q<{ id: string }>('SELECT id FROM polizas WHERE titular_id = $1 AND id = ANY($2::uuid[])', [titular, ids])).map((x) => x.id);
  // Nunca se mezclan pólizas de otro titular.
  if (validas.length !== ids.length) throw new Invalido({ polizas: 'Alguna póliza no pertenece a este titular.' });
  await transaccion(async (db) => {
    await q('DELETE FROM siniestro_polizas WHERE siniestro_id = $1 AND NOT (poliza_id = ANY($2::uuid[]))', [id, validas], db);
    for (const p of validas) await q('INSERT INTO siniestro_polizas (siniestro_id, poliza_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, p], db);
    await auditar(u.id, 'siniestro_polizas', 'siniestro', id, titular, { polizas: validas }, db);
  });
  await autoAnualidades(id);
}

export async function elegirAnualidad(u: Usuario, id: string, polizaId: string, anualidadId: string | null) {
  const titular = await exigirSiniestro(u, id);
  if (anualidadId && !(await q1('SELECT 1 FROM anualidades WHERE id = $1 AND poliza_id = $2', [anualidadId, polizaId]))) throw new Invalido({ anualidad: 'La anualidad no pertenece a la póliza.' });
  await q('UPDATE siniestro_polizas SET anualidad_id = $3 WHERE siniestro_id = $1 AND poliza_id = $2', [id, polizaId, anualidadId]);
  await auditar(u.id, 'siniestro_anualidad', 'siniestro', id, titular, { poliza: polizaId, anualidad: anualidadId });
}

const esquemaSeguimiento = z.object({
  estado: z.enum(Object.keys(ESTADOS_SINIESTRO) as [keyof typeof ESTADOS_SINIESTRO]),
  referencia_aseguradora: textoOpc(100),
  plazo_comunicacion: fechaOpc,
  plazo_comunicacion_fuente: textoOpc(300),
}).refine((d) => !d.plazo_comunicacion || d.plazo_comunicacion_fuente, { path: ['plazo_comunicacion_fuente'], message: 'Indica de dónde sale el plazo (póliza, cláusula, página). No se usan plazos supuestos.' });

export async function actualizarSeguimiento(u: Usuario, id: string, datos: Record<string, unknown>) {
  const titular = await exigirSiniestro(u, id);
  const d = validar(esquemaSeguimiento, datos);
  await transaccion(async (db) => {
    const antes = (await q1<{ estado: string }>('SELECT estado FROM siniestros WHERE id = $1 FOR UPDATE', [id], db))!;
    await q(`UPDATE siniestros SET estado=$2, referencia_aseguradora=$3, plazo_comunicacion=$4, plazo_comunicacion_fuente=$5, actualizado_en=now() WHERE id=$1`,
      [id, d.estado, d.referencia_aseguradora, d.plazo_comunicacion, d.plazo_comunicacion_fuente], db);
    if (antes.estado !== d.estado) {
      await q(`INSERT INTO siniestro_eventos (siniestro_id, tipo, fecha, texto, creado_por) VALUES ($1,'estado',current_date,$2,$3)`, [id, `Estado: ${ESTADOS_SINIESTRO[d.estado]}`, u.id], db);
    }
    await auditar(u.id, 'siniestro_seguimiento', 'siniestro', id, titular, { estado: d.estado }, db);
  });
}

const esquemaEvento = z.object({
  tipo: z.enum(['nota', 'comunicacion', 'pago']),
  fecha: fechaOpc.refine((v) => !!v, 'Indica la fecha.'),
  texto: textoOpc(4000),
  importe: importeOpc,
}).refine((d) => d.tipo !== 'pago' || d.importe, { path: ['importe'], message: 'Indica el importe del pago.' });

export async function anadirEvento(u: Usuario, id: string, datos: Record<string, unknown>) {
  const titular = await exigirSiniestro(u, id);
  const d = validar(esquemaEvento, datos);
  await q('INSERT INTO siniestro_eventos (siniestro_id, tipo, fecha, texto, importe, creado_por) VALUES ($1,$2,$3,$4,$5,$6)', [id, d.tipo, d.fecha, d.texto, d.importe, u.id]);
  await auditar(u.id, 'siniestro_evento', 'siniestro', id, titular, { tipo: d.tipo });
}

export async function eventos(u: Usuario, id: string) {
  await exigirSiniestro(u, id);
  return q<{ id: string; tipo: string; fecha: string; texto: string | null; importe: string | null; autor: string | null }>(
    'SELECT e.id, e.tipo, e.fecha, e.texto, e.importe, us.nombre AS autor FROM siniestro_eventos e LEFT JOIN usuarios us ON us.id = e.creado_por WHERE e.siniestro_id = $1 ORDER BY e.fecha DESC, e.id DESC', [id],
  );
}

// ---------------------------------------------------------------- Archivos del siniestro
export async function subirArchivoSiniestro(u: Usuario, id: string, { tipo, nombre, datos, claveExistente }: { tipo: string; nombre: string; datos: Buffer; claveExistente?: string }) {
  const titular = await exigirSiniestro(u, id);
  try { return await registrar(); } catch (e) { if (claveExistente) await almacen().borrar(claveExistente).catch(() => undefined); throw e; }
  async function registrar() {
  if (!(tipo in TIPOS_ARCHIVO_SINIESTRO)) throw new Invalido({ tipo: 'Elige el tipo.' });
  if (!datos.length || datos.length > maxBytes()) throw new Invalido({ archivo: `Archivo vacío o mayor de ${process.env.MAX_UPLOAD_MB ?? 25} MB.` });
  const mime = detectarTipo(datos);
  if (!mime) throw new Invalido({ archivo: 'Formato no admitido. Sube PDF o fotos (JPEG, PNG, WebP, HEIC).' });
  if (await superaLimite(`subida:${u.id}`, 60, 60)) throw new Invalido({ archivo: 'Has subido muchos archivos seguidos. Espera unos minutos.' });
  const clave = claveExistente ?? await almacen().guardar(titular, datos, mime);
  try {
    const r = (await q1<{ id: string }>(
      `INSERT INTO siniestro_archivos (siniestro_id, titular_id, tipo, nombre_original, mime, bytes, sha256, clave_almacen, subido_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [id, titular, tipo, nombre.split(/[\\/]/).pop()!.replace(/[\u0000-\u001f"<>]/g, '').slice(0, 180) || 'archivo', mime, datos.length,
        createHash('sha256').update(datos).digest('hex'), clave, u.id],
    ))!;
    await registrarIntento(`subida:${u.id}`, false);
    await auditar(u.id, 'siniestro_archivo_subido', 'siniestro', id, titular, { tipo, bytes: datos.length });
    return r.id;
  } catch (e) { await almacen().borrar(clave); throw e; }
  }
}

export async function archivosSiniestro(u: Usuario, id: string) {
  await exigirSiniestro(u, id);
  return q<{ id: string; tipo: keyof typeof TIPOS_ARCHIVO_SINIESTRO; nombre_original: string; mime: string; bytes: string; subido_en: Date }>(
    'SELECT id, tipo, nombre_original, mime, bytes, subido_en FROM siniestro_archivos WHERE siniestro_id = $1 AND eliminado_en IS NULL ORDER BY subido_en DESC', [id],
  );
}

export async function archivoParaDescarga(u: Usuario, archivoId: string) {
  if (!esUuid(archivoId)) throw new NoEncontrado('archivo');
  const a = await q1<{ id: string; titular_id: string; nombre_original: string; mime: string; clave_almacen: string }>(
    'SELECT id, titular_id, nombre_original, mime, clave_almacen FROM siniestro_archivos WHERE id = $1 AND eliminado_en IS NULL', [archivoId],
  );
  if (!a || !(await puedeVerTitular(u, a.titular_id))) throw new NoEncontrado('archivo');
  return a;
}

export async function eliminarArchivoSiniestro(u: Usuario, archivoId: string) {
  const a = await archivoParaDescarga(u, archivoId);
  const s = (await q1<{ siniestro_id: string }>('SELECT siniestro_id FROM siniestro_archivos WHERE id = $1', [archivoId]))!;
  await q('UPDATE siniestro_archivos SET eliminado_en = now() WHERE id = $1', [archivoId]);
  await auditar(u.id, 'siniestro_archivo_eliminado', 'siniestro', s.siniestro_id, a.titular_id);
  return s.siniestro_id;
}

// ---------------------------------------------------------------- Borradores
export async function borradores(u: Usuario, id: string) {
  await exigirSiniestro(u, id);
  return q<{ id: string; origen: string; texto: string; creado_en: Date; autor: string | null; analisis_id: string | null }>(
    'SELECT b.id, b.origen, b.texto, b.creado_en, us.nombre AS autor, b.analisis_id FROM siniestro_borradores b LEFT JOIN usuarios us ON us.id = b.creado_por WHERE b.siniestro_id = $1 ORDER BY b.creado_en DESC', [id],
  );
}

export async function guardarBorrador(u: Usuario, id: string, texto: string, origen: 'manual' | 'plantilla' | 'asistente' = 'manual', analisisId: string | null = null) {
  const titular = await exigirSiniestro(u, id);
  const t = texto.trim();
  if (!t) throw new Invalido({ texto: 'El borrador está vacío.' });
  if (t.length > 20000) throw new Invalido({ texto: 'El borrador es demasiado largo.' });
  const r = (await q1<{ id: string }>('INSERT INTO siniestro_borradores (siniestro_id, analisis_id, origen, texto, creado_por) VALUES ($1,$2,$3,$4,$5) RETURNING id', [id, analisisId, origen, t, u.id]))!;
  await auditar(u.id, 'siniestro_borrador', 'siniestro', id, titular, { origen });
  return r.id;
}

/**
 * Borrador sin IA: solo ordena los datos que la persona ha escrito. Los huecos quedan marcados entre corchetes
 * para completarlos; no se añade ningún hecho.
 */
export function plantillaComunicacion(s: Siniestro, polizas: PolizaSiniestro[]) {
  const p = polizas[0];
  const hueco = (v: string | null | undefined, que: string) => v?.trim() || `[${que}]`;
  return [
    `Asunto: Comunicación de siniestro${p?.numero ? ` · póliza nº ${p.numero}` : ''}`,
    '',
    `A la atención de ${hueco(p?.aseguradora, 'aseguradora')}:`,
    '',
    `En nombre de ${s.titular}, comunico el siniestro que se describe a continuación${p ? `, amparado en la póliza «${p.nombre}»${p.numero ? ` nº ${p.numero}` : ''}` : ''}.`,
    '',
    `Fecha del hecho: ${s.fecha_hecho ? fechaLarga(s.fecha_hecho) : '[fecha del hecho]'}`,
    s.fecha_conocimiento && s.fecha_conocimiento !== s.fecha_hecho ? `Fecha en que se tuvo conocimiento: ${fechaLarga(s.fecha_conocimiento)}` : null,
    `Lugar: ${hueco(s.lugar, 'lugar')}`,
    `Bien o riesgo afectado: ${hueco(s.riesgo_afectado, 'bien afectado')}`,
    '',
    'Descripción de lo ocurrido:',
    s.relato.trim(),
    '',
    `Daños: ${hueco(s.danos, 'daños observados')}`,
    s.terceros ? `Terceros implicados: ${s.terceros}` : null,
    s.importe_estimado ? `Valoración provisional: ${formatoImporte(s.importe_estimado)}` : null,
    s.pruebas ? `Documentación disponible: ${s.pruebas}` : null,
    '',
    'Quedo a su disposición para aportar la documentación adicional que precisen y les ruego que me indiquen el número de expediente asignado.',
    '',
    'Atentamente,',
    '[nombre y datos de contacto]',
  ].filter((l) => l !== null).join('\n');
}
