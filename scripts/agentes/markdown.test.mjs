// node --test scripts/agentes/markdown.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { htmlAMarkdown } from './markdown.mjs';

const pagina = (main) => `<!doctype html><html lang="es"><head><title>Título: con "comillas"</title>
<meta name="description" content="Resumen"/><link rel="canonical" href="https://praetoriaabogados.es/a/"/></head>
<body><header><a href="/menu/">Menú</a></header><main id="contenido">${main}</main><footer>Pie</footer>
<script>self.__next_f.push("secreto")</script></body></html>`;

test('solo convierte <main> y deja una cabecera YAML válida', () => {
  const { markdown, titulo } = htmlAMarkdown(pagina('<h1>Hola</h1><p>Texto <strong>clave</strong>.</p>'));
  assert.equal(titulo, 'Título: con "comillas"');
  assert.match(markdown, /^---\ntitle: "Título: con \\"comillas\\""\ndescription: "Resumen"\nurl: "https:\/\/praetoriaabogados\.es\/a\/"\nlang: es\n---\n/);
  assert.match(markdown, /# Hola/);
  assert.match(markdown, /Texto \*\*clave\*\*\./);
  assert.doesNotMatch(markdown, /Menú|Pie|secreto/);
});

test('hace absolutos los enlaces internos y conserva los externos', () => {
  const { markdown } = htmlAMarkdown(pagina('<h1>x</h1><p><a href="/contacto/">Contacto</a> y <a href="https://boe.es/">BOE</a></p>'));
  assert.match(markdown, /\[Contacto\]\(https:\/\/praetoriaabogados\.es\/contacto\/\)/);
  assert.match(markdown, /\[BOE\]\(https:\/\/boe\.es\/\)/);
});

test('quita lo interactivo y lo decorativo, y avisa del formulario', () => {
  const { markdown } = htmlAMarkdown(
    pagina('<h1>x</h1><svg><title>icono</title></svg><span aria-hidden="true">01</span><p hidden>oculto</p><img src="/d.jpg" alt=""/><form><input name="n"/><button>Enviar</button></form>'),
  );
  assert.doesNotMatch(markdown, /icono|01|oculto|d\.jpg|Enviar/);
  assert.match(markdown, /Formulario disponible en la versión web/);
});

test('una tarjeta enlazada lleva el enlace en su titular', () => {
  const { markdown } = htmlAMarkdown(pagina('<a href="/despido/"><h3>Me han despedido</h3><p>Revisamos la carta.</p></a>'));
  assert.match(markdown, /### \[Me han despedido\]\(https:\/\/praetoriaabogados\.es\/despido\/\)/);
  assert.match(markdown, /Revisamos la carta\./);
});

test('no pega elementos en línea contiguos', () => {
  const { markdown } = htmlAMarkdown(pagina('<h1><span>Lema.</span><span>Abogados</span></h1><p><a href="/a/">A</a><a href="/b/">B</a></p>'));
  assert.ok(markdown.includes('# Lema. Abogados'), markdown);
  assert.ok(markdown.includes('/a/) [B]'), markdown);
});

test('una página sin <main> es un error, no un Markdown vacío', () => {
  assert.throws(() => htmlAMarkdown('<html><body><p>x</p></body></html>'), /sin <main>/);
});
