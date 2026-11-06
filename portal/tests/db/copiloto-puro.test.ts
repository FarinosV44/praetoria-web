// Piezas puras del Copiloto: modelos, costes, fragmentación jurídica, fusión de resultados y detección de normas. Sin datos reales.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { candidatos, costeUsd, esfuerzo, limiteSuperado, parametrosAnthropic, parametrosOpenAI, proveedorDe, type AjustesModelos } from '../../../src/portal/lib/ia-modelos.ts';
import { fragmentar, fusionRRF, reordenarBiblioteca } from '../../../src/portal/lib/fragmentar.ts';
import { detectarNormas, textoBloque, textoVerificacion, verificarNorma } from '../../../src/portal/lib/boe.ts';

const A: AjustesModelos = {
  proveedor: 'anthropic', modo: 'equilibrado', openai_autorizado: false, fallback_proveedor: 'anthropic', fallback_modelo: 'claude-opus-5-5',
  modelos: { anthropic: { rapido: 'claude-sonnet-5-5', equilibrado: 'claude-opus-5-5', maximo: 'claude-fable-5-1' }, openai: { maximo: 'gpt-6-astra', equilibrado: 'gpt-6-astra', rapido: 'gpt-6-astra' } },
};
const AMBAS = { anthropic: true, openai: true };

test('máxima calidad usa el esfuerzo máximo y razonamiento adaptativo', () => {
  assert.equal(esfuerzo('maximo'), 'max');
  const p = parametrosAnthropic('claude-fable-5-1', 'maximo');
  assert.deepEqual(p.output_config, { effort: 'max' });
  assert.equal(p.thinking.type, 'adaptive');
  assert.equal(p.fallbacks, 'default');
  assert.deepEqual(p.betas, ['server-side-fallback-2026-07-01']);
  assert.equal('fallbacks' in parametrosAnthropic('claude-haiku-5-5', 'rapido'), false);
  assert.deepEqual(parametrosOpenAI('gpt-6-astra', 'maximo'), { reasoning: { effort: 'high' } });
  assert.deepEqual(parametrosOpenAI('modelo-sin-razonamiento', 'maximo'), {});
  assert.equal(proveedorDe('claude-opus-5-5'), 'anthropic');
  assert.equal(proveedorDe('gpt-6-astra'), 'openai');
});

test('el modelo elegido no se sustituye en silencio', () => {
  const m = candidatos(A, AMBAS, { modo: 'maximo' });
  assert.equal(m.lista[0]!.modelo, 'claude-fable-5-1');
  assert.equal(m.lista[0]!.esFallback, false);
  assert.equal(m.lista[1]!.modelo, 'claude-opus-5-5');
  assert.equal(m.lista[1]!.esFallback, true, 'el fallback queda marcado para mostrarlo');
  assert.equal(candidatos(A, AMBAS).lista.length, 1, 'si el fallback es el mismo modelo, no se repite');
  const o = candidatos(A, AMBAS, { proveedor: 'openai' });
  assert.deepEqual(o.lista, [], 'OpenAI sin autorizar no se usa ni se cambia por Claude');
  assert.match(o.problema!, /no está autorizado/);
  assert.match(candidatos(A, { anthropic: false, openai: false }).problema!, /Falta la clave de Anthropic/);
  const sinClaveFb = candidatos({ ...A, fallback_proveedor: 'openai', fallback_modelo: 'gpt-6-astra' }, AMBAS);
  assert.equal(sinClaveFb.lista.length, 1, 'el fallback a OpenAI sin autorizar se omite');
  assert.match(candidatos(A, AMBAS, { modelo: 'x; drop table' }).problema!, /No hay un modelo/);
});

test('coste estimado con caché, y sin tarifa conocida no se inventa', () => {
  assert.equal(costeUsd('claude-opus-5-5', { entrada: 1_000_000, salida: 100_000 }), 6);
  assert.equal(costeUsd('claude-opus-5-5', { entrada: 0, salida: 0, cacheLectura: 1_000_000, cacheEscritura: 1_000_000 }), 5.2);
  assert.equal(costeUsd('gpt-6-astra', { entrada: 10, salida: 10 }), null);
  assert.equal(costeUsd('gpt-6-astra', { entrada: 1_000_000, salida: 0 }, { 'gpt-6-astra': { entrada: 3, salida: 9 } }), 3);
});

test('límites de gasto y de uso', () => {
  const b = { diario: 10, mensual: 100, gastoDia: 1, gastoMes: 1, consultasHora: 0, porHora: 60 };
  assert.equal(limiteSuperado(b), null);
  assert.match(limiteSuperado({ ...b, gastoDia: 10 })!, /diario/);
  assert.match(limiteSuperado({ ...b, gastoMes: 100 })!, /mensual/);
  assert.match(limiteSuperado({ ...b, consultasHora: 60 })!, /por hora/);
  assert.equal(limiteSuperado({ ...b, diario: null, mensual: null, gastoDia: 9999, gastoMes: 9999 }), null);
});

const DEMANDA = `AL JUZGADO DE PRIMERA INSTANCIA
Doña Ana Ficticia, ante el Juzgado comparezco y digo:
HECHOS
PRIMERO.- Las partes contrajeron matrimonio en una fecha ficticia.
SEGUNDO.- De dicha unión nació un hijo menor.
FUNDAMENTOS DE DERECHO
PRIMERO.- Jurisdicción y competencia del Juzgado.
SUPLICO
Que tenga por presentada esta demanda.
OTROSÍ DIGO
Que se acuerden medidas provisionales.`;

