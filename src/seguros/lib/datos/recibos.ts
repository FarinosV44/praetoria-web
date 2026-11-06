import { z } from 'zod';
import { q, q1, type Db, pool } from '../db';
import type { Usuario } from '../auth/sesiones';
import { esUuid, exigirPoliza, filtroSql, titularesPermitidos } from '../acceso';
import { auditar } from '../auditoria';
import { Invalido, NoEncontrado } from '../errores';
import { fechaOpc, importeOpc, textoOpc, validar } from '../validacion';
import { hoyMadrid, sumarMeses } from '../fechas';
import { aCentimos, deCentimos, PERIODICIDADES } from '../dinero';

/**
 * Recibos y pagos. Un recibo emitido no es un pago: solo cuenta como pagado con fecha de pago (un justificante o
 * una confirmación expresa). Los duplicados se evitan por número de recibo o por periodo e importe.
 */
export const ESTADOS_RECIBO = { previsto: 'Previsto', pendiente: 'Pendiente de cobro', pagado: 'Pagado', devuelto: 'Devuelto', anulado: 'Anulado' } as const;
export type EstadoRecibo = keyof typeof ESTADOS_RECIBO;

export type Recibo = {
  id: string; poliza_id: string; anualidad_id: string | null; numero: string | null;
  periodo_desde: string | null; periodo_hasta: string | null; fecha_cargo: string | null; fecha_pago: string | null;
  importe: string | null; periodicidad: string | null; estado: EstadoRecibo; documento_id: string | null; justificante_id: string | null;
  documento_nombre: string | null; justificante_nombre: string | null; origen: 'ia' | 'manual'; revisado: boolean; notas: string | null;
  subida: number | null;   // % respecto al recibo anterior de la misma periodicidad (null si no hay con qué comparar)
};

export async function listarRecibos(u: Usuario, polizaId: string, db: Db = pool()): Promise<Recibo[]> {
  await exigirPoliza(u, polizaId, db);
  const filas = await q<Omit<Recibo, 'subida'>>(
    `SELECT r.id, r.poliza_id, r.anualidad_id, r.numero, r.periodo_desde, r.periodo_hasta, r.fecha_cargo, r.fecha_pago, r.importe, r.periodicidad,
            r.estado, r.documento_id, r.justificante_id, d.nombre_original AS documento_nombre, j.nombre_original AS justificante_nombre, r.origen, r.revisado, r.notas
       FROM recibos r LEFT JOIN documentos d ON d.id = r.documento_id LEFT JOIN documentos j ON j.id = r.justificante_id
      WHERE r.poliza_id = $1
      ORDER BY coalesce(r.fecha_cargo, r.periodo_desde, r.fecha_pago) DESC NULLS LAST, r.creado_en DESC`, [polizaId], db);
  // Histórico de importes: variación frente al recibo anterior de la misma periodicidad (sin anulados).
  const validos = filas.filter((f) => f.estado !== 'anulado' && f.importe).slice().reverse();
  const subida = new Map<string, number>();
  for (let i = 1; i < validos.length; i++) {
    const act = validos[i]!, prev = validos.slice(0, i).reverse().find((p) => p.periodicidad === act.periodicidad);
    if (prev && Number(prev.importe) > 0) subida.set(act.id, Math.round(((Number(act.importe) - Number(prev.importe)) / Number(prev.importe)) * 1000) / 10);
  }
  return filas.map((f) => ({ ...f, subida: subida.get(f.id) ?? null }));
}

