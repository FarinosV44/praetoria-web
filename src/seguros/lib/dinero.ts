export type Periodicidad = 'anual' | 'semestral' | 'trimestral' | 'mensual' | 'unica';

export const PERIODICIDADES: { valor: Periodicidad; texto: string; recibosAnio: number }[] = [
  { valor: 'anual', texto: 'Anual', recibosAnio: 1 },
  { valor: 'semestral', texto: 'Semestral', recibosAnio: 2 },
  { valor: 'trimestral', texto: 'Trimestral', recibosAnio: 4 },
  { valor: 'mensual', texto: 'Mensual', recibosAnio: 12 },
  { valor: 'unica', texto: 'Pago único', recibosAnio: 1 },
];

export const textoPeriodicidad = (p: string | null | undefined) => PERIODICIDADES.find((x) => x.valor === p)?.texto ?? '';

/**
 * Convierte un importe escrito en formato español o internacional a texto decimal con dos cifras:
 * «1.234,56» → «1234.56»; «1234.5» → «1234.50»; «» → null. Devuelve undefined si no es válido.
 */
export function leerImporte(v: unknown): string | null | undefined {
  if (v === null || v === undefined) return null;
  let s = String(v).trim().replace(/\s|€/g, '');
  if (s === '') return null;
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(s)) s = s.replace(/,/g, '');
  else if (/^\d+,\d{1,2}$/.test(s)) s = s.replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return undefined;
  const [ent, dec = ''] = s.split('.');
  return `${BigInt(ent!)}.${dec.padEnd(2, '0')}`;
}

/** Céntimos enteros a partir de texto decimal (sin errores de coma flotante). */
export const aCentimos = (v: string) => { const [e, d = '0'] = v.split('.'); return Number(e) * 100 + Number(d.padEnd(2, '0').slice(0, 2)); };
export const deCentimos = (c: number) => `${Math.trunc(c / 100)}.${String(Math.abs(c % 100)).padStart(2, '0')}`;

export function formatoImporte(v: string | number | null | undefined, moneda = 'EUR') {
  if (v === null || v === undefined || v === '') return '';
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: moneda, minimumFractionDigits: 2, useGrouping: 'always' } as Intl.NumberFormatOptions).format(Number(v));
}

export type CosteAnual = { centimos: number; tipo: 'real' | 'estimado' } | null;

/**
 * Coste anual de una anualidad: la prima anual real si consta; si no, el recibo por el número de
 * recibos al año (estimado). Nunca se toma un recibo mensual como si fuese anual (#3).
 */
export function costeAnual(a: { prima_anual: string | null; importe_recibo: string | null; periodicidad: string | null }): CosteAnual {
  if (a.prima_anual !== null) return { centimos: aCentimos(a.prima_anual), tipo: 'real' };
  const p = PERIODICIDADES.find((x) => x.valor === a.periodicidad);
  if (a.importe_recibo !== null && p) return { centimos: aCentimos(a.importe_recibo) * p.recibosAnio, tipo: 'estimado' };
  return null;
}
