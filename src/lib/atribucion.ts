// Atribución de consultas (#9).
// - origen: la página de la web desde la que se llega al formulario. Funcional, sin almacenamiento (en memoria).
// - landing y UTM de la primera página de la visita: SOLO con consentimiento de analítica (sessionStorage).
//   Si se rechaza, se borran. Se envían con la consulta para medir de dónde vienen las consultas confirmadas.
import { analiticaPermitida } from './consentimiento.ts';

const CLAVE = 'praetoria:atribucion';
export const UTM = ['utm_source', 'utm_medium', 'utm_campaign'] as const;
export type Atribucion = { landing: string } & Partial<Record<(typeof UTM)[number], string>>;

/** Ruta interna saneada: solo el pathname, sin consulta ni fragmento */
export const rutaLimpia = (p: string) => {
  const r = p.split(/[?#]/)[0] ?? '';
  return /^\/[a-z0-9\-/._%]{0,199}$/i.test(r) ? r : '';
};
export const utmLimpio = (v: string | null) => {
  const s = (v ?? '').trim().toLowerCase();
  return /^[a-z0-9_\-.]{1,60}$/.test(s) ? s : '';
};

export function registrarAtribucion(url: URL) {
  if (!analiticaPermitida()) return borrarAtribucion();
  try {
    if (sessionStorage.getItem(CLAVE)) return; // primera página de la visita
    const a: Atribucion = { landing: rutaLimpia(url.pathname) };
    for (const k of UTM) {
      const v = utmLimpio(url.searchParams.get(k));
      if (v) a[k] = v;
    }
    sessionStorage.setItem(CLAVE, JSON.stringify(a));
  } catch {
    /* sin almacenamiento: sin atribución */
  }
}

export function leerAtribucion(): Atribucion | null {
  if (!analiticaPermitida()) return null;
  try {
    const a = JSON.parse(sessionStorage.getItem(CLAVE) ?? 'null') as Atribucion | null;
    return a && typeof a.landing === 'string' ? a : null;
  } catch {
    return null;
  }
}

export function borrarAtribucion() {
  try {
    sessionStorage.removeItem(CLAVE);
  } catch {
    /* nada que borrar */
  }
}

// Ruta anterior dentro de la web (navegación del lado del cliente: document.referrer no cambia)
let rutaActual = '';
let rutaAnterior = '';
export function anotarRuta(path: string) {
  if (path === rutaActual) return;
  rutaAnterior = rutaActual;
  rutaActual = path;
}
/** Página de la web desde la que se llegó a la actual (o '' si se entró directamente) */
export function paginaOrigen() {
  if (rutaAnterior) return rutaLimpia(rutaAnterior);
  try {
    const ref = new URL(document.referrer);
    return ref.origin === location.origin ? rutaLimpia(ref.pathname) : '';
  } catch {
    return '';
  }
}