const esquema = z.object({
  numero: textoOpc(60), periodo_desde: fechaOpc, periodo_hasta: fechaOpc, fecha_cargo: fechaOpc, fecha_pago: fechaOpc,
  importe: importeOpc, periodicidad: z.preprocess((v) => v || null, z.enum(['anual', 'semestral', 'trimestral', 'mensual', 'unica']).nullable()),
  estado: z.enum(['previsto', 'pendiente', 'pagado', 'devuelto', 'anulado'], { error: 'Estado no válido.' }),
  documento_id: z.preprocess((v) => v || null, z.string().uuid().nullable()),
  justificante_id: z.preprocess((v) => v || null, z.string().uuid().nullable()),
  notas: textoOpc(1000),
}).superRefine((d, ctx) => {
  if (d.estado === 'pagado' && !d.fecha_pago) ctx.addIssue({ code: 'custom', path: ['fecha_pago'], message: 'Para marcarlo como pagado indica la fecha real de pago.' });
  if (d.periodo_desde && d.periodo_hasta && d.periodo_hasta <= d.periodo_desde) ctx.addIssue({ code: 'custom', path: ['periodo_hasta'], message: 'El periodo debe terminar después de empezar.' });
});

async function documentoDe(polizaId: string, id: string | null, db: Db) {
  if (id && !(await q1('SELECT 1 FROM documentos WHERE id = $1 AND poliza_id = $2 AND eliminado_en IS NULL', [id, polizaId], db))) throw new Invalido({ documento_id: 'El documento no es de este seguro.' });
}

async function anualidadDe(polizaId: string, fecha: string | null, db: Db) {
  if (!fecha) return null;
  return (await q1<{ id: string }>(`SELECT id FROM anualidades WHERE poliza_id = $1 AND anulada_en IS NULL AND inicio <= $2 AND (fin IS NULL OR fin > $2) ORDER BY inicio DESC LIMIT 1`, [polizaId, fecha], db))?.id ?? null;
}

const duplicado = (e: unknown) => (e as { code?: string }).code === '23505'
  ? new Invalido({ numero: 'Ya hay un recibo con ese número, o con el mismo periodo e importe, en este seguro.' }) : e;

export async function guardarRecibo(u: Usuario, polizaId: string, reciboId: string | null, datos: Record<string, unknown>, db: Db = pool()) {
  const titular = await exigirPoliza(u, polizaId, db);
  const d = validar(esquema, datos);
  await documentoDe(polizaId, d.documento_id, db);
  await documentoDe(polizaId, d.justificante_id, db);
  const anualidad = await anualidadDe(polizaId, d.periodo_desde ?? d.fecha_cargo, db);
  const valores = [d.numero, d.periodo_desde, d.periodo_hasta, d.fecha_cargo, d.fecha_pago, d.importe, d.periodicidad, d.estado, d.documento_id, d.justificante_id, d.notas, anualidad];
  try {
    if (reciboId) {
      if (!esUuid(reciboId)) throw new NoEncontrado('recibo');
      const r = await q1<{ id: string }>(
        `UPDATE recibos SET numero=$3, periodo_desde=$4, periodo_hasta=$5, fecha_cargo=$6, fecha_pago=$7, importe=$8, periodicidad=$9, estado=$10,
           documento_id=$11, justificante_id=$12, notas=$13, anualidad_id=$14, revisado = true, actualizado_en = now()
         WHERE id = $1 AND poliza_id = $2 RETURNING id`, [reciboId, polizaId, ...valores], db);
      if (!r) throw new NoEncontrado('recibo');
      await auditar(u.id, 'recibo_modificado', 'recibo', reciboId, titular, { estado: d.estado }, db);
      return reciboId;
    }
    const r = await q1<{ id: string }>(
      `INSERT INTO recibos (poliza_id, numero, periodo_desde, periodo_hasta, fecha_cargo, fecha_pago, importe, periodicidad, estado, documento_id, justificante_id, notas, anualidad_id, origen, revisado, creado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'manual',true,$14) RETURNING id`, [polizaId, ...valores, u.id], db);
    await auditar(u.id, 'recibo_creado', 'recibo', r!.id, titular, { estado: d.estado }, db);
    return r!.id;
  } catch (e) { throw duplicado(e); }
}

/**
 * Recibo leído por la IA en un documento. Si ya existe (mismo número, o mismo periodo e importe) se completa; un
 * justificante de pago solo marca «pagado» con la fecha real de pago leída en él. Nunca baja un estado ya pagado.
 */
