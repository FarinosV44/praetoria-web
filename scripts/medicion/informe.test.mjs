import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { enMarkdown, informe, parseCsv } from './informe.mjs';

test('el informe agrega consultas sin datos personales', () => {
  const filas = parseCsv(readFileSync('tests/fixtures/consultas-ejemplo.csv', 'utf8'));
  assert.equal(filas.length, 4);
  assert.equal(filas[1].mensaje, 'Texto "ficticio"'); // CSV con comillas
  const inf = informe(filas);
  assert.equal(inf.total, 3);
  assert.equal(inf.duplicadas, 1);
  assert.deepEqual(inf.por.area[0], ['Laboral', 2]);
  assert.deepEqual(inf.por.mes[0], ['2026-11', 2]);
  assert.deepEqual(inf.por.utm_source.find(([v]) => v === '(sin dato)'), ['(sin dato)', 1]);
  const md = enMarkdown(inf);
  for (const pii of ['Ficticia', 'example.com', '60000000', 'Texto ficticio']) assert.ok(!md.includes(pii), pii);
});
