import { z } from 'zod';
import { q, q1, type Db, pool, transaccion } from '../db';
import type { Usuario } from '../auth/sesiones';
import { esUuid, exigirPoliza } from '../acceso';
import { auditar } from '../auditoria';
import { Invalido, NoEncontrado } from '../errores';
import { importeOpc, textoOpc, textoReq, validar, fechaOpc } from '../validacion';
import { costeAnual, deCentimos, formatoImporte, PERIODICIDADES, textoPeriodicidad } from '../dinero';
import { fechaLarga, hoyMadrid } from '../fechas';
import { normalizar } from '../pdf-texto';
import { planificar } from '../avisos/motor';
import { crearAnualidad, type Anualidad } from './polizas';

export const ESTADOS_RENOVACION = {
  pendiente: 'Pendiente', contactado: 'Contactado', ofertas: 'Ofertas recibidas', decision: 'Decisión pendiente',
  renovada: 'Renovada', sustituida: 'Sustituida por otra compañía', baja: 'Baja confirmada',
} as const;
type EstadoRenovacion = keyof typeof ESTADOS_RENOVACION;
const CERRADOS: EstadoRenovacion[] = ['renovada', 'sustituida', 'baja'];

export type Oferta = {
  id: string; aseguradora: string; es_renovacion_actual: boolean; prima_anual: string | null; impuestos_gastos: string | null;
  garantias: string | null; capitales: string | null; franquicias: string | null; exclusiones: string | null; vigencia: string | null;
  notas: string | null; documento_id: string | null; elegida: boolean;
};

async function exigirRenovacion(u: Usuario, id: string, db: Db = pool()) {
  if (!esUuid(id)) throw new NoEncontrado('renovación');
  const r = await q1<{ poliza_id: string; titular_id: string; anualidad_id: string; estado: EstadoRenovacion }>('SELECT poliza_id, titular_id, anualidad_id, estado FROM renovaciones WHERE id = $1', [id], db);
  if (!r) throw new NoEncontrado('renovación');
  await exigirPoliza(u, r.poliza_id, db);
  return r;
}

/** Abre (o devuelve) el expediente de renovación de una anualidad. */
export async function abrirRenovacion(u: Usuario, anualidadId: string) {
  if (!esUuid(anualidadId)) throw new NoEncontrado('anualidad');
  const a = await q1<{ poliza_id: string }>('SELECT poliza_id FROM anualidades WHERE id = $1 AND anulada_en IS NULL', [anualidadId]);
  if (!a) throw new NoEncontrado('anualidad');
  const titular = await exigirPoliza(u, a.poliza_id);
  const existe = await q1<{ id: string }>('SELECT id FROM renovaciones WHERE anualidad_id = $1', [anualidadId]);
  if (existe) return existe.id;
  const { id } = (await q1<{ id: string }>(
    `INSERT INTO renovaciones (anualidad_id, poliza_id, titular_id, creada_por) VALUES ($1,$2,$3,$4) ON CONFLICT (anualidad_id) DO UPDATE SET actualizada_en = now() RETURNING id`,
    [anualidadId, a.poliza_id, titular, u.id],
  ))!;
  await auditar(u.id, 'renovacion_abierta', 'renovacion', id, titular, { anualidad: anualidadId });
  return id;
}

