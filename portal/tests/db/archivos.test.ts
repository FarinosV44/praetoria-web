// Validación de archivos (auditoría M3/M4): PDF con elementos activos escondidos y políglotas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { detectarTipo, extensionDe, pdfSospechoso } from '../../src/lib/archivos.ts';

const b = (s: string) => new Uint8Array(Buffer.from(s, 'latin1'));

test('un PDF normal se admite', () => {
  assert.equal(pdfSospechoso(b('%PDF-1.7\n1 0 obj<</Type/Catalog>>endobj\n%%EOF')), null);
});
test('se detecta JavaScript con el nombre escrito en hexadecimal', () => {
  assert.ok(pdfSospechoso(b('%PDF-1.7\n1 0 obj<</S /J#61vaScript /JS (x)>>endobj\n%%EOF')));
});
test('se detecta JavaScript dentro de un flujo comprimido (ObjStm)', () => {
  const z = deflateSync(Buffer.from('2 0 obj<</OpenAction<</S/JavaScript/JS(x)>>>>endobj'));
  const pdf = Buffer.concat([Buffer.from(`%PDF-1.7\n3 0 obj<</Type/ObjStm/Filter/FlateDecode/Length ${z.length}>>stream\n`), z, Buffer.from('\nendstream endobj\n%%EOF')]);
  assert.ok(pdfSospechoso(new Uint8Array(pdf)));
});
test('se rechazan acciones automáticas y envíos de formulario', () => {
  for (const a of ['/AA', '/SubmitForm', '/Launch', '/EmbeddedFile', '/RichMedia', '/XFA']) {
    assert.ok(pdfSospechoso(b(`%PDF-1.7\n1 0 obj<<${a} 2 0 R>>endobj\n%%EOF`)), a);
  }
});
test('una imagen PNG con un PDF en el primer kilobyte se rechaza', async () => {
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489', 'hex');
  assert.equal(await detectarTipo(new Uint8Array(png)), 'image/png');
  assert.equal(await detectarTipo(new Uint8Array(Buffer.concat([png, Buffer.from('%PDF-1.7 /JS')]))), null);
});
test('la extensión de descarga sale del tipo detectado', () => {
  assert.equal(extensionDe('image/heic'), 'heic');
  assert.equal(extensionDe('application/pdf'), 'pdf');
});
