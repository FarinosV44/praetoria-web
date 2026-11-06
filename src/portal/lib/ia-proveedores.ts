import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { comoUsuario, type Tx } from './db';
import { candidatos, costeUsd, limiteSuperado, maxTokens as tokensModo, parametrosAnthropic, parametrosOpenAI, type AjustesModelos, type Candidato, type Modo, type Proveedor, type Tarifa } from './ia-modelos';

// Capa única de llamada a los modelos. Las claves solo existen en el servidor; aquí nunca se registra el contenido.
// · Sin herramientas: los modelos devuelven texto; guardar, enviar o presentar siempre lo hace una persona.
// · El modelo que respondió y si hubo fallback se devuelven y se guardan: no se reduce la calidad en silencio.
// · Todo se registra en portal.ia_consumo y los límites de gasto se comprueban antes de llamar.

export type AjustesIA = AjustesModelos & {
  embeddings_biblioteca: boolean; embeddings_expedientes: boolean; ocr_activo: boolean; revision_doble: boolean;
  limite_diario_usd: string | null; limite_mensual_usd: string | null; limite_hora_usuario: number; tarifas: Record<string, Tarifa>; estilo_instrucciones: string;
};
export const clavesIA = () => ({ anthropic: !!process.env.ANTHROPIC_API_KEY, openai: !!process.env.OPENAI_API_KEY });
export const iaDisponible = () => { const c = clavesIA(); return c.anthropic || c.openai; };

export async function leerAjustes(tx: Tx): Promise<AjustesIA> {
  const a = (await tx.query('select * from portal.ia_ajustes limit 1')).rows[0];
  if (!a) throw new Error('No se pueden leer los ajustes de IA.');
  return a as AjustesIA;
}

export type Bloque = { type: 'text'; text: string } | { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } } | { type: 'image'; source: { type: 'base64'; media_type: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'; data: string } };
export type MensajeIA = { role: 'user' | 'assistant'; content: string | Bloque[] };
export type PeticionIA = {
  uid: string; solicitud: string | null; tarea: string; system: string; messages: MensajeIA[];
  pedido?: { proveedor?: Proveedor; modo?: Modo; modelo?: string }; maxTokens?: number; segundos?: number;
  soloAnthropic?: boolean; onTexto?: (delta: string) => void; onEstado?: (estado: string) => void; signal?: AbortSignal;
};
export type RespuestaIA = {
  texto: string; proveedor: Proveedor; modelo: string; modeloPedido: string; modo: Modo; entrada: number | null; salida: number | null; coste: number | null; cortado: boolean;
  fallback: string | null;
};

export class ErrorIA extends Error {
  codigo: string;
  constructor(mensaje: string, codigo: string) { super(mensaje); this.name = 'ErrorIA'; this.codigo = codigo; }
}

type Llamada = { texto: string; modelo: string; entrada: number | null; salida: number | null; cacheLectura: number | null; cacheEscritura: number | null; cortado: boolean; fallbackServidor: boolean };

async function llamarAnthropicSdk(c: Candidato, p: PeticionIA): Promise<Llamada> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: (p.segundos ?? 1800) * 1000, maxRetries: 2 });
  const body = {
    model: c.modelo, max_tokens: tokensModo(c.modo, p.maxTokens), cache_control: { type: 'ephemeral' as const },
    system: p.system, messages: p.messages, ...parametrosAnthropic(c.modelo, c.modo),
  };
  const stream = client.beta.messages.stream(body as Parameters<typeof client.beta.messages.stream>[0], p.signal ? { signal: p.signal } : undefined);
  for await (const ev of stream) {
    if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') p.onTexto?.(ev.delta.text);
    else if (ev.type === 'content_block_start' && ev.content_block.type === 'thinking') p.onEstado?.('Razonando el asunto…');
    else if (ev.type === 'content_block_start' && ev.content_block.type === 'text') p.onEstado?.('Redactando la respuesta…');
  }
  const f = await stream.finalMessage();
  if (f.stop_reason === 'refusal') throw new ErrorIA('El modelo ha rehusado esta petición por sus filtros de seguridad. Reformúlala o elige otro modelo.', 'rechazo');
  const texto = f.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('').trim();
  return { texto, modelo: f.model, entrada: f.usage.input_tokens, salida: f.usage.output_tokens, cacheLectura: f.usage.cache_read_input_tokens ?? null,
    cacheEscritura: f.usage.cache_creation_input_tokens ?? null, cortado: f.stop_reason === 'max_tokens', fallbackServidor: f.model !== c.modelo };
}