export async function obtenerRenovacion(u: Usuario, id: string) {
  const r = await exigirRenovacion(u, id);
  const fila = (await q1<{ id: string; estado: EstadoRenovacion; interlocutor: string | null; nueva_anualidad_id: string | null; nueva_poliza_id: string | null }>(
    'SELECT id, estado, interlocutor, nueva_anualidad_id, nueva_poliza_id FROM renovaciones WHERE id = $1', [id]))!;
  const poliza = (await q1<{ id: string; nombre: string; aseguradora: string; numero: string | null; moneda: string; titular: string; mediador: string | null; ramo: string }>(
    `SELECT p.id, p.nombre, p.aseguradora, p.numero, p.moneda, t.nombre AS titular, p.mediador, r.nombre AS ramo FROM polizas p JOIN titulares t ON t.id = p.titular_id JOIN ramos r ON r.id = p.ramo_id WHERE p.id = $1`, [r.poliza_id]))!;
  const anualidad = (await q1<Anualidad & { garantias: unknown; franquicias: unknown; exclusiones: unknown; capitales: unknown }>('SELECT * FROM anualidades WHERE id = $1', [r.anualidad_id]))!;
  const historico = await q<Anualidad>('SELECT * FROM anualidades WHERE poliza_id = $1 AND anulada_en IS NULL ORDER BY inicio ASC NULLS LAST, creada_en', [r.poliza_id]);
  const siniestros = await q<{ id: string; titulo: string; fecha_hecho: string | null; estado: string }>(
    `SELECT s.id, s.titulo, s.fecha_hecho, s.estado FROM siniestros s JOIN siniestro_polizas sp ON sp.siniestro_id = s.id
      WHERE sp.poliza_id = $1 AND s.archivado_en IS NULL AND (sp.anualidad_id = $2 OR ($3::date IS NOT NULL AND s.fecha_hecho >= $3 AND ($4::date IS NULL OR s.fecha_hecho < $4)))
      ORDER BY s.fecha_hecho`, [r.poliza_id, r.anualidad_id, anualidad.inicio, anualidad.fin],
  );
  const ofertas = await q<Oferta>('SELECT * FROM ofertas WHERE renovacion_id = $1 ORDER BY creada_en', [id]);
  const notas = await q<{ id: string; tipo: string; texto: string; hecha: boolean; fecha_tarea: string | null; creado_en: Date; autor: string | null }>(
    'SELECT n.id, n.tipo, n.texto, n.hecha, n.fecha_tarea, n.creado_en, us.nombre AS autor FROM renovacion_notas n LEFT JOIN usuarios us ON us.id = n.creado_por WHERE n.renovacion_id = $1 ORDER BY n.creado_en DESC', [id],
  );
  return { ...fila, poliza, anualidad, historico, siniestros, ofertas, notas };
}

/** Variación de prima entre anualidades consecutivas (absoluta y porcentual), sobre el coste anual. */
export function evolucion(historico: Anualidad[]) {
  return historico.map((a, i) => {
    const c = costeAnual(a);
    const prev = i > 0 ? costeAnual(historico[i - 1]!) : null;
    return {
      id: a.id, inicio: a.inicio, fin: a.fin, coste: c,
      diferencia: c && prev ? c.centimos - prev.centimos : null,
      porcentaje: c && prev && prev.centimos > 0 ? ((c.centimos - prev.centimos) / prev.centimos) * 100 : null,
    };
  });
}

export async function cambiarEstado(u: Usuario, id: string, estado: string, interlocutor: string | null) {
  const r = await exigirRenovacion(u, id);
  if (!(estado in ESTADOS_RENOVACION) || CERRADOS.includes(estado as EstadoRenovacion)) throw new Invalido({ estado: 'Para renovar, sustituir o dar de baja usa «Registrar la decisión».' });
  if (CERRADOS.includes(r.estado)) throw new Invalido({ _: 'La renovación ya está cerrada.' });
  await transaccion(async (db) => {
    await q('UPDATE renovaciones SET estado = $2, interlocutor = $3, actualizada_en = now() WHERE id = $1', [id, estado, interlocutor?.slice(0, 200) || null], db);
    if (r.estado !== estado) await q(`INSERT INTO renovacion_notas (renovacion_id, tipo, texto, creado_por) VALUES ($1,'estado',$2,$3)`, [id, `Estado: ${ESTADOS_RENOVACION[estado as EstadoRenovacion]}`, u.id], db);
    // Mientras se negocia, la póliza figura «en negociación» (los avisos no se repiten).
    await q(`UPDATE polizas SET estado = 'en_negociacion', actualizada_en = now() WHERE id = $1 AND estado = 'activa'`, [r.poliza_id], db);
    await auditar(u.id, 'renovacion_estado', 'renovacion', id, r.titular_id, { estado }, db);
  });
}

