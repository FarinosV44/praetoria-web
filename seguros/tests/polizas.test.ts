import { beforeAll, describe, expect, it } from 'vitest';
import type { Usuario } from '../../src/seguros/lib/auth/sesiones';
import { actualizarAnualidad, anualidadesEnFecha, crearAnualidad, listarAnualidades, obtenerPoliza, crearPoliza } from '../../src/seguros/lib/datos/polizas';
import { panel, resumir } from '../../src/seguros/lib/datos/panel';
import { q } from '../../src/seguros/lib/db';
import { poliza, ramo, titular, usuario } from './ayudas';

describe('pólizas y anualidades (#1)', () => {
  let admin: Usuario, empresa: string;
  beforeAll(async () => {
    admin = await usuario('admin');
    empresa = await titular(admin, 'empresa', 'Empresa Sintética Anualidades');
  });

  it('renovar crea una anualidad nueva y conserva la anterior intacta', async () => {
    const id = await poliza(admin, empresa, { nombre: 'Flota sintética', inicio: '2025-03-01', fin: '2026-03-01', prima_anual: '1.000,00' });
    await crearAnualidad(admin, id, { inicio: '2026-03-01', fin: '2027-03-01', prima_anual: '1.100,00', periodicidad: 'anual' });
    const anualidades = await listarAnualidades(admin, id);
    expect(anualidades).toHaveLength(2);
    expect(anualidades.map((a) => a.prima_anual)).toEqual(['1100.00', '1000.00']);
    // El siniestro de 2025 consulta la anualidad anterior aunque ya se haya renovado.
    const en2025 = await anualidadesEnFecha(admin, id, '2025-10-10');
    expect(en2025).toHaveLength(1);
    expect(en2025[0]!.prima_anual).toBe('1000.00');
    // El vencimiento coincide con el inicio de la siguiente: el día 01-03-2026 pertenece a la nueva.
    expect((await anualidadesEnFecha(admin, id, '2026-03-01'))[0]!.prima_anual).toBe('1100.00');
  });

  it('rechaza anualidades solapadas y vencimientos anteriores al inicio', async () => {
    const id = await poliza(admin, empresa, { inicio: '2026-01-01', fin: '2027-01-01' });
    await expect(crearAnualidad(admin, id, { inicio: '2026-06-01', fin: '2027-06-01' })).rejects.toThrow(/Revisa/);
    await expect(crearAnualidad(admin, id, { inicio: '2027-02-01', fin: '2027-01-01' })).rejects.toThrow(/Revisa/);
  });

  it('importes y vencimientos desconocidos quedan pendientes, sin inventarse', async () => {
    const id = await crearPoliza(admin, { titular_id: empresa, ramo_id: await ramo('rc'), nombre: 'RC pendiente de documento', aseguradora: 'Ficticia Seguros' });
    const [a] = await listarAnualidades(admin, id);
    expect(a).toMatchObject({ inicio: null, fin: null, prima_anual: null, importe_recibo: null, periodicidad: null, datos_confirmados: false });
    const fila = (await panel(admin, { titular: empresa })).filas.find((f) => f.id === id)!;
    expect(fila.situacion).toBe('sin_fecha');
    expect(fila.coste).toBeNull();
  });

  it('exige fuente al confirmar el plazo de oposición', async () => {
    const id = await poliza(admin, empresa, { inicio: '2026-05-01', fin: '2027-05-01' });
    const [a] = await listarAnualidades(admin, id);
    await expect(actualizarAnualidad(admin, a!.id, { inicio: '2026-05-01', fin: '2027-05-01', plazo_oposicion: '2027-04-01', plazo_oposicion_confirmado: 'on' }))
      .rejects.toThrow(/Revisa/);
    await actualizarAnualidad(admin, a!.id, {
      inicio: '2026-05-01', fin: '2027-05-01', plazo_oposicion: '2027-04-01', plazo_oposicion_confirmado: 'on',
      plazo_oposicion_fuente: 'Condiciones generales sintéticas, art. 5, pág. 2',
    });
    const auditoria = await q<{ detalle: { cambios: Record<string, unknown> } }>(
      `SELECT detalle FROM auditoria WHERE entidad = 'anualidad' AND entidad_id = $1 AND accion = 'anualidad_modificada'`, [a!.id],
    );
    expect(Object.keys(auditoria[0]!.detalle.cambios)).toEqual(expect.arrayContaining(['plazo_oposicion', 'plazo_oposicion_confirmado']));
  });

  it('distingue titular, tomador, asegurado y beneficiario', async () => {
    const id = await poliza(admin, empresa, { tomador: 'Empresa Sintética Anualidades', asegurado: 'Conductor Inventado', beneficiario: 'Herederos legales' });
    const p = await obtenerPoliza(admin, id);
    expect([p.titular_nombre, p.tomador, p.asegurado, p.beneficiario]).toEqual(['Empresa Sintética Anualidades', 'Empresa Sintética Anualidades', 'Conductor Inventado', 'Herederos legales']);
  });
});

