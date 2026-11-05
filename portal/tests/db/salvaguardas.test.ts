// Salvaguardas del redactor (#94): ningún dato de otro asunto ni jurisprudencia sin fuente en un borrador. Datos ficticios.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { referenciasNormativas, retirarJurisprudencia, retirarTrasvases } from '../../../src/portal/lib/salvaguardas.ts';

const MODELO = `AL JUZGADO DE PRIMERA INSTANCIA. D. Ernesto Villalba Ruiz, con DNI 12345678Z y domicilio en calle Mayor, 12, en autos 345/2019,
reclama 18.250,00 euros. Conforme a la Ley 1/2000, de 7 de enero, y al artículo 86 del Código Civil. Cuenta ES91 2100 0418 4502 0005 1332.`;
const CASO = 'Cliente: Ximena Ficticia. Nota: la clienta reclama 3.000,00 euros. Procedimiento 77/2026 del Juzgado n.º 4.';

test('retira los datos identificables que vienen de un modelo y no constan en el expediente', () => {
  const borrador = `D. Ernesto Villalba Ruiz, con DNI 12345678Z, en autos 345/2019, reclama 18.250,00 euros (cuenta ES91 2100 0418 4502 0005 1332).
Doña Ximena Ficticia reclama 3.000,00 euros en el procedimiento 77/2026, conforme a la Ley 1/2000.`;
  const r = retirarTrasvases(borrador, MODELO, CASO);
  for (const ajeno of ['Ernesto Villalba', '12345678Z', '345/2019', '18.250,00', 'ES91 2100']) assert.ok(!r.texto.includes(ajeno), `se ha retirado ${ajeno}`);
  assert.ok(r.texto.includes('Ximena Ficticia') && r.texto.includes('3.000,00 euros') && r.texto.includes('77/2026'), 'lo del propio expediente se conserva');
  assert.ok(r.texto.includes('Ley 1/2000'), 'el número de una ley no es un número de autos');
  assert.ok(r.texto.includes('[PENDIENTE: dato de otro asunto retirado]'));
  assert.ok(r.retirados.length >= 5);
});

test('un dato que está en el modelo y también en el expediente no se retira', () => {
  const r = retirarTrasvases('Se reclaman 18.250,00 euros.', MODELO, `${CASO} Importe acreditado: 18.250,00 euros.`);
  assert.equal(r.texto, 'Se reclaman 18.250,00 euros.');
});

test('la jurisprudencia que no figura en ninguna fuente se retira; la que consta, no', () => {
  const fuentes = 'Modelo: según la STS 123/2020 y ECLI:ES:TS:2020:1234, procede…';
  const r = retirarJurisprudencia('Cita la STS 123/2020, la STS 999/2024, ECLI:ES:TS:2020:1234 y ECLI:ES:TS:2023:9999.', fuentes);
  assert.ok(r.texto.includes('STS 123/2020') && r.texto.includes('ECLI:ES:TS:2020:1234'));
  assert.ok(!r.texto.includes('999/2024') && !r.texto.includes('2023:9999'));
  assert.deepEqual(r.retiradas.length, 2);
});

test('lista las referencias normativas para marcarlas sin verificar', () => {
  const n = referenciasNormativas('Conforme al artículo 86 del Código Civil, la Ley 1/2000 y el art. 770 LEC, y la Ley Orgánica 1/2025.');
  assert.ok(n.some((x) => /art[ií]culo 86/.test(x)));
  assert.ok(n.includes('Ley 1/2000'));
  assert.ok(n.some((x) => /770/.test(x)));
  assert.ok(n.includes('Ley Orgánica 1/2025'));
});
