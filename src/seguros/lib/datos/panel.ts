import { q, type Db, pool } from '../db';
import type { Usuario } from '../auth/sesiones';
import { esUuid, filtroSql, titularesPermitidos } from '../acceso';
import { costeAnual, type CosteAnual } from '../dinero';
import { diasEntre, hoyMadrid, sumarMeses } from '../fechas';
import { prevision } from './recibos';

export type Filtros = {
  ambito?: 'todos' | 'empresas' | 'particulares';
  titular?: string;
  ramo?: string;
  aseguradora?: string;
  estado?: 'todos' | 'proximas' | 'vencidas' | 'sin_fecha' | 'negociacion' | 'revisar' | 'anuladas' | 'archivadas';
  desde?: string;
  hasta?: string;
  q?: string;
  orden?: 'vencimiento' | 'coste' | 'titular' | 'cobro';
  agrupar?: 'titular' | 'ramo';
};

export type Situacion = 'vigente' | 'proxima' | 'vencida' | 'sin_fecha' | 'negociacion' | 'anulada' | 'sustituida';

export type FilaPanel = {
  id: string; nombre: string; riesgo: string | null; aseguradora: string; numero: string | null; moneda: string;
  estado: string; archivada: boolean;
  titular_id: string; titular_nombre: string; titular_tipo: 'empresa' | 'particular';
  ramo_clave: string; ramo_nombre: string; ramo_icono: string;
  mediador: string | null; mediador_telefono: string | null; asistencia_telefono: string | null;
  anualidad_id: string | null; inicio: string | null; fin: string | null;
  prima_anual: string | null; periodicidad: string | null; importe_recibo: string | null;
  plazo_oposicion: string | null; plazo_oposicion_confirmado: boolean; datos_confirmados: boolean;
  documentos: number;
  avisos_pendientes: number;
  // Calculados
  coste: CosteAnual;
  proximo_cobro: { fecha: string | null; mes: string; importe: string; tipo: 'confirmado' | 'estimado' } | null;
  dias: number | null;
  situacion: Situacion;
};

/**
 * Anualidad «actual» de cada póliza: la que contiene hoy; si no hay, la de inicio más reciente
 * (una anualidad con fechas pendientes se considera la más reciente).
 */
const SQL_PANEL = (filtroTitular: string) => `
  SELECT p.id, p.nombre, p.riesgo, p.aseguradora, p.numero, p.moneda, p.estado, (p.archivada_en IS NOT NULL) AS archivada,
         p.mediador, p.mediador_telefono, p.asistencia_telefono,
         t.id AS titular_id, t.nombre AS titular_nombre, t.tipo AS titular_tipo,
         r.clave AS ramo_clave, r.nombre AS ramo_nombre, r.icono AS ramo_icono,
         a.id AS anualidad_id, a.inicio, a.fin, a.prima_anual, a.periodicidad, a.importe_recibo,
         a.plazo_oposicion, coalesce(a.plazo_oposicion_confirmado, false) AS plazo_oposicion_confirmado,
         coalesce(a.datos_confirmados, false) AS datos_confirmados,
         (SELECT count(*)::int FROM documentos d WHERE d.poliza_id = p.id AND d.eliminado_en IS NULL) AS documentos,
         (SELECT count(*)::int FROM avisos v WHERE v.poliza_id = p.id AND v.estado = 'emitido') AS avisos_pendientes
    FROM polizas p
    JOIN titulares t ON t.id = p.titular_id
    JOIN ramos r ON r.id = p.ramo_id
    LEFT JOIN LATERAL (
      SELECT * FROM anualidades x WHERE x.poliza_id = p.id AND x.anulada_en IS NULL
       ORDER BY (x.inicio <= $1::date AND (x.fin IS NULL OR x.fin > $1::date)) DESC NULLS LAST,
                x.inicio DESC NULLS FIRST, x.creada_en DESC
       LIMIT 1) a ON TRUE
   WHERE ${filtroTitular}`;

