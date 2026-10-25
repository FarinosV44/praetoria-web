// Preferencia de cookies (#9). Una sola fuente para el aviso (CookieConsent), la medición y la atribución.
export const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
export const CLAVE_CONSENTIMIENTO = 'praetoria-consent';
/** Se emite al cambiar la preferencia, para que la medición reaccione sin recargar */
export const EVENTO_CONSENTIMIENTO = 'praetoria:consent';

export type Eleccion = 'granted' | 'denied';

export function leerConsentimiento(): Eleccion | null {
  try {
    const v = localStorage.getItem(CLAVE_CONSENTIMIENTO);
    return v === 'granted' || v === 'denied' ? v : null;
  } catch {
    return null;
  }
}

export function guardarConsentimiento(v: Eleccion) {
  try {
    localStorage.setItem(CLAVE_CONSENTIMIENTO, v);
  } catch {
    /* navegador sin almacenamiento: la elección dura lo que la visita */
  }
  window.dispatchEvent(new CustomEvent(EVENTO_CONSENTIMIENTO, { detail: v }));
}

/** Analítica permitida: hay ID configurado y la persona ha aceptado */
export const analiticaPermitida = () => !!GA_ID && leerConsentimiento() === 'granted';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    __gaLoaded?: boolean;
  }
}