export async function reciboDesdeDocumento(polizaId: string, r: {
  numero: string | null; periodo_desde: string | null; periodo_hasta: string | null; fecha_cargo: string | null; fecha_pago: string | null;
  importe: string | null; periodicidad: string | null; acredita_pago: boolean; documento_id: string | null; es_justificante: boolean;
}, db: Db = pool()): Promise<{ id: string; accion: 'creado' | 'completado' | 'sin_cambios' }> {
  const existente = await q1<{ id: string; estado: string; fecha_pago: string | null }>(
    `SELECT id, estado, fecha_pago FROM recibos WHERE poliza_id = $1 AND estado <> 'anulado' AND (
        ($2::text IS NOT NULL AND numero = $2) OR ($3::date IS NOT NULL AND $4::numeric IS NOT NULL AND periodo_desde = $3 AND importe = $4)
        OR ($2::text IS NULL AND $3::date IS NULL AND $5::date IS NOT NULL AND fecha_cargo = $5 AND importe = $4))
      ORDER BY creado_en LIMIT 1`, [polizaId, r.numero, r.periodo_desde, r.importe, r.fecha_cargo], db);
  const pagado = r.acredita_pago && !!r.fecha_pago;
  if (existente) {
    const sets: string[] = [], vals: unknown[] = [];
    const poner = (col: string, v: unknown) => { vals.push(v); sets.push(`${col} = coalesce(${col}, $${vals.length + 1})`); };
    poner('numero', r.numero); poner('periodo_desde', r.periodo_desde); poner('periodo_hasta', r.periodo_hasta); poner('fecha_cargo', r.fecha_cargo);
    poner('importe', r.importe); poner('periodicidad', r.periodicidad);
    if (r.documento_id) { if (r.es_justificante) poner('justificante_id', r.documento_id); else poner('documento_id', r.documento_id); }
    if (pagado && existente.estado !== 'pagado') { vals.push(r.fecha_pago); sets.push(`fecha_pago = $${vals.length + 1}`, `estado = 'pagado'`, 'revisado = false'); }
    await q(`UPDATE recibos SET ${sets.join(', ')}, actualizado_en = now() WHERE id = $1`, [existente.id, ...vals], db);
    return { id: existente.id, accion: 'completado' };
  }
  const anualidad = await anualidadDe(polizaId, r.periodo_desde ?? r.fecha_cargo, db);
  const nuevo = await q1<{ id: string }>(
    `INSERT INTO recibos (poliza_id, anualidad_id, numero, periodo_desde, periodo_hasta, fecha_cargo, fecha_pago, importe, periodicidad, estado, documento_id, justificante_id, origen, revisado)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'ia',false) RETURNING id`,
    [polizaId, anualidad, r.numero, r.periodo_desde, r.periodo_hasta, r.fecha_cargo, pagado ? r.fecha_pago : null, r.importe, r.periodicidad,
      pagado ? 'pagado' : 'pendiente', r.es_justificante ? null : r.documento_id, r.es_justificante ? r.documento_id : null], db);
  return { id: nuevo!.id, accion: 'creado' };
}

// ---------------------------------------------------------------- Previsión de pagos

export type Previsto = {
  poliza_id: string; poliza: string; titular_id: string; titular: string; titular_tipo: string; ramo: string; aseguradora: string;
  mes: string;                      // YYYY-MM
  fecha: string | null;             // fecha exacta solo si consta (recibo con fecha de cargo); null en estimaciones
  importe: string; moneda: string;
  tipo: 'pagado' | 'confirmado' | 'estimado';  // pagado = acreditado; confirmado = recibo emitido/previsto con fecha; estimado = proyección
  recibo_id: string | null; estado: string | null; base: string;
};

const MESES_PERIODO: Record<string, number> = { anual: 12, semestral: 6, trimestral: 3, mensual: 1 };
const mesDe = (f: string) => f.slice(0, 7);