async function llamarOpenAiSdk(c: Candidato, p: PeticionIA): Promise<Llamada> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: (p.segundos ?? 1800) * 1000, maxRetries: 2 });
  const input = p.messages.map((m) => ({ role: m.role, content: typeof m.content === 'string' ? m.content : m.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('\n') }));
  // store:false para que OpenAI no conserve la conversación en su sistema de respuestas.
  const stream = await client.responses.create({ model: c.modelo, instructions: p.system, input, max_output_tokens: tokensModo(c.modo, p.maxTokens), store: false, stream: true, ...parametrosOpenAI(c.modelo, c.modo) } as OpenAI.Responses.ResponseCreateParamsStreaming, p.signal ? { signal: p.signal } : undefined);
  let texto = '', modelo = c.modelo, entrada: number | null = null, salida: number | null = null, cache: number | null = null, cortado = false;
  for await (const ev of stream) {
    if (ev.type === 'response.output_text.delta') { texto += ev.delta; p.onTexto?.(ev.delta); }
    else if (ev.type === 'response.created') p.onEstado?.('Razonando el asunto…');
    else if (ev.type === 'response.completed' || ev.type === 'response.incomplete') {
      modelo = ev.response.model; entrada = ev.response.usage?.input_tokens ?? null; salida = ev.response.usage?.output_tokens ?? null;
      cache = ev.response.usage?.input_tokens_details?.cached_tokens ?? null;
      if (ev.type === 'response.incomplete') cortado = true;
    } else if (ev.type === 'response.failed') throw new ErrorIA('El servicio de IA no ha podido completar la respuesta.', 'openai_fallo');
    else if (ev.type === 'error') throw new ErrorIA('El servicio de IA no ha podido completar la respuesta.', 'openai_error');
  }
  // OpenAI incluye lo leído de caché dentro de los tokens de entrada: se separa para no contarlo dos veces.
  if (entrada != null && cache) entrada -= cache;
  return { texto: texto.trim(), modelo, entrada, salida, cacheLectura: cache, cacheEscritura: null, cortado, fallbackServidor: false };
}

const codigoError = (e: unknown): string => {
  if (e instanceof ErrorIA) return e.codigo;
  const s = (e as { status?: number }).status;
  return s ? `http_${s}` : (e as Error).name === 'AbortError' ? 'cancelado' : 'sin_respuesta';
};
const mensajeError = (codigo: string) =>
  codigo === 'http_429' || codigo === 'http_529' ? 'El servicio de IA está saturado. Inténtalo en un minuto; lo escrito queda guardado.'
    : codigo === 'http_401' || codigo === 'http_403' ? 'La clave del proveedor de IA no es válida o no tiene permiso. Revísala en el servidor.'
      : codigo === 'http_404' ? 'Ese modelo no está disponible en la cuenta del proveedor. Elige otro en Ajustes de IA.'
        : 'El servicio de IA no ha respondido. Lo escrito queda guardado.';

