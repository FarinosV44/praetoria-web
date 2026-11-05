/**
 * Proveedor de IA intercambiable (#1, #7). Las credenciales solo existen en el servidor.
 * Si no hay clave, `proveedorIA()` devuelve null y la aplicación muestra «IA sin configurar»: nunca se simula.
 */
export type BloqueDocumento =
  | { tipo: 'pdf'; titulo: string; base64: string }
  | { tipo: 'imagen'; titulo: string; base64: string; mime: 'image/jpeg' | 'image/png' | 'image/webp' };

export type PeticionIA = {
  sistema: string;
  documentos: BloqueDocumento[];
  texto: string;
  herramienta: { nombre: string; descripcion: string; esquema: Record<string, unknown> };
  maxTokens?: number;
};

export type RespuestaIA = { datos: unknown; modelo: string; tokensEntrada?: number; tokensSalida?: number };

export type PeticionBusqueda = {
  sistema: string;
  texto: string;
  herramienta: { nombre: string; descripcion: string; esquema: Record<string, unknown> };
  maxBusquedas?: number;
};
/** Resultado de una búsqueda en internet: la salida estructurada y las páginas que de verdad se consultaron. */
export type RespuestaBusqueda = { datos: unknown; modelo: string; fuentes: { url: string; titulo: string }[] };

export interface ProveedorIA {
  nombre: string;
  modelo: string;
  /** Devuelve la llamada a la herramienta (salida estructurada). */
  pedir(p: PeticionIA): Promise<RespuestaIA>;
  /** Busca en internet (herramienta de búsqueda del proveedor) y devuelve la salida estructurada con sus fuentes. */
  buscar?(p: PeticionBusqueda): Promise<RespuestaBusqueda>;
}

export class ErrorIA extends Error {
  constructor(mensaje: string, public reintentable: boolean) { super(mensaje); this.name = 'ErrorIA'; }
}

class Anthropic implements ProveedorIA {
  nombre = 'anthropic';
  constructor(private clave: string, public modelo: string) {}

  async pedir(p: PeticionIA): Promise<RespuestaIA> {
    const contenido = [
      ...p.documentos.map((d) => d.tipo === 'pdf'
        ? { type: 'document', title: d.titulo, source: { type: 'base64', media_type: 'application/pdf', data: d.base64 } }
        : { type: 'image', source: { type: 'base64', media_type: d.mime, data: d.base64 } }),
      { type: 'text', text: p.texto },
    ];
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': this.clave, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: this.modelo,
        max_tokens: p.maxTokens ?? 8000,
        system: p.sistema,
        tools: [{ name: p.herramienta.nombre, description: p.herramienta.descripcion, input_schema: p.herramienta.esquema }],
        tool_choice: { type: 'tool', name: p.herramienta.nombre },
        messages: [{ role: 'user', content: contenido }],
      }),
      signal: AbortSignal.timeout(240_000),
    });
    if (!r.ok) {
      const cuerpo = (await r.text()).slice(0, 300);
      throw new ErrorIA(`El proveedor de IA respondió ${r.status}: ${cuerpo}`, r.status === 429 || r.status >= 500);
    }
    const j = await r.json() as { model: string; content: { type: string; name?: string; input?: unknown }[]; usage?: { input_tokens: number; output_tokens: number } };
    const uso = j.content.find((c) => c.type === 'tool_use' && c.name === p.herramienta.nombre);
    if (!uso) throw new ErrorIA('La IA no devolvió una respuesta estructurada.', true);
    return { datos: uso.input, modelo: j.model, tokensEntrada: j.usage?.input_tokens, tokensSalida: j.usage?.output_tokens };
  }

  /**
   * Búsqueda web del propio proveedor (web_search): el modelo busca, lee los resultados y termina llamando a la
   * herramienta de salida. Se devuelven también las URL que aparecieron en los resultados, para comprobar que
   * la fuente que cite exista de verdad.
   */
  async buscar(p: PeticionBusqueda): Promise<RespuestaBusqueda> {
    type Bloque = { type: string; name?: string; input?: unknown; content?: unknown };
    const mensajes: { role: 'user' | 'assistant'; content: unknown }[] = [{ role: 'user', content: p.texto }];
    const fuentes = new Map<string, string>();
    for (let vuelta = 0; vuelta < 4; vuelta++) {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': this.clave, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: this.modelo,
          max_tokens: 4000,
          system: p.sistema,
          tools: [
            { type: 'web_search_20250305', name: 'web_search', max_uses: p.maxBusquedas ?? 4, user_location: { type: 'approximate', country: 'ES', timezone: 'Europe/Madrid' } },
            { name: p.herramienta.nombre, description: p.herramienta.descripcion, input_schema: p.herramienta.esquema },
          ],
          messages: mensajes,
        }),
        signal: AbortSignal.timeout(180_000),
      });
      if (!r.ok) {
        const cuerpo = (await r.text()).slice(0, 300);
        throw new ErrorIA(`La búsqueda en internet respondió ${r.status}: ${cuerpo}`, r.status === 429 || r.status >= 500);
      }
      const j = await r.json() as { model: string; stop_reason: string; content: Bloque[] };
      for (const b of j.content) {
        if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) {
          for (const x of b.content as { type: string; url?: string; title?: string }[]) if (x.url) fuentes.set(x.url, x.title ?? x.url);
        }
      }
      const uso = j.content.find((c) => c.type === 'tool_use' && c.name === p.herramienta.nombre);
      if (uso) return { datos: uso.input, modelo: j.model, fuentes: [...fuentes].map(([url, titulo]) => ({ url, titulo })) };
      if (j.stop_reason !== 'pause_turn') {
        // Terminó sin la salida estructurada: se le pide expresamente.
        mensajes.push({ role: 'assistant', content: j.content }, { role: 'user', content: `Registra ahora el resultado con la herramienta «${p.herramienta.nombre}».` });
      } else {
        mensajes.push({ role: 'assistant', content: j.content });
      }
    }
    throw new ErrorIA('La búsqueda en internet no devolvió un resultado estructurado.', true);
  }
}

// Solo para pruebas automatizadas: permite inyectar un proveedor controlado. No es accesible desde la interfaz.
let sustituto: ProveedorIA | null | undefined;
export function fijarProveedorDePrueba(p: ProveedorIA | null | undefined) {
  if (process.env.NODE_ENV === 'production') throw new Error('No disponible en producción');
  sustituto = p;
}

export function proveedorIA(): ProveedorIA | null {
  if (sustituto !== undefined) return sustituto;
  if ((process.env.AI_PROVIDER ?? 'anthropic') === 'anthropic' && process.env.ANTHROPIC_API_KEY) {
    return new Anthropic(process.env.ANTHROPIC_API_KEY, process.env.ANTHROPIC_MODEL || process.env.IA_MODELO || 'claude-sonnet-5-5');
  }
  return null;
}

export const iaConfigurada = () => proveedorIA() !== null;
