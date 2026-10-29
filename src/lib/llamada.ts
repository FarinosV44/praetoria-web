// Solicitud de llamada / contacto prioritario (#33). La usan el formulario (navegador) y la recepción
// en Hostinger (public/api/llamada.php): las mismas reglas en los dos lados. Sin dependencias.
// No promete disponibilidad: es una petición prioritaria que el despacho atiende según disponibilidad.
import { AREAS, fechaValida, limpia, telefonoValido, type AreaId } from './consulta.ts';
import { servicioPorId } from './servicios-indice.ts';

export const MOTIVOS = [
  { id: 'detencion', label: 'Detención (propia o de un familiar)' },
  { id: 'citacion', label: 'Citación del juzgado o de la policía' },
  { id: 'juicio', label: 'Juicio o comparecencia en fecha próxima' },
  { id: 'plazo', label: 'Plazo que vence pronto (recurso, reclamación, despido…)' },
  { id: 'notificacion', label: 'Notificación o requerimiento recibido' },
  { id: 'otro', label: 'Otro asunto que no puede esperar' },
] as const;
export type Motivo = (typeof MOTIVOS)[number]['id'];

/** Cómo contactar con seguridad: importa cuando otra persona puede ver el teléfono (violencia en el entorno, conflictos familiares). */
export const CONTACTO_SEGURO = [
  { id: 'libre', label: 'Podéis llamarme y dejar mensaje' },
  { id: 'sin-mensajes', label: 'Solo llamada: sin mensajes, SMS ni WhatsApp' },
  { id: 'discreto', label: 'Otra persona puede ver mi teléfono: llamad con discreción' },
] as const;

export const LIMITES_LLAMADA = { nombre: 100, telefono: 20, localidad: 80, franja: 80, descripcion: 500 } as const;

export const AVISO_LLAMADA =
  'Solicitud de contacto prioritario, sujeta a disponibilidad. El envío no confirma asistencia ni suspende plazos.';

export type Llamada = {
  id: string;
  nombre: string;
  telefono: string;
  area: AreaId;
  servicio: string;
  motivo: Motivo;
  /** Fecha de la citación, del juicio o del plazo (AAAA-MM-DD), opcional. Puede ser futura. Solo para priorizar. */
  fecha: string;
  localidad: string;
  seguro: (typeof CONTACTO_SEGURO)[number]['id'];
  /** Franja horaria en la que se puede llamar, opcional (texto libre corto) */
  franja: string;
  descripcion: string;
  privacidad: true;
  origen: string;
};
export type ErroresLlamada = Partial<Record<keyof Llamada, string>>;

export function validarLlamada(raw: Record<string, unknown>, ahora = Date.now()): { ok: true; data: Llamada } | { ok: false; errores: ErroresLlamada } {
  const origen = limpia(raw.origen).split(/[?#]/)[0] ?? '';
  const d = {
    id: limpia(raw.id),
    nombre: limpia(raw.nombre),
    telefono: limpia(raw.telefono),
    area: limpia(raw.area),
    servicio: limpia(raw.servicio),
    motivo: limpia(raw.motivo),
    fecha: limpia(raw.fecha),
    localidad: limpia(raw.localidad),
    seguro: limpia(raw.seguro) || 'libre',
    franja: limpia(raw.franja),
    descripcion: limpia(raw.descripcion),
    privacidad: raw.privacidad === true || raw.privacidad === 'on' || raw.privacidad === 'true',
    origen: /^\/[a-z0-9\-/._%]{0,199}$/i.test(origen) ? origen : '',
  };
  const e: ErroresLlamada = {};
  const max = (k: keyof typeof LIMITES_LLAMADA) => {
    if (d[k].length > LIMITES_LLAMADA[k]) e[k] = `Máximo ${LIMITES_LLAMADA[k]} caracteres.`;
  };
  if (d.nombre.length < 2) e.nombre = 'Escribe tu nombre.';
  max('nombre');
  if (!d.telefono) e.telefono = 'Necesitamos un teléfono para llamarte.';
  else if (!telefonoValido(d.telefono)) e.telefono = 'Revisa el teléfono: debe tener entre 9 y 15 cifras.';
  max('telefono');
  if (!AREAS.some((a) => a.id === d.area)) e.area = 'Elige el área (o «No sé qué área corresponde»).';
  if (d.servicio) {
    const sv = servicioPorId(d.servicio);
    if (!sv || sv.area !== d.area) d.servicio = ''; // un servicio que no encaja se descarta: nunca bloquea una petición urgente
  }
  if (!MOTIVOS.some((m) => m.id === d.motivo)) e.motivo = 'Elige el motivo más parecido.';
  if (d.fecha && !fechaValida(d.fecha, ahora, true)) e.fecha = 'Revisa la fecha: debe ser una fecha real.';
  max('localidad');
  if (!CONTACTO_SEGURO.some((x) => x.id === d.seguro)) e.seguro = 'Elige una opción de la lista.';
  max('franja');
  max('descripcion');
  if (!d.privacidad) e.privacidad = 'Necesitamos que aceptes la política de privacidad para llamarte.';
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(d.id)) e.id = 'Identificador de envío no válido.';
  return Object.keys(e).length ? { ok: false, errores: e } : { ok: true, data: d as Llamada };
}

/** Canal de la solicitud (aparece en el aviso): el área laboral tiene el suyo, como en las consultas. */
export const formularioLlamada = (area: string) => (area === 'laboral' ? 'llamada-urgente-laboral' : 'llamada-urgente');
