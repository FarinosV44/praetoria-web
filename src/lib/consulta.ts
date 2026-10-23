// Modelo y validación de una consulta. Lo usan el formulario (navegador) y la función
// netlify/functions/consulta.mts (servidor): las mismas reglas en los dos lados.
// Importaciones relativas con extensión: Node ejecuta este archivo directamente en la función y en las pruebas.
// Sin dependencias (ni zod): este módulo también va al navegador y su peso cuenta (presupuesto de #4).
import { site, laboral } from './site.ts';
import { INCIDENCIAS, servicioPorId } from './servicios.ts';

export const AREAS = [
  { id: 'transporte', label: 'Transporte y logística' },
  { id: 'mercantil', label: 'Mercantil y sociedades' },
  { id: 'hacienda', label: 'Hacienda y Seguridad Social' },
  { id: 'laboral', label: 'Laboral' },
  { id: 'civil', label: 'Civil, herencias y vivienda' },
  { id: 'familia', label: 'Familia y divorcio' },
  { id: 'arte', label: 'Arte y patrimonio' },
  { id: 'no-se', label: 'No sé qué área corresponde' },
] as const;
export type AreaId = (typeof AREAS)[number]['id'];

export const PREFERENCIAS = [
  { id: 'llamada', label: 'Llamada' },
  { id: 'correo', label: 'Correo' },
  { id: 'whatsapp', label: 'WhatsApp' },
] as const;
export type Preferencia = (typeof PREFERENCIAS)[number]['id'];

/** Datos breves de transporte (#6). Opcionales; solo se recogen si el área es transporte. La documentación se pide después. */
export const PAPELES = [
  { id: 'transportista', label: 'Transportista (hago el porte)' },
  { id: 'agencia', label: 'Agencia, transitario u operador logístico' },
  { id: 'cargador', label: 'Cargador (envío la mercancía)' },
  { id: 'destinatario', label: 'Destinatario (recibo la mercancía)' },
  { id: 'otro', label: 'Otro' },
] as const;
export const IMPORTES = [
  { id: 'hasta-3000', label: 'Hasta 3.000 €' },
  { id: '3000-15000', label: 'Entre 3.000 y 15.000 €' },
  { id: 'mas-15000', label: 'Más de 15.000 €' },
  { id: 'no-se', label: 'No lo sé o no aplica' },
] as const;
export { INCIDENCIAS };

export const LIMITES = { nombre: 100, email: 254, telefono: 20, mensaje: 2000, mensajeMin: 20 } as const;
/** Un envío hecho en menos de este tiempo desde que se cargó el formulario se trata como automático. */
export const TIEMPO_MINIMO_MS = 3000;

/** Contacto responsable según el área: Laboral lo atiende Lucía López; el resto, el contacto general. */
export function responsable(area: AreaId) {
  return area === 'laboral'
    ? { nombre: laboral.name, telefono: laboral.phone }
    : { nombre: site.lawyer, telefono: site.phone };
}

const fechaValida = (v: string, ahora: number) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const t = Date.parse(v + 'T00:00:00Z');
  // Fecha real (no 2026-02-31), desde 2000 y como mucho mañana (margen por zona horaria)
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === v && v >= '2000-01-01' && t <= ahora + 86_400_000;
};
const telefonoValido = (v: string) => /^\+?\d{9,15}$/.test(v.replace(/[\s().-]/g, ''));
const emailValido = (v: string) => /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(v);
// Quita caracteres de control (salvo saltos de línea y tabuladores) y espacios sobrantes
const limpia = (v: unknown) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();

export type Consulta = {
  nombre: string;
  email: string;
  telefono: string;
  area: AreaId;
  mensaje: string;
  preferencia: Preferencia;
  privacidad: true;
  id: string;
  /** Servicio preseleccionado desde un CTA (opcional). Debe pertenecer al área elegida. */
  servicio: string;
  /** Transporte (opcionales, vacíos en otras áreas) */
  papel: string;
  incidencia: string;
  importe: string;
  /** Fecha relevante (AAAA-MM-DD): factura, entrega o incidencia. Solo para priorizar; no se calculan plazos */
  fecha: string;
};
export type ErroresConsulta = Partial<Record<keyof Consulta, string>>;

