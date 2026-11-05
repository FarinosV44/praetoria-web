// Motor de render de escritos (#97): estructura, numeración, DOCX y PDF con el estilo, y lectura de estilo de un Word.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { aDocx, aPdf, estiloDesdeDocx, estructurar, normalizarEstilo, numerar } from '../../../src/portal/lib/render.ts';

const BORRADOR = `**AL JUZGADO DE PRIMERA INSTANCIA**

Doña Ficticia, procuradora, en nombre de la parte actora [N1], DIGO:

HECHOS

1. Primer hecho ficticio con *énfasis*.

3. Segundo hecho, mal numerado a propósito.

FUNDAMENTOS DE DERECHO

PRIMERO.- Fundamento ficticio uno.

SEGUNDO.- Fundamento ficticio dos.

SUPLICO

Que se tenga por presentado este escrito ficticio.`;

test('estructura el texto, limpia las marcas del chat y renumera por sección', () => {
  const b = estructurar(BORRADOR);
  assert.deepEqual(b.filter((x) => x.tipo === 'titulo').map((x) => x.texto), ['AL JUZGADO DE PRIMERA INSTANCIA', 'HECHOS', 'FUNDAMENTOS DE DERECHO', 'SUPLICO']);
  const hechos = numerar(b, 'arabigo').filter((x) => x.tipo === 'numerado').map((x) => x.numero);
  assert.deepEqual(hechos, ['1.-', '2.-', '1.-', '2.-'], 'cada sección empieza en 1 y corrige el salto');
  assert.deepEqual(numerar(b, 'ordinal').filter((x) => x.tipo === 'numerado').map((x) => x.numero), ['PRIMERO.-', 'SEGUNDO.-', 'PRIMERO.-', 'SEGUNDO.-']);
  const todo = b.map((x) => x.texto).join(' ');
  assert.ok(!/\*\*|\[N1\]|\*énfasis\*/.test(todo), 'sin Markdown ni citas internas del asistente');
});

test('DOCX editable con márgenes, fuente y pie; propiedades del archivo neutras', async () => {
  const estilo = normalizarEstilo({ fuente: 'Arial', tamano: 11, margenes: { sup: 20, inf: 20, izq: 35, der: 20 }, firma: 'Letrado ficticio\nColegiado nº 0000', pie: 'Página {n} de {total}' });
  const buf = await aDocx(estructurar(BORRADOR), estilo, 'Demanda ficticia');
  const zip = await JSZip.loadAsync(buf);
  const doc = await zip.file('word/document.xml')!.async('string');
  assert.match(doc, /w:left="198[45]"/, 'margen izquierdo de 35 mm');
  assert.match(doc, /Arial/);
  assert.match(doc, /PRIMERO\.-/);
  assert.match(doc, /Colegiado nº 0000/);
  const core = await zip.file('docProps/core.xml')!.async('string');
  assert.match(core, /<dc:creator>Praetoria Abogados<\/dc:creator>/);
  const pieXml = (await Promise.all(Object.keys(zip.files).filter((n) => /footer/.test(n)).map((n) => zip.file(n)!.async('string')))).join('');
  assert.match(pieXml, /PAGE/); assert.match(pieXml, /NUMPAGES/);
  // La lectura del estilo devuelve lo que se puso, sin contenido
  const { estilo: leido, detectado } = await estiloDesdeDocx(buf);
  assert.equal(leido.fuente, 'Arial');
  assert.equal(leido.margenes.izq, 35);
  assert.equal(leido.tamano, 11);
  assert.ok(detectado.includes('márgenes'));
  assert.ok(!JSON.stringify(leido).includes('Ficticia'), 'el estilo no arrastra textos del documento');
});

test('PDF paginado con la fuente estándar equivalente', async () => {
  const largo = `${BORRADOR}\n\n${Array.from({ length: 40 }, (_, i) => `${i + 1}. Párrafo de relleno ficticio número ${i + 1} para forzar varias páginas en el PDF de prueba.`).join('\n\n')}`;
  const pdf = await aPdf(estructurar(largo), normalizarEstilo({}), 'Prueba');
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  const paginas = (pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? []).length;
  assert.ok(paginas >= 2, `varias páginas (${paginas})`);
  assert.match(pdf.toString('latin1'), /Times-Roman/);
});
