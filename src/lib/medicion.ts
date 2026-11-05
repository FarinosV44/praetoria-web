// Medición de embudos (#9). Eventos a Google Analytics (el gtag que carga CookieConsent) SOLO con consentimiento.
// Sin consentimiento o sin GA configurado, todo es una operación vacía: la web y las consultas funcionan igual.
//
// Nunca se envían datos personales: los parámetros pasan por una lista cerrada de claves y valores cortos
// con caracteres seguros (ids, rutas, slugs). Nombre, correo, teléfono o mensaje no tienen clave posible.
import { analiticaPermitida } from './consentimiento.ts';

export const EVENTOS = ['service_view', 'cta_click', 'whatsapp_click', 'phone_click', 'form_start', 'form_success', 'page_context', 'scroll_depth', 'outbound_click', 'tool_start'] as const;
export type Evento = (typeof EVENTOS)[number];

const CLAVES = ['area', 'servicio', 'tipo_pagina', 'ubicacion', 'destino', 'landing', 'origen', 'categoria', 'profundidad', 'herramienta'] as const;
type Clave = (typeof CLAVES)[number];
export type Parametros = Partial<Record<Clave, string | undefined>>;

const VALOR = /^[a-z0-9/][a-z0-9_\-/.]{0,119}$/;

/** Solo claves permitidas y valores seguros (minúsculas, sin espacios, @, ? ni =) */
export function limpiarParametros(p: Record<string, unknown>): Parametros {
  const out: Parametros = {};
  for (const k of CLAVES) {
    const v = typeof p[k] === 'string' ? (p[k] as string).toLowerCase() : '';
    if (v && VALOR.test(v)) out[k] = v;
  }
  return out;
}

export const PROFUNDIDADES = [25, 50, 75, 100];

/** Umbrales de desplazamiento alcanzados por primera vez; los anota en `vistas` para no repetirlos. */
export function profundidadesNuevas(porcentaje: number, vistas: Set<number>): number[] {
  const nuevas = PROFUNDIDADES.filter((p) => porcentaje >= p && !vistas.has(p));
  nuevas.forEach((p) => vistas.add(p));
  return nuevas;
}

const LEGALES = ['/aviso-legal/', '/politica-de-privacidad/', '/politica-de-cookies/'];

/** Tipo de página por su ruta. Las áreas, los servicios y los artículos se reconocen antes, con sus propios datos. */
export function tipoDePagina(path: string): string {
  if (path === '/') return 'portada';
  if (path.startsWith('/blog/')) return 'blog';
  if (path === '/contacto/' || path === '/que-me-llame-un-abogado/') return 'contacto';
  return LEGALES.includes(path) ? 'legal' : 'otra';
}

export function medir(evento: Evento, params: Record<string, unknown> = {}) {
  if (typeof window === 'undefined' || !analiticaPermitida() || typeof window.gtag !== 'function') return;
  window.gtag('event', evento, limpiarParametros(params));
}
