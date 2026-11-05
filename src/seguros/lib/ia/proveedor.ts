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

export interface ProveedorIA {
  nombre: string;
  modelo: string;
  /** Devuelve la llamada a la herramienta (salida estructurada). */
  pedir(p: PeticionIA): Promise<RespuestaIA>;
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
