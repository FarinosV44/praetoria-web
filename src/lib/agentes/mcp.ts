// Servidor MCP mínimo y sin estado (JSON-RPC 2.0 por POST). Sin dependencias del servidor: se prueba con datos en memoria.
import { herramientas } from './herramientas.ts';

export const VERSION_SERVIDOR = '1.0.0';
export const VERSIONES_MCP = ['2025-11-25', '2025-06-18', '2025-03-26'];

export type Entrada = { ruta: string; titulo: string; descripcion: string };
export type FuenteMcp = {
  indice: () => Entrada[];
  /** Markdown de una ruta; se llama solo con rutas del índice. */
  leer: (ruta: string) => string | null;
  contacto: Record<string, unknown>;
  sitio: string;
};

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const VACIAS = new Set(['como', 'con', 'las', 'los', 'del', 'por', 'para', 'que', 'una', 'uno', 'unos', 'unas', 'the', 'and']);

/** Coincidencias en título y resumen primero; el cuerpo solo desempata y amplía. */
export function buscar(fuente: FuenteMcp, consulta: string, limite: number) {
  const palabras = [...new Set(normalizar(consulta).split(/[^\p{L}\p{N}]+/u))].filter((p) => p.length >= 3 && !VACIAS.has(p));
  if (!palabras.length) return [];
  return fuente
    .indice()
    .map((e) => {
      const titulo = normalizar(e.titulo);
      const resumen = normalizar(e.descripcion);
      const cuerpo = normalizar(fuente.leer(e.ruta) ?? '');
      const puntos = palabras.reduce((t, p) => t + (titulo.includes(p) ? 5 : 0) + (resumen.includes(p) ? 3 : 0) + (cuerpo.includes(p) ? 1 : 0), 0);
      return { e, puntos };
    })
    .filter((r) => r.puntos > 0)
    .sort((a, b) => b.puntos - a.puntos || a.e.ruta.localeCompare(b.e.ruta))
    .slice(0, limite)
    .map(({ e }) => ({ ...e, url: new URL(e.ruta, fuente.sitio).href }));
}

/** Acepta «contacto», «/contacto» o la URL completa del sitio; cualquier otro dominio no es una ruta nuestra. */
export function normalizarRuta(entrada: string, sitio: string): string | null {
  let ruta = entrada.trim();
  if (/^https?:\/\//i.test(ruta)) {
    let url: URL;
    try {
      url = new URL(ruta);
    } catch {
      return null;
    }
    if (url.origin !== sitio) return null;
    ruta = url.pathname;
  }
  ruta = ruta.split(/[?#]/)[0]!;
  return `/${ruta}/`.replace(/\/{2,}/g, '/');
}

const texto = (t: string, isError = false) => ({ content: [{ type: 'text', text: t }], ...(isError ? { isError: true } : {}) });
const json = (v: unknown) => texto(JSON.stringify(v, null, 2));

function llamar(nombre: string, args: Record<string, unknown>, fuente: FuenteMcp) {
  if (nombre === 'buscar_contenido') {
    if (typeof args.consulta !== 'string' || args.consulta.trim().length < 2 || args.consulta.length > 200) return texto('«consulta» debe ser un texto de 2 a 200 caracteres.', true);
    const limite = typeof args.limite === 'number' ? Math.min(Math.max(Math.trunc(args.limite), 1), 10) : 5;
    return json(buscar(fuente, args.consulta, limite));
  }
  if (nombre === 'leer_pagina') {
    if (typeof args.ruta !== 'string' || args.ruta.length > 300) return texto('«ruta» debe ser un texto de hasta 300 caracteres.', true);
    const ruta = normalizarRuta(args.ruta, fuente.sitio);
    // Solo el índice decide qué se puede leer: una ruta inventada nunca llega al sistema de archivos
    const md = ruta && fuente.indice().some((e) => e.ruta === ruta) ? fuente.leer(ruta) : null;
    return md ? texto(md) : texto(`No hay ninguna página publicada en «${args.ruta}». Usa buscar_contenido para encontrar la ruta.`, true);
  }
  return json(fuente.contacto);
}

type Mensaje = { jsonrpc?: unknown; id?: unknown; method?: unknown; params?: Record<string, unknown> };

/** Responde a un mensaje JSON-RPC ya interpretado. `null`: era una notificación y no lleva respuesta. */
export function responderMcp(mensaje: unknown, fuente: FuenteMcp): object | null {
  const m = (mensaje && typeof mensaje === 'object' && !Array.isArray(mensaje) ? mensaje : {}) as Mensaje;
  const id = typeof m.id === 'string' || typeof m.id === 'number' ? m.id : null;
  const error = (code: number, message: string) => ({ jsonrpc: '2.0', id, error: { code, message } });
  if (m.jsonrpc !== '2.0' || typeof m.method !== 'string') return error(-32600, 'Petición JSON-RPC no válida');
  if (m.id === undefined) return null;
  const resultado = (result: object) => ({ jsonrpc: '2.0', id, result });

  switch (m.method) {
    case 'initialize': {
      const pedida = m.params?.protocolVersion;
      return resultado({
        protocolVersion: typeof pedida === 'string' && VERSIONES_MCP.includes(pedida) ? pedida : VERSIONES_MCP[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'praetoria-abogados', title: 'Praetoria Abogados', version: VERSION_SERVIDOR },
        instructions: 'Consulta de solo lectura de la web de Praetoria Abogados (Valencia, España). El contenido es información jurídica general, no asesoramiento sobre un caso concreto. Para un caso, remite a la persona a /contacto/.',
      });
    }
    case 'ping':
      return resultado({});
    case 'tools/list':
      return resultado({
        tools: herramientas.map((h) => ({ ...h, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } })),
      });
    case 'tools/call': {
      const nombre = m.params?.name;
      if (typeof nombre !== 'string' || !herramientas.some((h) => h.name === nombre)) return error(-32602, `Herramienta desconocida: ${String(nombre)}`);
      const args = m.params?.arguments;
      return resultado(llamar(nombre, args && typeof args === 'object' ? (args as Record<string, unknown>) : {}, fuente));
    }
    default:
      return error(-32601, `Método no disponible: ${m.method}`);
  }
}