async function registrar(p: PeticionIA, c: Candidato, r: { modelo?: string; estado: 'ok' | 'error' | 'rechazo'; codigo?: string; ini: number; uso?: Llamada; coste?: number | null }) {
  await comoUsuario(p.uid, (tx) => tx.query(`insert into portal.ia_consumo (user_id, solicitud_id, tarea, modo, proveedor, modelo_pedido, modelo_usado, fallback, tokens_entrada, tokens_salida,
      tokens_cache_lectura, tokens_cache_escritura, coste_usd, estado, error_codigo, duracion_ms) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
    [p.uid, p.solicitud, p.tarea.slice(0, 40), c.modo, c.proveedor, c.modelo, r.modelo ?? null, c.esFallback || !!r.uso?.fallbackServidor, r.uso?.entrada ?? null, r.uso?.salida ?? null,
      r.uso?.cacheLectura ?? null, r.uso?.cacheEscritura ?? null, r.coste ?? null, r.estado, r.codigo?.slice(0, 60) ?? null, Date.now() - r.ini]));
}

/** Llama al modelo pedido con streaming. Si el proveedor falla usa el fallback configurado y lo indica en la respuesta. */
export async function generar(p: PeticionIA): Promise<RespuestaIA> {
  const { ajustes, limite } = await comoUsuario(p.uid, async (tx) => {
    const a = await leerAjustes(tx);
    const uso = (await tx.query(`select portal.ia_gasto(date_trunc('day', now() at time zone 'Europe/Madrid') at time zone 'Europe/Madrid') dia,
      portal.ia_gasto(date_trunc('month', now() at time zone 'Europe/Madrid') at time zone 'Europe/Madrid') mes, portal.ia_consultas_hora() hora`)).rows[0];
    return { ajustes: a, limite: limiteSuperado({ diario: a.limite_diario_usd == null ? null : Number(a.limite_diario_usd), mensual: a.limite_mensual_usd == null ? null : Number(a.limite_mensual_usd),
      gastoDia: Number(uso.dia), gastoMes: Number(uso.mes), consultasHora: uso.hora, porHora: a.limite_hora_usuario }) };
  });
  if (limite) throw new ErrorIA(limite, 'limite');
  const pedido = p.soloAnthropic ? { ...p.pedido, proveedor: 'anthropic' as const } : p.pedido;
  const { lista, problema } = candidatos(ajustes, clavesIA(), pedido);
  if (problema) throw new ErrorIA(problema, 'configuracion');
  // El OCR y demás tareas con archivos solo van a Anthropic: no se cae a otro proveedor con el documento.
  const intentos = p.soloAnthropic ? lista.filter((c) => c.proveedor === 'anthropic') : lista;
  let ultimo: unknown = null;
  for (const c of intentos) {
    const ini = Date.now();
    let emitido = false;
    const onTexto = (d: string) => { emitido = true; p.onTexto?.(d); };
    try {
      if (c.esFallback) p.onEstado?.(`El modelo elegido no ha respondido: se usa ${c.modelo} (configurado como respaldo).`);
      const u = await (c.proveedor === 'anthropic' ? llamarAnthropicSdk : llamarOpenAiSdk)(c, { ...p, onTexto });
      const coste = costeUsd(u.modelo, { entrada: u.entrada, salida: u.salida, cacheLectura: u.cacheLectura, cacheEscritura: u.cacheEscritura }, ajustes.tarifas ?? {});
      await registrar(p, c, { modelo: u.modelo, estado: 'ok', ini, uso: u, coste });
      const fallback = c.esFallback ? `Respondió ${u.modelo} porque ${intentos[0]!.modelo} no estaba disponible.`
        : u.fallbackServidor ? `Respondió ${u.modelo}: ${c.modelo} declinó la petición y Anthropic la trasladó a otro modelo.` : null;
      return { texto: u.texto, proveedor: c.proveedor, modelo: u.modelo, modeloPedido: c.modelo, modo: c.modo, entrada: u.entrada, salida: u.salida, coste, cortado: u.cortado, fallback };
    } catch (e) {
      const codigo = codigoError(e);
      console.error(`IA: fallo ${c.proveedor} ${c.modelo} ${codigo}`); // solo el código: nunca el contenido
      await registrar(p, c, { estado: codigo === 'rechazo' ? 'rechazo' : 'error', codigo, ini }).catch(() => {});
      ultimo = e;
      // Un rechazo no se reintenta en otro proveedor, ni tampoco una respuesta ya mostrada en parte o cancelada.
      if (codigo === 'rechazo' || codigo === 'cancelado' || emitido) break;
    }
  }
  if (ultimo instanceof ErrorIA) throw ultimo;
  const codigo = codigoError(ultimo);
  throw new ErrorIA(mensajeError(codigo), codigo);
}

const EMBEDDING = 'text-embedding-3-large';
const DIMENSIONES = 1536;

/** Embeddings con OpenAI. Quien llama comprueba antes que el despacho lo ha autorizado para esos textos. */
export async function embeddings(textos: string[], uid: string, solicitud: string | null): Promise<{ vectores: number[][]; modelo: string }> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 120_000, maxRetries: 2 });
  const vectores: number[][] = [];
  let tokens = 0;
  const ini = Date.now();
  for (let i = 0; i < textos.length; i += 64) {
    const r = await client.embeddings.create({ model: EMBEDDING, dimensions: DIMENSIONES, input: textos.slice(i, i + 64) });
    r.data.sort((a, b) => a.index - b.index).forEach((d) => vectores.push(d.embedding));
    tokens += r.usage?.total_tokens ?? 0;
  }
  await comoUsuario(uid, (tx) => tx.query(`insert into portal.ia_consumo (user_id, solicitud_id, tarea, proveedor, modelo_pedido, modelo_usado, tokens_entrada, tokens_salida, coste_usd, estado, duracion_ms)
    values ($1, $2, 'embeddings', 'openai', $3, $3, $4, 0, $5, 'ok', $6)`, [uid, solicitud, EMBEDDING, tokens, (tokens / 1_000_000) * 0.13, Date.now() - ini])).catch(() => {});
  return { vectores, modelo: EMBEDDING };
}
export const autorizaEmbeddings = (a: AjustesIA, ambito: 'biblioteca' | 'expediente') =>
  clavesIA().openai && a.openai_autorizado && (ambito === 'biblioteca' ? a.embeddings_biblioteca : a.embeddings_expedientes);
export const vectorSql = (v: number[]) => `[${v.join(',')}]`;

/** Modelos que el proveedor ofrece realmente a esta cuenta. Lo usa la pantalla de ajustes para comprobar la configuración. */
export async function modelosDisponibles(p: Proveedor): Promise<{ ok: true; modelos: string[] } | { ok: false; error: string }> {
  try {
    if (p === 'anthropic') {
      if (!process.env.ANTHROPIC_API_KEY) return { ok: false, error: 'Falta ANTHROPIC_API_KEY en el servidor.' };
      const c = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 20_000 });
      const ids: string[] = [];
      for await (const m of c.models.list()) ids.push(m.id);
      return { ok: true, modelos: ids };
    }
    if (!process.env.OPENAI_API_KEY) return { ok: false, error: 'Falta OPENAI_API_KEY en el servidor.' };
    const c = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 20_000 });
    const ids: string[] = [];
    for await (const m of c.models.list()) ids.push(m.id);
    return { ok: true, modelos: ids.sort() };
  } catch (e) {
    return { ok: false, error: mensajeError(codigoError(e)) };
  }
}