/**
 * Previsión de pagos de `meses` meses desde `desde` (YYYY-MM). Usa los recibos reales (pagados, pendientes o
 * previstos) y completa con estimaciones a partir de la periodicidad y el último importe conocido. Una estimación
 * nunca lleva día (solo el mes en que empezaría el periodo) y no se genera si ya hay un recibo real que cubre ese
 * periodo, para no contar dos veces el mismo cargo.
 */
export async function prevision(u: Usuario, opciones: { desde?: string; meses?: number; titularId?: string | null } = {}, db: Db = pool()): Promise<Previsto[]> {
  const desde = opciones.desde ?? mesDe(hoyMadrid());
  const meses = Math.min(Math.max(opciones.meses ?? 12, 1), 24);
  const inicio = `${desde}-01`, finExcl = sumarMeses(inicio, meses);
  const params: unknown[] = [];
  const filtro = filtroSql(await titularesPermitidos(u, db), 'p.titular_id', params);
  let extra = '';
  if (opciones.titularId) { params.push(opciones.titularId); extra = ` AND p.titular_id = $${params.length}`; }
  const polizas = await q<{ id: string; nombre: string; titular_id: string; titular: string; titular_tipo: string; ramo: string; aseguradora: string; moneda: string; estado: string; renovacion_automatica: boolean | null }>(
    `SELECT p.id, p.nombre, p.titular_id, t.nombre AS titular, t.tipo AS titular_tipo, r.nombre AS ramo, p.aseguradora, p.moneda, p.estado, p.renovacion_automatica
       FROM polizas p JOIN titulares t ON t.id = p.titular_id JOIN ramos r ON r.id = p.ramo_id
      WHERE p.archivada_en IS NULL AND ${filtro}${extra}`, params, db);
  if (!polizas.length) return [];
  const ids = polizas.map((p) => p.id);
  const recibos = await q<{ id: string; poliza_id: string; periodo_desde: string | null; periodo_hasta: string | null; fecha_cargo: string | null; fecha_pago: string | null; importe: string | null; periodicidad: string | null; estado: string }>(
    `SELECT id, poliza_id, periodo_desde, periodo_hasta, fecha_cargo, fecha_pago, importe, periodicidad, estado FROM recibos
      WHERE poliza_id = ANY($1::uuid[]) AND estado <> 'anulado'`, [ids], db);
  const anualidades = await q<{ poliza_id: string; inicio: string | null; fin: string | null; periodicidad: string | null; importe_recibo: string | null; prima_anual: string | null }>(
    `SELECT poliza_id, inicio, fin, periodicidad, importe_recibo, prima_anual FROM anualidades WHERE poliza_id = ANY($1::uuid[]) AND anulada_en IS NULL ORDER BY inicio`, [ids], db);

  const salida: Previsto[] = [];
  for (const p of polizas) {
    const base = { poliza_id: p.id, poliza: p.nombre, titular_id: p.titular_id, titular: p.titular, titular_tipo: p.titular_tipo, ramo: p.ramo, aseguradora: p.aseguradora, moneda: p.moneda };
    const suyos = recibos.filter((r) => r.poliza_id === p.id);
    // 1) Recibos reales en el rango
    for (const r of suyos) {
      const fecha = r.estado === 'pagado' ? r.fecha_pago : r.fecha_cargo;
      const ref = fecha ?? r.periodo_desde;
      if (!ref || !r.importe || ref < inicio || ref >= finExcl) continue;
      salida.push({ ...base, mes: mesDe(ref), fecha, importe: r.importe, tipo: r.estado === 'pagado' ? 'pagado' : 'confirmado', recibo_id: r.id, estado: r.estado,
        base: r.estado === 'pagado' ? 'Pago acreditado' : fecha ? 'Recibo con fecha de cobro' : 'Recibo sin fecha de cobro (mes del periodo)' });
    }
    // 2) Estimaciones: periodos sin recibo real, a partir de la periodicidad y el último importe conocido
    if (p.estado === 'anulada' || p.estado === 'sustituida') continue;
    const ultimoRecibo = suyos.filter((r) => r.importe).sort((a, b) => (b.periodo_desde ?? b.fecha_cargo ?? '').localeCompare(a.periodo_desde ?? a.fecha_cargo ?? ''))[0];
    const anualidadesP = anualidades.filter((a) => a.poliza_id === p.id && a.inicio);
    const ultima = anualidadesP[anualidadesP.length - 1];
    if (!ultima?.inicio) continue;
    const periodicidad = ultima.periodicidad ?? ultimoRecibo?.periodicidad ?? null;
    const pasos = periodicidad ? MESES_PERIODO[periodicidad] : undefined;
    if (!pasos) continue; // «única» o sin periodicidad: no se proyecta
    const importe = ultimoRecibo?.importe ?? ultima.importe_recibo
      ?? (ultima.prima_anual ? deCentimos(Math.round(aCentimos(ultima.prima_anual) / (PERIODICIDADES.find((x) => x.valor === periodicidad)?.recibosAnio ?? 1))) : null);
    if (!importe) continue;
    // Se proyecta desde el inicio del periodo de cobertura vigente, siguiendo la renovación tácita año a año.
    for (let f = ultima.inicio; f < finExcl; f = sumarMeses(f, pasos)) {
      if (p.renovacion_automatica === false && ultima.fin && f >= ultima.fin) break; // sin prórroga: no se proyecta más allá
      if (f < inicio) continue;
      const cubierto = suyos.some((r) => {
        const d = r.periodo_desde ?? r.fecha_cargo;
        if (!d) return false;
        const h = r.periodo_hasta ?? sumarMeses(d, pasos);
        return d <= f && f < h || mesDe(d) === mesDe(f);
      });
      if (cubierto) continue;
      salida.push({ ...base, mes: mesDe(f), fecha: null, importe, tipo: 'estimado', recibo_id: null, estado: null,
        base: `Estimado: ${periodicidad}, último importe conocido${ultimoRecibo ? ' (recibo)' : ' (póliza)'}` });
    }
  }
  return salida.sort((a, b) => a.mes.localeCompare(b.mes) || (a.fecha ?? '9').localeCompare(b.fecha ?? '9') || a.poliza.localeCompare(b.poliza));
}