export async function anadirNota(u: Usuario, id: string, d: { tipo: string; texto: string; fecha_tarea?: string | null }) {
  const r = await exigirRenovacion(u, id);
  if (!['nota', 'tarea', 'comunicacion'].includes(d.tipo)) throw new Invalido({ tipo: 'Tipo no válido.' });
  if (!d.texto.trim()) throw new Invalido({ texto: 'Escribe la nota.' });
  await q('INSERT INTO renovacion_notas (renovacion_id, tipo, texto, fecha_tarea, creado_por) VALUES ($1,$2,$3,$4,$5)', [id, d.tipo, d.texto.trim().slice(0, 4000), d.fecha_tarea || null, u.id]);
  await auditar(u.id, 'renovacion_nota', 'renovacion', id, r.titular_id, { tipo: d.tipo });
}

export async function marcarTarea(u: Usuario, notaId: string, hecha: boolean) {
  const n = await q1<{ renovacion_id: string }>('SELECT renovacion_id FROM renovacion_notas WHERE id = $1', [notaId]);
  if (!n) throw new NoEncontrado('tarea');
  await exigirRenovacion(u, n.renovacion_id);
  await q('UPDATE renovacion_notas SET hecha = $2 WHERE id = $1', [notaId, hecha]);
  return n.renovacion_id;
}

const esquemaOferta = z.object({
  aseguradora: textoReq(160, 'Indica la aseguradora de la oferta.'),
  es_renovacion_actual: z.preprocess((v) => v === 'on', z.boolean()),
  prima_anual: importeOpc,
  impuestos_gastos: textoOpc(500), garantias: textoOpc(4000), capitales: textoOpc(4000), franquicias: textoOpc(2000),
  exclusiones: textoOpc(4000), vigencia: textoOpc(300), notas: textoOpc(2000),
});

