import { test } from 'node:test';
import assert from 'node:assert/strict';
import { claveCronValida } from '../../src/lib/cron-clave.ts';

const buena = 'a'.repeat(32);

test('la clave correcta abre la ruta', () => assert.equal(claveCronValida(buena, buena), true));
test('una clave distinta o ausente no la abre', () => {
  assert.equal(claveCronValida('b'.repeat(32), buena), false);
  assert.equal(claveCronValida('', buena), false);
  assert.equal(claveCronValida(null, buena), false);
});
test('sin clave configurada, o corta, la ruta queda cerrada', () => {
  assert.equal(claveCronValida(buena, undefined), false);
  assert.equal(claveCronValida('corta', 'corta'), false);
  assert.equal(claveCronValida('', ''), false);
});
