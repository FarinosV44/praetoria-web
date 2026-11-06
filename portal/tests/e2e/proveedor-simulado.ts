// Proveedor de IA SIMULADO para pruebas de extremo a extremo sin claves ni gasto: imita las API de Anthropic (Messages con streaming)
// y OpenAI (Responses y Embeddings). Guarda lo recibido para comprobar qué se envía realmente a un proveedor.
// Una prueba que pasa aquí demuestra el flujo de la aplicación, NO la calidad ni la disponibilidad de los modelos reales.
import { createServer } from 'node:http';

type Peticion = { ruta: string; modelo: string; cuerpo: string; parametros: Record<string, unknown> };
const peticiones: Peticion[] = [];
let falla: string[] = [];
let lentitud = 0;

const leer = (req: import('node:http').IncomingMessage) => new Promise<string>((res) => { let s = ''; req.on('data', (d) => { s += d; }); req.on('end', () => res(s)); });
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Respuesta según lo pedido. Cita fuentes reales del contexto recibido e incluye a propósito errores que el servidor debe filtrar. */
function responder(sistema: string, texto: string): string {
  const fuentes = [...texto.matchAll(/<fuente id="([^"]+)"/g)].map((m) => m[1]!);
  if (sistema.includes('Transcribes documentos')) return 'Texto leído por OCR simulado del documento escaneado ficticio.\n---PAGINA---\nSegunda página leída por OCR simulado.';
  if (sistema.includes('Analizas UN documento')) {
    return JSON.stringify({ tipo: 'resolucion', resumen: 'Resumen simulado de la resolución ficticia.', organo: 'Juzgado ficticio n.º 1', procedimiento: 'Autos 1/2026', partes: ['Parte A'], pretensiones: [], cuantias: ['1.000 euros'], fallo: 'Se estima.', documentos_citados: [], estrategia_preliminar: null,
      fechas: [{ fecha: '2026-03-03', que: 'Fecha del documento', cita: '3 de marzo de 2026' }, { fecha: '2031-12-31', que: 'Fecha inventada', cita: 'no consta' }],
      propuestas: [{ tipo: 'plazo', titulo: 'Verificar plazo de recurso ficticio', fecha: '2031-12-31', fundamento: 'Depende de la notificación' }, { tipo: 'tarea', titulo: 'Revisar la resolución ficticia', fecha: '2026-03-03', fundamento: 'Consta en el documento' }], advertencias: [] });
  }
  if (sistema.includes('asistente de edición')) return 'TEXTO REFORMULADO POR LA IA SIMULADA. STS 999/2031 inventada.';
  if (sistema.includes('revisa críticamente')) {
    return `<borrador>\nDEMANDA REVISADA\nHECHOS\nPRIMERO.- Hecho acreditado [${fuentes[0] ?? 'F1'}].\nFUNDAMENTOS DE DERECHO\nPRIMERO.- Conforme al artículo 394 de la Ley de Enjuiciamiento Civil.\nSUPLICO\nQue se estime.\n</borrador>\n<modelos_usados>\nB1: Estructura\n</modelos_usados>\n<lagunas>\n- Revisado críticamente por la simulación\n</lagunas>\n<normas_sin_verificar>\n- artículo 394 de la Ley de Enjuiciamiento Civil (origen: modelo B1)\n</normas_sin_verificar>`;
  }
  if (sistema.includes('redactor interno')) {
    return `<borrador>\nDEMANDA SIMULADA\nHECHOS\nPRIMERO.- Hecho acreditado [${fuentes[0] ?? 'F1'}]. Importe [PENDIENTE: cuantía].\nFUNDAMENTOS DE DERECHO\nPRIMERO.- Conforme al artículo 394 de la Ley de Enjuiciamiento Civil y al artículo 9999 de la Ley de Enjuiciamiento Civil. STS 999/2031 inventada.\nSUPLICO\nQue se estime.\n</borrador>\n<modelos_usados>\nB1: Estructura\n</modelos_usados>\n<lagunas>\n- Falta la cuantía\n</lagunas>\n<normas_sin_verificar>\n- artículo 394 de la Ley de Enjuiciamiento Civil (origen: modelo B1)\n</normas_sin_verificar>`;
  }
  return `Respuesta simulada del Copiloto con las fuentes recibidas ${fuentes.slice(0, 3).map((f) => `[${f}]`).join(' ')} y una cita falsa [N999].`;
}

