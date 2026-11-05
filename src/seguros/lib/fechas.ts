// Fechas de calendario ('YYYY-MM-DD') en la zona Europe/Madrid. Sin horas: evita desfases.
export const ZONA = 'Europe/Madrid';

/** Hoy en Madrid como 'YYYY-MM-DD'. */
export function hoyMadrid(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);
}

const partes = (f: string) => f.split('-').map(Number) as [number, number, number];
const aUTC = (f: string) => { const [y, m, d] = partes(f); return Date.UTC(y, m - 1, d); };
const deUTC = (t: number) => new Date(t).toISOString().slice(0, 10);

export function esFecha(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = partes(v);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

export const diasEntre = (desde: string, hasta: string) => Math.round((aUTC(hasta) - aUTC(desde)) / 86400_000);
export const sumarDias = (f: string, n: number) => deUTC(aUTC(f) + n * 86400_000);

const diasDelMes = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m: 1-12

/**
 * Suma (o resta) meses naturales. Si el día no existe en el mes destino se usa el último día válido:
 * 31-03 − 1 mes = 28-02 (29-02 en bisiesto). Regla del aviso «un mes natural antes» (#4).
 */
export function sumarMeses(f: string, n: number): string {
  const [y, m, d] = partes(f);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const nd = Math.min(d, diasDelMes(ny, nm));
  return `${ny}-${String(nm).padStart(2, '0')}-${String(nd).padStart(2, '0')}`;
}

export const sumarAnios = (f: string, n: number) => sumarMeses(f, 12 * n);

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];

/** «5 de noviembre de 2026» */
export function fechaLarga(f: string | null | undefined) {
  if (!f) return '';
  const [y, m, d] = partes(f);
  return `${d} de ${MESES[m - 1]} de ${y}`;
}

/** «05/11/2026» */
export function fechaCorta(f: string | null | undefined) {
  if (!f) return '';
  const [y, m, d] = partes(f);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

/** «5 nov 2026» */
export function fechaMedia(f: string | null | undefined) {
  if (!f) return '';
  const [y, m, d] = partes(f);
  return `${d} ${MESES_CORTOS[m - 1]} ${y}`;
}

/** Texto relativo de días restantes: «hoy», «mañana», «en 12 días», «hace 3 días». */
export function textoDias(n: number) {
  if (n === 0) return 'hoy';
  if (n === 1) return 'mañana';
  if (n === -1) return 'ayer';
  return n > 0 ? `en ${n} días` : `hace ${-n} días`;
}