describe('panel: situación y totales (#3)', () => {
  let admin: Usuario, emp: string;
  beforeAll(async () => {
    admin = await usuario('admin');
    emp = await titular(admin, 'empresa', 'Empresa Sintética Panel');
  });

  it('marca próxima la que vence dentro del próximo mes natural, vencida la pasada', async () => {
    const proxima = await poliza(admin, emp, { inicio: '2025-12-20', fin: '2026-12-20' });
    const lejana = await poliza(admin, emp, { inicio: '2026-06-01', fin: '2027-06-01' });
    const vencida = await poliza(admin, emp, { inicio: '2025-10-01', fin: '2026-10-01' });
    const { filas } = await panel(admin, { titular: emp }, '2026-11-20');
    const s = (id: string) => filas.find((f) => f.id === id)!;
    expect(s(proxima).situacion).toBe('proxima');
    expect(s(proxima).dias).toBe(30);
    expect(s(lejana).situacion).toBe('vigente');
    expect(s(vencida).situacion).toBe('vencida');
    // Orden por vencimiento
    expect(filas.map((f) => f.fin)).toEqual([...filas.map((f) => f.fin)].sort((a, b) => (a === null ? 1 : b === null ? -1 : a < b ? -1 : 1)));
  });

  it('totales: mensual ×12, trimestral ×4, anual real; monedas por separado; excluye anuladas y vencidas', async () => {
    const base = { inicio: '2026-06-01', fin: '2027-06-01', prima_anual: '' };
    const emp2 = await titular(admin, 'empresa', 'Empresa Sintética Totales');
    await poliza(admin, emp2, { ...base, periodicidad: 'mensual', importe_recibo: '50,00' });
    await poliza(admin, emp2, { ...base, periodicidad: 'trimestral', importe_recibo: '100,00' });
    await poliza(admin, emp2, { ...base, prima_anual: '300,00', periodicidad: 'anual' });
    await poliza(admin, emp2, { ...base, prima_anual: '1.000,00', periodicidad: 'anual', moneda: 'USD' });
    await poliza(admin, emp2, { ...base, prima_anual: '999,00', estado: 'anulada' });
    await poliza(admin, emp2, { ...base, inicio: '2025-01-01', fin: '2026-01-01', prima_anual: '777,00' });
    await poliza(admin, emp2, { ...base, prima_anual: '', periodicidad: '' }); // sin importe
    const { filas, resumen } = await panel(admin, { titular: emp2 }, '2026-11-05');
    expect(resumen.totales).toEqual([
      { moneda: 'EUR', centimos: 60000 + 40000 + 30000, estimado: true },
      { moneda: 'USD', centimos: 100000, estimado: false },
    ]);
    expect(resumen.activas).toBe(5);
    expect(resumen.conImporte).toBe(4);
    expect(resumen.vencidas).toBe(1);
    expect(filas.some((f) => f.situacion === 'anulada')).toBe(false); // las anuladas salen solo con su filtro
    expect(resumir(filas).totales[0]!.centimos).toBe(130000);
  });
});