const srv = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  const json = (o: unknown, status = 200) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (url.pathname === '/__peticiones') return json(peticiones);
  if (url.pathname === '/__reiniciar') { peticiones.length = 0; falla = []; lentitud = 0; return json({ ok: true }); }
  if (url.pathname === '/__config') { const c = JSON.parse(await leer(req)) as { falla?: string[]; lentitud?: number }; falla = c.falla ?? []; lentitud = c.lentitud ?? 0; return json({ ok: true }); }
  if (url.pathname === '/v1/models' && req.method === 'GET') {
    return json({ data: ['claude-fable-5-1', 'claude-opus-5-5', 'claude-sonnet-5-5', 'gpt-6-astra'].map((id) => ({ id, type: 'model', display_name: id, object: 'model', created_at: '2026-01-01T00:00:00Z' })), has_more: false, first_id: null, last_id: null, object: 'list' });
  }
  const cuerpo = await leer(req);
  const j = JSON.parse(cuerpo || '{}') as Record<string, unknown>;
  if (url.pathname === '/v1/embeddings') {
    peticiones.push({ ruta: url.pathname, modelo: String(j.model), cuerpo, parametros: { dimensions: j.dimensions } });
    const entradas = Array.isArray(j.input) ? j.input as string[] : [String(j.input)];
    return json({ object: 'list', model: j.model, usage: { prompt_tokens: 5, total_tokens: 5 }, data: entradas.map((_, index) => ({ object: 'embedding', index, embedding: Array.from({ length: Number(j.dimensions) || 1536 }, (__, i) => (i === index % 1536 ? 1 : 0)) })) });
  }
  const modelo = String(j.model);
  peticiones.push({ ruta: url.pathname, modelo, cuerpo, parametros: { thinking: j.thinking, output_config: j.output_config, fallbacks: j.fallbacks, betas: req.headers['anthropic-beta'], store: j.store, reasoning: j.reasoning, max_tokens: j.max_tokens } });
  if (falla.includes(modelo)) return json({ type: 'error', error: { type: 'not_found_error', message: 'modelo no disponible (simulado)' } }, 404);
  const sse = (ev: string, d: unknown) => res.write(`event: ${ev}\ndata: ${JSON.stringify(d)}\n\n`);
  const trozos = (t: string) => t.match(/[\s\S]{1,40}/g) ?? [];

  if (url.pathname === '/v1/messages') {
    const sistema = typeof j.system === 'string' ? j.system : JSON.stringify(j.system);
    const texto = responder(sistema, JSON.stringify(j.messages).replace(/\\n/g, '\n').replace(/\\"/g, '"'));
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    sse('message_start', { type: 'message_start', message: { id: 'msg_sim', type: 'message', role: 'assistant', model: modelo, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1000, output_tokens: 1, cache_read_input_tokens: 100, cache_creation_input_tokens: 0 } } });
    sse('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } });
    for (const t of trozos(texto)) { sse('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: t } }); if (lentitud) await dormir(lentitud); }
    sse('content_block_stop', { type: 'content_block_stop', index: 0 });
    sse('message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 500 } });
    sse('message_stop', { type: 'message_stop' });
    return res.end();
  }
  if (url.pathname === '/v1/responses') {
    const texto = responder(String(j.instructions ?? ''), JSON.stringify(j.input).replace(/\\n/g, '\n').replace(/\\"/g, '"'));
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    const base = { id: 'resp_sim', object: 'response', model: modelo, output: [] };
    sse('response.created', { type: 'response.created', response: base, sequence_number: 0 });
    for (const t of trozos(texto)) sse('response.output_text.delta', { type: 'response.output_text.delta', delta: t, output_index: 0, content_index: 0, item_id: 'i', sequence_number: 1 });
    sse('response.completed', { type: 'response.completed', sequence_number: 2, response: { ...base, status: 'completed', usage: { input_tokens: 1000, output_tokens: 500, total_tokens: 1500, input_tokens_details: { cached_tokens: 100 }, output_tokens_details: { reasoning_tokens: 0 } } } });
    return res.end();
  }
  return json({ error: 'ruta simulada desconocida' }, 404);
});
srv.listen(Number(process.env.SIMULADO_PUERTO ?? 4599), '127.0.0.1', () => console.log('proveedor simulado listo'));
