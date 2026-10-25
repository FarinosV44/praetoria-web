// Medición de embudos (#9). Eventos a Google Analytics (el gtag que carga CookieConsent) SOLO con consentimiento.
// Sin consentimiento o sin GA configurado, todo es una operación vacía: la web y las consultas funcionan igual.
//
// Nunca se envían datos personales: los parámetros pasan por una lista cerrada de claves y valores cortos
// con caracteres seguros (ids, rutas, slugs). Nombre, correo, teléfono o mensaje no tienen clave posible.
import { analiticaPermitida } from './consentimiento.ts';

export const EVENTOS = ['service_view', 'cta_click', 'whatsapp_click', 'phone_click', 'form_start', 'form_success'] as const;
export type Evento = (typeof EVENTOS)[number];

const CLAVES = ['area', 'servicio', 'tipo_pagina', 'ubicacion', 'destino', 'landing', 'origen'] as const;
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

export function medir(evento: Evento, params: Record<string, unknown> = {}) {
  if (typeof window === 'undefined' || !analiticaPermitida() || typeof window.gtag !== 'function') return;
  window.gtag('event', evento, limpiarParametros(params));
}
