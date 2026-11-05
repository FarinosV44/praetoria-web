import { describe, expect, it } from 'vitest';
import { diasEntre, esFecha, hoyMadrid, sumarMeses } from '../../src/seguros/lib/fechas';
import { costeAnual, leerImporte, formatoImporte } from '../../src/seguros/lib/dinero';

describe('fechas (Europe/Madrid)', () => {
  it('un mes natural antes ajusta al último día válido del mes', () => {
    expect(sumarMeses('2027-03-31', -1)).toBe('2027-02-28');
    expect(sumarMeses('2028-03-31', -1)).toBe('2028-02-29'); // bisiesto
    expect(sumarMeses('2027-03-30', -1)).toBe('2027-02-28');
    expect(sumarMeses('2027-05-31', -1)).toBe('2027-04-30');
    expect(sumarMeses('2027-01-15', -1)).toBe('2026-12-15');
    expect(sumarMeses('2026-12-31', 2)).toBe('2027-02-28');
  });
  it('hoy se calcula en hora de Madrid, no en UTC', () => {
    expect(hoyMadrid(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01'); // invierno, UTC+1
    expect(hoyMadrid(new Date('2026-07-31T22:30:00Z'))).toBe('2026-08-01'); // verano, UTC+2
    expect(hoyMadrid(new Date('2026-07-31T21:59:00Z'))).toBe('2026-07-31');
    // Cambio de hora (29-03-2026 y 25-10-2026): los días no se desplazan.
    expect(diasEntre('2026-03-28', '2026-03-30')).toBe(2);
    expect(diasEntre('2026-10-24', '2026-10-26')).toBe(2);
  });
  it('valida fechas reales', () => {
    expect(esFecha('2027-02-29')).toBe(false);
    expect(esFecha('2028-02-29')).toBe(true);
    expect(esFecha('2027-13-01')).toBe(false);
  });
});

describe('importes', () => {
  it('lee formato español e internacional sin perder céntimos', () => {
    expect(leerImporte('1.234,56')).toBe('1234.56');
    expect(leerImporte('1234,5')).toBe('1234.50');
    expect(leerImporte('1234.56')).toBe('1234.56');
    expect(leerImporte('1,234.56')).toBe('1234.56');
    expect(leerImporte('  ')).toBeNull();
    expect(leerImporte('12,345,6')).toBeUndefined();
    expect(leerImporte('-5')).toBeUndefined();
  });
  it('coste anual: prima real o recibo × número de recibos (estimado); nunca el recibo mensual como anual', () => {
    expect(costeAnual({ prima_anual: '600.00', importe_recibo: '50.00', periodicidad: 'mensual' })).toEqual({ centimos: 60000, tipo: 'real' });
    expect(costeAnual({ prima_anual: null, importe_recibo: '45.10', periodicidad: 'mensual' })).toEqual({ centimos: 54120, tipo: 'estimado' });
    expect(costeAnual({ prima_anual: null, importe_recibo: '100.00', periodicidad: 'trimestral' })).toEqual({ centimos: 40000, tipo: 'estimado' });
    expect(costeAnual({ prima_anual: null, importe_recibo: '100.00', periodicidad: null })).toBeNull();
    expect(costeAnual({ prima_anual: null, importe_recibo: null, periodicidad: 'anual' })).toBeNull();
  });
  it('formato monetario español', () => {
    expect(formatoImporte('1234.5').replace(/\s/g, ' ')).toBe('1.234,50 €');
  });
});