export async function crearOferta(u: Usuario, id: string, datos: Record<string, unknown>, documentoId: string | null = null) {
  const r = await exigirRenovacion(u, id);
  if (CERRADOS.includes(r.estado)) throw new Invalido({ _: 'La renovación ya está cerrada.' });
  const d = validar(esquemaOferta, datos);
  const o = (await q1<{ id: string }>(
    `INSERT INTO ofertas (renovacion_id, aseguradora, es_renovacion_actual, prima_anual, impuestos_gastos, garantias, capitales, franquicias, exclusiones, vigencia, notas, documento_id, creada_por)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
    [id, d.aseguradora, d.es_renovacion_actual, d.prima_anual, d.impuestos_gastos, d.garantias, d.capitales, d.franquicias, d.exclusiones, d.vigencia, d.notas, documentoId, u.id],
  ))!;
  await q(`UPDATE renovaciones SET estado = CASE WHEN estado IN ('pendiente', 'contactado') THEN 'ofertas' ELSE estado END, actualizada_en = now() WHERE id = $1`, [id]);
  await auditar(u.id, 'oferta_registrada', 'renovacion', id, r.titular_id, { oferta: o.id, prima: d.prima_anual });
  return o.id;
}

// ---------------------------------------------------------------- Comparación
const lineas = (t: string | null | undefined) => (t ?? '').split(/\n|;|•/).map((x) => x.trim()).filter((x) => x.length > 2);
const importes = (t: string | null | undefined) => (t?.match(/\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?/g) ?? []).map((x) => Number(x.replace(/\./g, '').replace(',', '.'))).filter((n) => n > 0);
const textoLista = (v: unknown) => (Array.isArray(v) ? v.map((x) => (x as { texto?: string }).texto ?? '').join('\n') : null);

export type Diferencia = { tipo: 'prima' | 'franquicia' | 'exclusion' | 'desconocido' | 'garantia'; texto: string; gravedad: 'mejor' | 'peor' | 'revisar' };

/**
 * Diferencias entre la oferta y la anualidad vigente. «Más barata» nunca se presenta como «equivalente»:
 * cualquier franquicia mayor, exclusión nueva, garantía ausente o dato desconocido se señala.
 */
export function compararOferta(o: Oferta, actual: { prima: number | null; franquicias: string | null; exclusiones: string | null; garantias: string | null }): Diferencia[] {
  const r: Diferencia[] = [];
  const prima = o.prima_anual !== null ? Number(o.prima_anual) : null;
  if (prima === null) r.push({ tipo: 'desconocido', texto: 'Prima anual desconocida', gravedad: 'revisar' });
  else if (actual.prima !== null) {
    const d = prima - actual.prima;
    if (d !== 0) r.push({ tipo: 'prima', texto: `${d < 0 ? 'Más barata' : 'Más cara'}: ${d > 0 ? '+' : '−'}${formatoImporte(Math.abs(d))} (${((d / actual.prima) * 100).toFixed(1).replace('.', ',')} %)`, gravedad: d < 0 ? 'mejor' : 'peor' });
  }
  const fo = importes(o.franquicias), fa = importes(actual.franquicias);
  if (!o.franquicias) r.push({ tipo: 'desconocido', texto: 'Franquicias desconocidas', gravedad: 'revisar' });
  else if (fa.length && fo.length && Math.max(...fo) > Math.max(...fa)) r.push({ tipo: 'franquicia', texto: `Franquicia superior: ${formatoImporte(Math.max(...fo))} frente a ${formatoImporte(Math.max(...fa))}`, gravedad: 'peor' });
  else if (!actual.franquicias) r.push({ tipo: 'franquicia', texto: 'No consta la franquicia actual para comparar', gravedad: 'revisar' });
  if (!o.exclusiones) r.push({ tipo: 'desconocido', texto: 'Exclusiones desconocidas', gravedad: 'revisar' });
  else {
    const previas = new Set(lineas(actual.exclusiones).map(normalizar));
    for (const e of lineas(o.exclusiones)) if (!previas.has(normalizar(e))) r.push({ tipo: 'exclusion', texto: `Exclusión nueva o distinta: ${e}`, gravedad: 'peor' });
  }
  if (!o.garantias) r.push({ tipo: 'desconocido', texto: 'Garantías desconocidas', gravedad: 'revisar' });
  else if (actual.garantias) {
    const nuevas = new Set(lineas(o.garantias).map(normalizar));
    for (const g of lineas(actual.garantias)) if (!nuevas.has(normalizar(g))) r.push({ tipo: 'garantia', texto: `No figura en la oferta: ${g}`, gravedad: 'revisar' });
  }
  return r;
}

export function datosActuales(a: Anualidad & { garantias?: unknown; franquicias?: unknown; exclusiones?: unknown }) {
  const c = costeAnual(a);
  return { prima: c ? c.centimos / 100 : null, franquicias: textoLista(a.franquicias), exclusiones: textoLista(a.exclusiones), garantias: textoLista(a.garantias) };
}

/** Borrador para pedir revisión al mediador, solo con datos confirmados. No cambia el estado ni desactiva avisos. */
export async function borradorSolicitud(u: Usuario, id: string) {
  const d = await obtenerRenovacion(u, id);
  const ev = evolucion(d.historico);
  const ultima = ev.find((x) => x.id === d.anualidad.id);
  const lineasPrimas = ev.filter((x) => x.coste).map((x) => `- ${fechaLarga(x.inicio) || '¿?'} – ${fechaLarga(x.fin) || '¿?'}: ${formatoImporte(deCentimos(x.coste!.centimos), d.poliza.moneda)}${x.coste!.tipo === 'estimado' ? ' (estimado)' : ''}${x.porcentaje !== null ? ` (${x.porcentaje >= 0 ? '+' : ''}${x.porcentaje.toFixed(1).replace('.', ',')} %)` : ''}`);
  const texto = [
    `Asunto: Revisión de la renovación · ${d.poliza.nombre}${d.poliza.numero ? ` (póliza nº ${d.poliza.numero})` : ''}`,
    '',
    `Hola${d.poliza.mediador ? `, ${d.poliza.mediador}` : ''}:`,
    '',
    `La póliza «${d.poliza.nombre}» de ${d.poliza.aseguradora}, a nombre de ${d.poliza.titular}, vence el ${d.anualidad.fin ? fechaLarga(d.anualidad.fin) : '[fecha de vencimiento]'}.`,
    ultima?.coste ? `La prima de la anualidad actual es de ${formatoImporte(deCentimos(ultima.coste.centimos), d.poliza.moneda)}${d.anualidad.periodicidad ? `, con pago ${textoPeriodicidad(d.anualidad.periodicidad).toLowerCase()}` : ''}.` : 'La prima de la anualidad actual: [importe].',
    lineasPrimas.length > 1 ? `\nEvolución de la prima:\n${lineasPrimas.join('\n')}` : null,
    `\n${d.siniestros.length === 0 ? 'No consta ningún siniestro registrado en este periodo.' : `Siniestros registrados en este periodo: ${d.siniestros.length}.`}`,
    '',
    'Antes de la renovación, os pido que reviséis la prima y las condiciones (garantías, capitales y franquicias) y que me enviéis por escrito la propuesta de renovación y, si es posible, alternativas de otras compañías con coberturas equivalentes, indicando cualquier diferencia de garantías, franquicias o exclusiones.',
    d.anualidad.plazo_oposicion && d.anualidad.plazo_oposicion_confirmado ? `\nTened en cuenta que la fecha límite para comunicar la oposición a la prórroga es el ${fechaLarga(d.anualidad.plazo_oposicion)}.` : null,
    '',
    'Gracias,',
    '[nombre]',
  ].filter((x) => x !== null).join('\n');
  await q(`INSERT INTO renovacion_notas (renovacion_id, tipo, texto, creado_por) VALUES ($1,'borrador',$2,$3)`, [id, texto, u.id]);
  return texto;
}

// ---------------------------------------------------------------- Decisión
const esquemaDecision = z.object({
  decision: z.enum(['renovar', 'sustituir', 'baja']),
  oferta_id: z.preprocess((v) => v || null, z.string().refine(esUuid).nullable()),
  aseguradora_nueva: textoOpc(160),
  numero_nuevo: textoOpc(80),
  inicio: fechaOpc, fin: fechaOpc,
  prima_anual: importeOpc,
  periodicidad: z.preprocess((v) => v || null, z.enum(PERIODICIDADES.map((p) => p.valor) as [string, ...string[]]).nullable()),
  importe_recibo: importeOpc,
});

/**
 * Registra la decisión. Renovar crea una anualidad nueva (la anterior queda intacta); sustituir crea una póliza
 * nueva enlazada a la anterior; la baja anula la póliza. En los tres casos se recalculan los avisos al momento.
 */
export async function registrarDecision(u: Usuario, id: string, datos: Record<string, unknown>) {
  const r = await exigirRenovacion(u, id);
  if (CERRADOS.includes(r.estado)) throw new Invalido({ _: 'La renovación ya está cerrada.' });
  const d = validar(esquemaDecision, datos);
  const anualidad = { inicio: d.inicio, fin: d.fin, prima_anual: d.prima_anual?.replace('.', ','), periodicidad: d.periodicidad, importe_recibo: d.importe_recibo?.replace('.', ','), datos_confirmados: 'on' };
  if (d.oferta_id && !(await q1('SELECT 1 FROM ofertas WHERE id = $1 AND renovacion_id = $2', [d.oferta_id, id]))) throw new Invalido({ oferta_id: 'Oferta no válida.' });
  if (d.decision !== 'baja' && (!d.inicio || !d.fin)) throw new Invalido({ inicio: 'Indica el inicio y el vencimiento de la nueva anualidad.' });

  if (d.decision === 'renovar') {
    const nueva = await crearAnualidad(u, r.poliza_id, anualidad);
    await transaccion(async (db) => {
      await q(`UPDATE renovaciones SET estado = 'renovada', nueva_anualidad_id = $2, actualizada_en = now() WHERE id = $1`, [id, nueva], db);
      await q(`UPDATE polizas SET estado = 'activa' WHERE id = $1 AND estado = 'en_negociacion'`, [r.poliza_id], db);
      if (d.oferta_id) await q('UPDATE ofertas SET elegida = true WHERE id = $1', [d.oferta_id], db);
      await q(`INSERT INTO renovacion_notas (renovacion_id, tipo, texto, creado_por) VALUES ($1,'estado','Renovada: nueva anualidad registrada',$2)`, [id, u.id], db);
    });
  } else if (d.decision === 'sustituir') {
    if (!d.aseguradora_nueva) throw new Invalido({ aseguradora_nueva: 'Indica la nueva aseguradora.' });
    const { crearPoliza } = await import('./polizas');
    const p = (await q1<Record<string, unknown>>('SELECT * FROM polizas WHERE id = $1', [r.poliza_id]))!;
    const nuevaPoliza = await crearPoliza(u, {
      titular_id: p.titular_id, ramo_id: p.ramo_id, nombre: p.nombre, riesgo: p.riesgo, aseguradora: d.aseguradora_nueva, numero: d.numero_nuevo,
      tomador: p.tomador, asegurado: p.asegurado, beneficiario: p.beneficiario, moneda: p.moneda,
      notas: `Sustituye a la póliza de ${p.aseguradora}${p.numero ? ` nº ${p.numero}` : ''}.`, ...anualidad,
    });
    await transaccion(async (db) => {
      await q(`UPDATE polizas SET estado = 'sustituida', sustituida_por = $2, actualizada_en = now() WHERE id = $1`, [r.poliza_id, nuevaPoliza], db);
      await q(`UPDATE renovaciones SET estado = 'sustituida', nueva_poliza_id = $2, actualizada_en = now() WHERE id = $1`, [id, nuevaPoliza], db);
      if (d.oferta_id) await q('UPDATE ofertas SET elegida = true WHERE id = $1', [d.oferta_id], db);
      await q(`INSERT INTO renovacion_notas (renovacion_id, tipo, texto, creado_por) VALUES ($1,'estado',$2,$3)`, [id, `Sustituida por una póliza de ${d.aseguradora_nueva}`, u.id], db);
    });
  } else {
    await transaccion(async (db) => {
      await q(`UPDATE polizas SET estado = 'anulada', actualizada_en = now() WHERE id = $1`, [r.poliza_id], db);
      await q(`UPDATE renovaciones SET estado = 'baja', actualizada_en = now() WHERE id = $1`, [id], db);
      await q(`INSERT INTO renovacion_notas (renovacion_id, tipo, texto, creado_por) VALUES ($1,'estado','Baja confirmada por el usuario',$2)`, [id, u.id], db);
    });
  }
  await auditar(u.id, 'renovacion_decision', 'renovacion', id, r.titular_id, { decision: d.decision, oferta: d.oferta_id });
  await planificar(hoyMadrid()); // los avisos de la anualidad anterior quedan obsoletos ya
  return d.decision;
}

export async function renovacionDeAnualidad(anualidadId: string) {
  return q1<{ id: string; estado: EstadoRenovacion }>('SELECT id, estado FROM renovaciones WHERE anualidad_id = $1', [anualidadId]);
}