/** Totales por mes, separando acreditado / confirmado / estimado. */
export function totalesPorMes(items: Previsto[]) {
  const m = new Map<string, { mes: string; pagado: number; confirmado: number; estimado: number }>();
  for (const i of items) {
    const t = m.get(i.mes) ?? { mes: i.mes, pagado: 0, confirmado: 0, estimado: 0 };
    t[i.tipo] += aCentimos(i.importe);
    m.set(i.mes, t);
  }
  return [...m.values()].sort((a, b) => a.mes.localeCompare(b.mes));
}

/** Últimos pagos y próximo cobro de una póliza (para la ficha y el panel). */
export async function situacionPagos(polizaId: string, db: Db = pool()) {
  const hoy = hoyMadrid();
  const ultimos = await q<{ id: string; fecha_pago: string; importe: string | null; periodo_desde: string | null; periodo_hasta: string | null }>(
    `SELECT id, fecha_pago, importe, periodo_desde, periodo_hasta FROM recibos WHERE poliza_id = $1 AND estado = 'pagado' ORDER BY fecha_pago DESC LIMIT 3`, [polizaId], db);
  const proximo = await q1<{ id: string; fecha_cargo: string | null; importe: string | null; estado: string; periodo_desde: string | null }>(
    `SELECT id, fecha_cargo, importe, estado, periodo_desde FROM recibos WHERE poliza_id = $1 AND estado IN ('pendiente', 'previsto', 'devuelto')
      ORDER BY coalesce(fecha_cargo, periodo_desde) NULLS LAST LIMIT 1`, [polizaId], db);
  return { ultimos, proximo, hoy };
}
