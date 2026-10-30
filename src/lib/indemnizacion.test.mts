// node --test src/lib/indemnizacion.test.mts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularIndemnizacion, mesesDeServicio } from './indemnizacion.ts';

const d = (s: string) => new Date(`${s}T00:00:00Z`);

test('meses de servicio: la fracción de mes cuenta como mes completo', () => {
  assert.equal(mesesDeServicio(d('2020-03-01'), d('2021-02-28')), 12); // un año exacto
  assert.equal(mesesDeServicio(d('2020-03-01'), d('2021-03-01')), 13); // un día más: mes completo
  assert.equal(mesesDeServicio(d('2020-03-15'), d('2020-04-14')), 1);
  assert.equal(mesesDeServicio(d('2020-03-15'), d('2020-03-15')), 1);
  assert.equal(mesesDeServicio(d('2020-01-31'), d('2020-02-29')), 1);
});

test('improcedente posterior a la reforma: 33 días por año', () => {
  const r = calcularIndemnizacion({ inicio: '2016-01-01', fin: '2025-12-31', salarioAnual: 36500, tipo: 'improcedente' });
  assert.ok(!('error' in r));
  if ('error' in r) return;
  assert.equal(r.salarioDiario, 100);
  assert.equal(r.mesesTotales, 120);
  assert.equal(r.dias, 330); // 10 años × 33
  assert.equal(r.importe, 33000);
  assert.equal(r.topeAplicado, false);
});

test('improcedente: tope de 24 mensualidades (720 días)', () => {
  const r = calcularIndemnizacion({ inicio: '2013-01-01', fin: '2036-12-31', salarioAnual: 36500, tipo: 'improcedente' });
  if ('error' in r) throw new Error(r.error);
  assert.equal(r.diasSinTope, 792); // 24 años × 33
  assert.equal(r.dias, 720);
  assert.equal(r.topeAplicado, true);
});

test('objetivo: 20 días por año con tope de 12 mensualidades', () => {
  const r = calcularIndemnizacion({ inicio: '2020-01-01', fin: '2024-12-31', salarioAnual: 36500, tipo: 'objetivo' });
  if ('error' in r) throw new Error(r.error);
  assert.equal(r.dias, 100);
  assert.equal(r.importe, 10000);
  const largo = calcularIndemnizacion({ inicio: '2000-01-01', fin: '2024-12-31', salarioAnual: 36500, tipo: 'objetivo' });
  if ('error' in largo) throw new Error(largo.error);
  assert.equal(largo.dias, 360);
  assert.equal(largo.topeAplicado, true);
});

test('contrato anterior al 12/02/2012: 45 días hasta la reforma y 33 después', () => {
  const r = calcularIndemnizacion({ inicio: '2010-02-12', fin: '2014-02-11', salarioAnual: 36500, tipo: 'improcedente' });
  if ('error' in r) throw new Error(r.error);
  assert.equal(r.tramos.length, 2);
  assert.equal(r.tramos[0]!.meses, 24);
  assert.equal(r.tramos[0]!.dias, 90); // 2 años × 45
  assert.equal(r.tramos[1]!.meses, 24);
  assert.equal(r.tramos[1]!.dias, 66); // 2 años × 33
  assert.equal(r.dias, 156);
});

test('contrato anterior a 2012 con más de 720 días en el primer tramo: ese es el tope, hasta 42 mensualidades', () => {
  // 20 años antes de la reforma: 900 días; después, 10 años más
  const r = calcularIndemnizacion({ inicio: '1992-02-12', fin: '2022-02-11', salarioAnual: 36500, tipo: 'improcedente' });
  if ('error' in r) throw new Error(r.error);
  assert.equal(r.tramos[0]!.dias, 900);
  assert.equal(r.tope, 900);
  assert.equal(r.dias, 900);
  const muyLargo = calcularIndemnizacion({ inicio: '1980-02-12', fin: '2022-02-11', salarioAnual: 36500, tipo: 'improcedente' });
  if ('error' in muyLargo) throw new Error(muyLargo.error);
  assert.equal(muyLargo.tope, 1260); // 42 mensualidades
  assert.equal(muyLargo.dias, 1260);
});

test('errores de entrada', () => {
  assert.ok('error' in calcularIndemnizacion({ inicio: '', fin: '2024-01-01', salarioAnual: 20000, tipo: 'objetivo' }));
  assert.ok('error' in calcularIndemnizacion({ inicio: '2024-02-01', fin: '2024-01-01', salarioAnual: 20000, tipo: 'objetivo' }));
  assert.ok('error' in calcularIndemnizacion({ inicio: '2020-01-01', fin: '2024-01-01', salarioAnual: 0, tipo: 'objetivo' }));
});