export function situacion(f: Pick<FilaPanel, 'estado' | 'fin'>, hoy: string): { situacion: Situacion; dias: number | null } {
  const dias = f.fin ? diasEntre(hoy, f.fin) : null;
  if (f.estado === 'anulada') return { situacion: 'anulada', dias };
  if (f.estado === 'sustituida') return { situacion: 'sustituida', dias };
  if (!f.fin) return { situacion: 'sin_fecha', dias };
  if (f.fin < hoy) return { situacion: 'vencida', dias };
  if (f.estado === 'en_negociacion') return { situacion: 'negociacion', dias };
  // Próxima: vence dentro del próximo mes natural (misma regla que el aviso principal, #4).
  if (f.fin <= sumarMeses(hoy, 1)) return { situacion: 'proxima', dias };
  return { situacion: 'vigente', dias };
}

export async function panel(u: Usuario, f: Filtros = {}, hoy = hoyMadrid(), db: Db = pool()) {
  const params: unknown[] = [hoy];
  const filtroTitular = filtroSql(await titularesPermitidos(u, db), 't.id', params);
  // Próximo cobro: el primer recibo pendiente o previsto con fecha, o la estimación del mes (sin día) si no hay recibo.
  const previstos = await prevision(u, { desde: hoy.slice(0, 7), meses: 14 }, db);
  const proximo = new Map<string, FilaPanel['proximo_cobro']>();
  for (const x of previstos) {
    if (x.tipo === 'pagado' || proximo.has(x.poliza_id)) continue;
    if (x.fecha && x.fecha < hoy) continue;
    proximo.set(x.poliza_id, { fecha: x.fecha, mes: x.mes, importe: x.importe, tipo: x.tipo });
  }
  const todas = (await q<Omit<FilaPanel, 'coste' | 'dias' | 'situacion' | 'proximo_cobro'>>(SQL_PANEL(filtroTitular), params, db)).map((fila) => ({
    ...fila,
    coste: costeAnual(fila),
    proximo_cobro: proximo.get(fila.id) ?? null,
    ...situacion(fila, hoy),
  })) as FilaPanel[];

  const texto = f.q?.trim().toLowerCase();
  const visibles = todas.filter((p) => {
    if (f.estado === 'archivadas') { if (!p.archivada) return false; }
    else if (p.archivada) return false;
    if (f.ambito === 'empresas' && p.titular_tipo !== 'empresa') return false;
    if (f.ambito === 'particulares' && p.titular_tipo !== 'particular') return false;
    if (f.titular && esUuid(f.titular) && p.titular_id !== f.titular) return false;
    if (f.ramo && p.ramo_clave !== f.ramo) return false;
    if (f.aseguradora && p.aseguradora.toLowerCase() !== f.aseguradora.toLowerCase()) return false;
    if (f.desde && (!p.fin || p.fin < f.desde)) return false;
    if (f.hasta && (!p.fin || p.fin > f.hasta)) return false;
    switch (f.estado) {
      case 'proximas': if (p.situacion !== 'proxima' && !(p.situacion === 'negociacion' && p.dias !== null && p.fin! <= sumarMeses(hoy, 1))) return false; break;
      case 'vencidas': if (p.situacion !== 'vencida') return false; break;
      case 'sin_fecha': if (p.situacion !== 'sin_fecha') return false; break;
      case 'negociacion': if (p.estado !== 'en_negociacion') return false; break;
      case 'revisar': if (p.datos_confirmados) return false; break;
      case 'anuladas': if (p.situacion !== 'anulada' && p.situacion !== 'sustituida') return false; break;
      case 'archivadas': break;
      default: if (p.situacion === 'anulada' || p.situacion === 'sustituida') return false;
    }
    if (texto) {
      const pajar = [p.nombre, p.riesgo, p.aseguradora, p.numero, p.titular_nombre, p.ramo_nombre, p.mediador].filter(Boolean).join(' ').toLowerCase();
      if (!texto.split(/\s+/).every((t) => pajar.includes(t))) return false;
    }
    return true;
  });

  const orden = f.orden ?? 'vencimiento';
  visibles.sort((a, b) => {
    if (orden === 'coste') return (b.coste?.centimos ?? -1) - (a.coste?.centimos ?? -1);
    if (orden === 'titular') return a.titular_nombre.localeCompare(b.titular_nombre, 'es') || a.nombre.localeCompare(b.nombre, 'es');
    if (orden === 'cobro') {
      const ca = a.proximo_cobro ? a.proximo_cobro.fecha ?? `${a.proximo_cobro.mes}-99` : '9999';
      const cb = b.proximo_cobro ? b.proximo_cobro.fecha ?? `${b.proximo_cobro.mes}-99` : '9999';
      return ca.localeCompare(cb) || a.nombre.localeCompare(b.nombre, 'es');
    }
    // Vencimiento: primero las fechas más cercanas; las pendientes al final.
    if (a.fin === b.fin) return a.nombre.localeCompare(b.nombre, 'es');
    if (!a.fin) return 1;
    if (!b.fin) return -1;
    return a.fin < b.fin ? -1 : 1;
  });

  return { filas: visibles, resumen: resumir(visibles), opciones: opciones(todas.filter((p) => !p.archivada)) };
}