/** Valida datos crudos (de un formulario o de JSON) y devuelve la consulta o los errores por campo. */
export function validarConsulta(raw: Record<string, unknown>, ahora = Date.now()): { ok: true; data: Consulta } | { ok: false; errores: ErroresConsulta } {
  const d = {
    nombre: limpia(raw.nombre),
    email: limpia(raw.email),
    telefono: limpia(raw.telefono),
    area: limpia(raw.area),
    mensaje: limpia(raw.mensaje),
    preferencia: limpia(raw.preferencia),
    privacidad: raw.privacidad === true || raw.privacidad === 'on' || raw.privacidad === 'true',
    id: limpia(raw.id),
    servicio: limpia(raw.servicio),
    papel: limpia(raw.papel),
    incidencia: limpia(raw.incidencia),
    importe: limpia(raw.importe),
    fecha: limpia(raw.fecha),
  };
  // Los datos de transporte solo tienen sentido en esa área: en otra se descartan
  if (d.area !== 'transporte') d.papel = d.incidencia = d.importe = d.fecha = '';
  const e: ErroresConsulta = {};
  const max = (k: 'nombre' | 'email' | 'telefono' | 'mensaje') => {
    if (d[k].length > LIMITES[k]) e[k] = `Máximo ${LIMITES[k]} caracteres.`;
  };

  if (d.nombre.length < 2) e.nombre = 'Escribe tu nombre.';
  max('nombre');
  if (!AREAS.some((a) => a.id === d.area)) e.area = 'Elige el área de tu consulta (o «No sé qué área corresponde»).';
  if (d.mensaje.length < LIMITES.mensajeMin) e.mensaje = `Cuéntanos un poco más (mínimo ${LIMITES.mensajeMin} caracteres).`;
  max('mensaje');
  if (!PREFERENCIAS.some((p) => p.id === d.preferencia)) e.preferencia = 'Elige cómo prefieres que te contactemos.';
  if (d.email && !emailValido(d.email)) e.email = 'Revisa el correo: no parece una dirección válida.';
  if (d.preferencia === 'correo' && !d.email) e.email = 'Para responderte por correo necesitamos tu correo electrónico.';
  max('email');
  if ((d.preferencia === 'llamada' || d.preferencia === 'whatsapp') && !d.telefono) {
    e.telefono = `Para ${d.preferencia === 'llamada' ? 'llamarte' : 'escribirte por WhatsApp'} necesitamos tu teléfono.`;
  } else if (d.telefono && !telefonoValido(d.telefono)) e.telefono = 'Revisa el teléfono: debe tener entre 9 y 15 cifras.';
  max('telefono');
  if (!d.privacidad) e.privacidad = 'Necesitamos que aceptes la política de privacidad para responderte.';
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(d.id)) e.id = 'Identificador de envío no válido.';
  if (d.servicio) {
    const sv = servicioPorId(d.servicio);
    if (!sv) e.servicio = 'El servicio indicado no existe.';
    else if (sv.area !== d.area) e.servicio = 'El servicio elegido no corresponde al área de la consulta.';
  }

  if (d.papel && !PAPELES.some((x) => x.id === d.papel)) e.papel = 'Elige una opción de la lista.';
  if (d.incidencia && !INCIDENCIAS.some((x) => x.id === d.incidencia)) e.incidencia = 'Elige una opción de la lista.';
  if (d.importe && !IMPORTES.some((x) => x.id === d.importe)) e.importe = 'Elige una opción de la lista.';
  if (d.fecha && !fechaValida(d.fecha, ahora)) e.fecha = 'Revisa la fecha: debe ser una fecha real y no posterior a hoy.';

  return Object.keys(e).length ? { ok: false, errores: e } : { ok: true, data: d as Consulta };
}

/** Señales de envío automático: campo trampa relleno o envío demasiado rápido (o con marca de tiempo imposible). */
export function pareceAutomatico(raw: Record<string, unknown>, ahora = Date.now()) {
  if (String(raw['empresa-web'] ?? '').trim() !== '') return true;
  const t = Number(raw.t);
  if (!Number.isFinite(t)) return true;
  const transcurrido = ahora - t;
  return transcurrido < TIEMPO_MINIMO_MS || transcurrido > 1000 * 60 * 60 * 24;
}