test('fragmenta por la estructura del escrito y conserva sección y página', () => {
  const f = fragmentar([DEMANDA]);
  const sec = (t: string) => f.find((x) => x.texto.includes(t))?.seccion;
  assert.equal(sec('contrajeron matrimonio'), 'HECHOS · PRIMERO');
  assert.equal(sec('hijo menor'), 'HECHOS · SEGUNDO');
  assert.equal(sec('Jurisdicción y competencia'), 'FUNDAMENTOS DE DERECHO · PRIMERO');
  assert.equal(sec('tenga por presentada'), 'SUPLICO');
  assert.ok(f.every((x) => x.pagina === 1));
  assert.deepEqual(f.map((x) => x.orden), f.map((_, i) => i));
});

test('los textos largos se trocean sin perder contenido ni exceder el máximo, y la página es la correcta', () => {
  const frases = Array.from({ length: 300 }, (_, i) => `Frase número ${i} del documento ficticio.`);
  const pag = frases.join(' ');
  const f = fragmentar([pag, 'Texto de la segunda página con suficiente contenido ficticio para quedar registrado aparte.']);
  assert.ok(f.length > 3);
  assert.ok(f.every((x) => x.texto.length <= 2700), 'ningún fragmento excede el máximo');
  for (const n of [0, 150, 299]) assert.ok(f.some((x) => x.texto.includes(`Frase número ${n} `)), `conserva la frase ${n}`);
  assert.ok(f.some((x) => x.pagina === 2 && x.texto.includes('segunda página')));
  assert.equal(fragmentar(['Texto de Word troceado.'], false)[0]!.pagina, null, 'sin páginas reales no se inventa la página');
  assert.deepEqual(fragmentar(['', '   ']), []);
});

test('la fusión premia lo que aparece en ambas búsquedas', () => {
  const texto = [{ id: 'a' }, { id: 'b' }, { id: 'c' }], vector = [{ id: 'c' }, { id: 'd' }];
  const r = fusionRRF([texto, vector]);
  assert.equal(r[0]!.id, 'c');
  assert.equal(r.length, 4);
  assert.deepEqual(fusionRRF([[{ id: 'x' }], []]).map((x) => x.id), ['x'], 'sin embeddings funciona solo con el texto');
});

test('la reordenación prioriza maestros y el mismo procedimiento', () => {
  const l = [{ rrf: 0.03, clase: 'historico_anonimizado', procedimiento_id: 'p2' }, { rrf: 0.025, clase: 'maestro', procedimiento_id: 'p2' }, { rrf: 0.028, clase: 'historico_anonimizado', procedimiento_id: 'p1' }];
  assert.equal(reordenarBiblioteca(l)[0]!.clase, 'maestro');
  assert.equal(reordenarBiblioteca(l, { procedimiento: 'p1' })[0]!.procedimiento_id, 'p1');
  assert.equal(reordenarBiblioteca(l).length, 3);
});

test('detecta normas y artículos citados', () => {
  const r = detectarNormas('Conforme al artículo 394 de la Ley de Enjuiciamiento Civil, y al art. 86 del Código Civil. También la Ley 29/1994.');
  const c = (id: string, a: string | null) => r.some((x) => x.id === id && x.articulo === a);
  assert.ok(c('BOE-A-2000-323', '394'), JSON.stringify(r));
  assert.ok(c('BOE-A-1889-4763', '86'));
  assert.ok(c('BOE-A-1994-26003', null));
  assert.deepEqual(detectarNormas('Un texto sin ninguna referencia legal, con artículos de prensa.'), []);
  assert.deepEqual(detectarNormas('El artículo 5 del reglamento interno.'), [], 'no asigna un artículo a una norma que no cita');
});

test('extrae el texto vigente de un bloque del BOE: la última versión', () => {
  const xml = `<response><data><bloque><version fecha="1"><p class="articulo">Artículo 1.</p><p>Texto antiguo.</p></version><version fecha="2"><p class="articulo">Artículo 1.</p><p>Texto &quot;nuevo&quot; vigente.</p></version></bloque></data></response>`;
  const t = textoBloque(xml);
  assert.match(t, /Texto "nuevo" vigente/);
  assert.equal(t.includes('antiguo'), false);
});

test('el aviso distingue lo comprobado de lo que no', () => {
  const b = { texto: '', id: 'BOE-A-2000-323', nombre: 'LEC', articulo: '394', url: 'https://www.boe.es/x', fechaConsulta: '2026-11-06' };
  assert.match(textoVerificacion({ ...b, estado: 'vigente' }), /el artículo existe.*Comprueba su redacción/);
  assert.match(textoVerificacion({ ...b, estado: 'derogada' }), /vigencia agotada/);
  assert.match(textoVerificacion({ ...b, estado: 'articulo_inexistente' }), /cita sea errónea/);
  assert.match(textoVerificacion({ ...b, estado: 'no_comprobada' }), /no se ha podido comprobar/);
});

test('consulta real al BOE: ley vigente, artículo existente y artículo inexistente', { skip: process.env.SIN_RED ? 'sin red' : false }, async () => {
  const ref = { texto: '', id: 'BOE-A-2000-323', nombre: 'Ley de Enjuiciamiento Civil' };
  const v = await verificarNorma({ ...ref, articulo: '394' });
  assert.equal(v.estado, 'vigente');
  assert.match(v.titulo!, /Enjuiciamiento Civil/);
  assert.match(v.textoArticulo!, /costas/);
  assert.equal((await verificarNorma({ ...ref, articulo: '9999' })).estado, 'articulo_inexistente');
  assert.equal((await verificarNorma({ ...ref, id: 'BOE-A-1900-1', articulo: null })).estado, 'no_comprobada', 'lo que no existe no se da por vigente');
});