export type Resumen = {
  totales: { moneda: string; centimos: number; estimado: boolean }[];
  porTitular: { titular_id: string; nombre: string; tipo: string; moneda: string; centimos: number }[];
  porRamo: { clave: string; nombre: string; moneda: string; centimos: number }[];
  activas: number; conImporte: number; proximas: number; vencidas: number; sinFecha: number; revisar: number; negociacion: number;
};

/** Totales del gasto activo: excluye anuladas, sustituidas y vencidas sin renovación registrada. Monedas por separado. */
export function resumir(filas: FilaPanel[]): Resumen {
  const activas = filas.filter((p) => !p.archivada && ['vigente', 'proxima', 'negociacion', 'sin_fecha'].includes(p.situacion));
  const totales = new Map<string, { centimos: number; estimado: boolean }>();
  const porTitular = new Map<string, Resumen['porTitular'][number]>();
  const porRamo = new Map<string, Resumen['porRamo'][number]>();
  for (const p of activas) {
    if (!p.coste) continue;
    const t = totales.get(p.moneda) ?? { centimos: 0, estimado: false };
    t.centimos += p.coste.centimos;
    t.estimado ||= p.coste.tipo === 'estimado';
    totales.set(p.moneda, t);
    const kt = `${p.titular_id}|${p.moneda}`;
    const xt = porTitular.get(kt) ?? { titular_id: p.titular_id, nombre: p.titular_nombre, tipo: p.titular_tipo, moneda: p.moneda, centimos: 0 };
    xt.centimos += p.coste.centimos;
    porTitular.set(kt, xt);
    const kr = `${p.ramo_clave}|${p.moneda}`;
    const xr = porRamo.get(kr) ?? { clave: p.ramo_clave, nombre: p.ramo_nombre, moneda: p.moneda, centimos: 0 };
    xr.centimos += p.coste.centimos;
    porRamo.set(kr, xr);
  }
  return {
    totales: [...totales].map(([moneda, v]) => ({ moneda, ...v })).sort((a, b) => (a.moneda === 'EUR' ? -1 : b.moneda === 'EUR' ? 1 : a.moneda.localeCompare(b.moneda))),
    porTitular: [...porTitular.values()].sort((a, b) => b.centimos - a.centimos),
    porRamo: [...porRamo.values()].sort((a, b) => b.centimos - a.centimos),
    activas: activas.length,
    conImporte: activas.filter((p) => p.coste).length,
    proximas: filas.filter((p) => p.situacion === 'proxima').length,
    vencidas: filas.filter((p) => p.situacion === 'vencida').length,
    sinFecha: filas.filter((p) => p.situacion === 'sin_fecha').length,
    revisar: filas.filter((p) => !p.datos_confirmados && !['anulada', 'sustituida'].includes(p.situacion)).length,
    negociacion: filas.filter((p) => p.estado === 'en_negociacion').length,
  };
}

function opciones(filas: FilaPanel[]) {
  const titulares = new Map<string, { id: string; nombre: string; tipo: string }>();
  const ramos = new Map<string, string>();
  const aseguradoras = new Set<string>();
  for (const p of filas) {
    titulares.set(p.titular_id, { id: p.titular_id, nombre: p.titular_nombre, tipo: p.titular_tipo });
    ramos.set(p.ramo_clave, p.ramo_nombre);
    aseguradoras.add(p.aseguradora);
  }
  return {
    titulares: [...titulares.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    ramos: [...ramos].map(([clave, nombre]) => ({ clave, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    aseguradoras: [...aseguradoras].sort((a, b) => a.localeCompare(b, 'es')),
  };
}
