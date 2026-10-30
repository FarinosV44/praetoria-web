// Cálculo orientativo de la indemnización por despido (calculadora pública).
// Reglas: artículo 56.1 ET (improcedente: 33 días por año, máximo 24 mensualidades), disposición transitoria
// undécima de la Ley 3/2012 (contratos anteriores al 12/02/2012: 45 días por año hasta esa fecha, máximo 720 días
// salvo que el periodo anterior ya supere esa cifra, con un máximo absoluto de 42 mensualidades) y artículo 53.1.b ET
// (objetivo: 20 días por año, máximo 12 mensualidades). Los periodos inferiores al año se prorratean por meses,
// y la fracción de mes cuenta como mes completo. Salario diario = salario bruto anual (con pagas extra) / 365.

export type TipoDespido = 'improcedente' | 'objetivo';

export type EntradaIndemnizacion = {
  /** Fecha de inicio de la relación laboral (AAAA-MM-DD) */
  inicio: string;
  /** Fecha del despido (AAAA-MM-DD) */
  fin: string;
  /** Salario bruto anual, incluidas las pagas extraordinarias, en euros */
  salarioAnual: number;
  tipo: TipoDespido;
};

export type TramoIndemnizacion = { desde: string; hasta: string; meses: number; diasPorAno: number; dias: number };

export type ResultadoIndemnizacion = {
  salarioDiario: number;
  mesesTotales: number;
  tramos: TramoIndemnizacion[];
  /** Días de salario antes de aplicar el tope */
  diasSinTope: number;
  /** Tope aplicable, en días de salario */
  tope: number;
  /** Días de salario finalmente indemnizables */
  dias: number;
  topeAplicado: boolean;
  importe: number;
};

export const REFORMA_2012 = '2012-02-12';

const parse = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!));
  return d.getUTCFullYear() === +m[1]! && d.getUTCMonth() === +m[2]! - 1 && d.getUTCDate() === +m[3]! ? d : null;
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Meses de servicio entre dos fechas (ambas incluidas); la fracción de mes cuenta como mes completo. */
export function mesesDeServicio(desde: Date, hasta: Date): number {
  if (hasta < desde) return 0;
  // Día siguiente al último día trabajado: así un periodo del 1 de marzo al 28 de febrero es un año exacto
  const finExclusivo = new Date(hasta.getTime() + 86_400_000);
  let meses = (finExclusivo.getUTCFullYear() - desde.getUTCFullYear()) * 12 + (finExclusivo.getUTCMonth() - desde.getUTCMonth());
  const ancla = new Date(Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth() + meses, desde.getUTCDate()));
  if (ancla > finExclusivo) {
    meses -= 1;
  }
  const completo = new Date(Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth() + meses, desde.getUTCDate()));
  return completo < finExclusivo ? meses + 1 : meses;
}

const redondear = (n: number, decimales = 2) => Math.round(n * 10 ** decimales) / 10 ** decimales;

export type ErrorIndemnizacion = { error: string };

export function calcularIndemnizacion(e: EntradaIndemnizacion): ResultadoIndemnizacion | ErrorIndemnizacion {
  const inicio = parse(e.inicio);
  const fin = parse(e.fin);
  if (!inicio || !fin) return { error: 'Indica las dos fechas.' };
  if (fin < inicio) return { error: 'La fecha del despido no puede ser anterior a la de inicio.' };
  if (!Number.isFinite(e.salarioAnual) || e.salarioAnual <= 0) return { error: 'Indica el salario bruto anual.' };

  const salarioDiario = e.salarioAnual / 365;
  const reforma = parse(REFORMA_2012)!;
  const tramos: TramoIndemnizacion[] = [];

  if (e.tipo === 'improcedente' && inicio < reforma) {
    const finTramo1 = fin < reforma ? fin : new Date(reforma.getTime() - 86_400_000);
    const m1 = mesesDeServicio(inicio, finTramo1);
    tramos.push({ desde: iso(inicio), hasta: iso(finTramo1), meses: m1, diasPorAno: 45, dias: (m1 * 45) / 12 });
    if (fin >= reforma) {
      const m2 = mesesDeServicio(reforma, fin);
      tramos.push({ desde: REFORMA_2012, hasta: iso(fin), meses: m2, diasPorAno: 33, dias: (m2 * 33) / 12 });
    }
  } else {
    const m = mesesDeServicio(inicio, fin);
    const diasPorAno = e.tipo === 'improcedente' ? 33 : 20;
    tramos.push({ desde: iso(inicio), hasta: iso(fin), meses: m, diasPorAno, dias: (m * diasPorAno) / 12 });
  }

  const diasSinTope = tramos.reduce((t, x) => t + x.dias, 0);
  let tope: number;
  if (e.tipo === 'objetivo') tope = 12 * 30;
  else if (inicio < reforma) {
    const anteriores = tramos[0]!.dias;
    tope = anteriores > 720 ? Math.min(anteriores, 42 * 30) : 720;
  } else tope = 24 * 30;

  const dias = Math.min(diasSinTope, tope);
  return {
    salarioDiario: redondear(salarioDiario),
    mesesTotales: tramos.reduce((t, x) => t + x.meses, 0),
    tramos: tramos.map((t) => ({ ...t, dias: redondear(t.dias) })),
    diasSinTope: redondear(diasSinTope),
    tope,
    dias: redondear(dias),
    topeAplicado: diasSinTope > tope,
    importe: redondear(dias * salarioDiario),
  };
}
