// Pruebas del importador de contenidos desde chat (#34): node --test scripts/contenidos/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT = 'scripts/contenidos/importar.mjs';
const EJEMPLO = 'contenidos/ejemplos/landing-alcoholemia-juicio-rapido.md';
const run = (...args) => {
  try {
    return { code: 0, out: execFileSync('node', [SCRIPT, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
  } catch (e) {
    return { code: e.status, out: String(e.stdout) + String(e.stderr) };
  }
};
const variante = (cambiar) => {
  const dir = mkdtempSync(join(tmpdir(), 'paquete-'));
  const f = join(dir, 'p.md');
  writeFileSync(f, cambiar(readFileSync(EJEMPLO, 'utf8')));
  return f;
};

test('los paquetes de ejemplo validan', () => {
  for (const f of ['contenidos/ejemplos/articulo-juicio-delito-leve.md', EJEMPLO]) {
    const r = run(f, '--actualizar');
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /OK \(sin escribir\)/);
  }
});

test('escribe un borrador con draft: true y sin publicarlo', () => {
  const dest = mkdtempSync(join(tmpdir(), 'destino-'));
  const f = variante((t) => t.replace('estado: revision', 'estado: borrador').replace('slug: juicio-rapido-alcoholemia-valencia', 'slug: prueba-borrador-importador'));
  const r = run(f, '--escribir', '--destino', dest);
  assert.equal(r.code, 0, r.out);
  const md = readFileSync(join(dest, 'src/content/landings/prueba-borrador-importador.md'), 'utf8');
  assert.match(md, /^draft: true$/m);
  assert.match(md, /^revision: pendiente$/m);
  assert.match(md, /destino: "\/que-me-llame-un-abogado\/\?area=penal&servicio=penal-seguridad-vial"/);
});

test('rechaza HTML y enlaces peligrosos o rotos en el cuerpo', () => {
  const r1 = run(variante((t) => t + '\n<script>alert(1)</script>\n'));
  assert.equal(r1.code, 1);
  assert.match(r1.out, /no admite HTML/);
  const r2 = run(variante((t) => t + '\n[clic](javascript:alert(1))\n'));
  assert.match(r2.out, /enlace no permitido/);
  const r3 = run(variante((t) => t + '\n[otra](/pagina-que-no-existe/)\n'));
  assert.match(r3.out, /enlace interno inexistente/);
});

test('no inventa revisores y exige revisor para aprobar', () => {
  const r1 = run(variante((t) => t.replace('estado: revision', 'estado: aprobado')));
  assert.match(r1.out, /sin revisor/);
  const r2 = run(variante((t) => t.replace('autor: Juan José Farinós Ibáñez', 'autor: Juan José Farinós Ibáñez\nrevisor: Ana Inventada')));
  assert.match(r2.out, /persona real del despacho/);
});

test('detecta colisiones de URL con páginas existentes', () => {
  const r = run(variante((t) => t.replace('slug: juicio-rapido-alcoholemia-valencia', 'slug: contacto')));
  assert.match(r.out, /ya lo usa src\/app\/contacto\//);
});

test('imagen: del registro o pendiente con su escena, nunca una cualquiera', () => {
  const r = run(variante((t) => t.replace('  id: penal-seguridad-vial', '  id: foto-que-no-existe')));
  assert.match(r.out, /no está en src\/content\/imagenes\.json/);
});
