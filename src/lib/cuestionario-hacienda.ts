// Cuestionario de notificaciones de Hacienda / Seguridad Social (#8): listas, derivación al servicio adecuado
// y traspaso al formulario de consulta por sessionStorage (nunca por la URL). La revisión siempre es humana.

export const ORGANISMOS = [
  { id: 'aeat', label: 'Hacienda (AEAT)' },
  { id: 'tgss', label: 'Seguridad Social (TGSS)' },
  { id: 'inss', label: 'INSS' },
  { id: 'no-se', label: 'No lo sé' },
] as const;

export const DOCUMENTOS = [
  { id: 'requerimiento', label: 'Requerimiento de información o de justificación' },
  { id: 'liquidacion', label: 'Propuesta de liquidación o liquidación' },
  { id: 'sancion', label: 'Inicio de expediente sancionador o sanción' },
  { id: 'apremio', label: 'Reclamación de deuda o providencia de apremio' },
  { id: 'embargo', label: 'Diligencia de embargo' },
  { id: 'derivacion', label: 'Derivación de responsabilidad' },
  { id: 'prestacion', label: 'Resolución sobre una prestación' },
  { id: 'no-se', label: 'No lo sé' },
] as const;

export const IMPORTES_HACIENDA = ['No aparece ninguna cantidad', 'Menos de 3.000 €', 'Entre 3.000 € y 10.000 €', 'Entre 10.000 € y 50.000 €', 'Más de 50.000 €', 'No lo sé'] as const;

export type RespuestasHacienda = {
  organismo: string;
  documento: string;
  recibida: string;
  limite: string;
  importe: string;
  descripcion: string;
};

export const CLAVE_HACIENDA = 'praetoria:cuestionario-hacienda';

/**
 * Servicio al que se deriva. Las prestaciones (INSS o una resolución sobre una prestación) son de Laboral,
 * según el reparto de #7; las deudas y cotizaciones de la Seguridad Social, de Hacienda y SS.
 */
export function servicioHacienda(r: Pick<RespuestasHacienda, 'organismo' | 'documento'>) {
  if (r.organismo === 'inss' || r.documento === 'prestacion') return 'laboral-altas';
  if (r.documento === 'derivacion') return 'hacienda-derivacion';
  if (r.organismo === 'tgss') return 'hacienda-seguridad-social';
  return 'hacienda-requerimientos';
}

const fmt = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v.split('-').reverse().join('/') : '');
const label = <T extends readonly { id: string; label: string }[]>(list: T, id: string) => list.find((x) => x.id === id)?.label ?? '';

/** Resumen que acompaña a la consulta (sin nombre ni teléfono: esos van en sus campos) */
export function resumenHacienda(r: RespuestasHacienda) {
  return [
    `- Organismo: ${label(ORGANISMOS, r.organismo) || 'sin indicar'}`,
    r.documento && `- Documento: ${label(DOCUMENTOS, r.documento)}`,
    fmt(r.recibida) && `- Recibida o abierta el: ${fmt(r.recibida)}`,
    fmt(r.limite) && `- Fecha límite indicada: ${fmt(r.limite)}`,
    r.importe && `- Importe: ${r.importe}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function respuestasHaciendaValidas(raw: unknown): RespuestasHacienda | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const s = (k: string) => String(r[k] ?? '').slice(0, 900);
  const out = { organismo: s('organismo'), documento: s('documento'), recibida: s('recibida'), limite: s('limite'), importe: s('importe'), descripcion: s('descripcion') };
  if (!ORGANISMOS.some((x) => x.id === out.organismo)) return null;
  if (out.documento && !DOCUMENTOS.some((x) => x.id === out.documento)) return null;
  if (out.importe && !(IMPORTES_HACIENDA as readonly string[]).includes(out.importe)) out.importe = '';
  return out;
}

export const leerRespuestasHacienda = () => {
  try {
    return respuestasHaciendaValidas(JSON.parse(sessionStorage.getItem(CLAVE_HACIENDA) ?? 'null'));
  } catch {
    return null;
  }
};
export const guardarRespuestasHacienda = (r: RespuestasHacienda | null) => {
  try {
    if (r) sessionStorage.setItem(CLAVE_HACIENDA, JSON.stringify(r));
    else sessionStorage.removeItem(CLAVE_HACIENDA);
  } catch {
    /* sin almacenamiento: el resumen sigue disponible por WhatsApp o correo */
  }
};
