// Cuestionario orientativo de divorcio (#7): preguntas, criterio del precio cerrado y resumen para la consulta.
// Las respuestas pasan al formulario de contacto por sessionStorage (solo en ese navegador y esa sesión), nunca por la URL.

export const preguntasDivorcio = [
  {
    id: 'necesidad',
    q: '¿Qué necesitas?',
    options: [
      'Quiero divorciarme o separarme',
      'Quiero modificar unas medidas anteriores',
      'Tengo problemas con el cumplimiento de un convenio o sentencia',
      'Necesito regular medidas de hijos sin estar casado/a',
      'No lo tengo claro',
    ],
  },
  {
    id: 'acuerdo',
    q: '¿Existe acuerdo con la otra parte?',
    options: ['Sí, estamos completamente de acuerdo', 'Hay acuerdo en algunas cuestiones', 'No hay acuerdo', 'Todavía no lo hemos hablado'],
  },
  { id: 'hijos', q: '¿Tenéis hijos en común?', options: ['No', 'Sí, mayores e independientes', 'Sí, menores o dependientes'] },
  {
    id: 'bienes',
    q: '¿Hay vivienda, bienes o deudas que deban regularse?',
    options: ['No', 'Sí, pero ya sabemos cómo repartirlos', 'Sí, y no existe acuerdo', 'No estoy seguro/a'],
  },
  {
    id: 'urgente',
    q: '¿Hay alguna cuestión urgente?',
    options: [
      'No, nada urgente',
      'Custodia o régimen de visitas',
      'Impago de pensión',
      'Vivienda familiar',
      'Traslado de residencia o cambio de colegio',
      'Medidas provisionales o situación especialmente conflictiva',
    ],
  },
] as const;

export type RespuestasDivorcio = Record<string, string>;
export const CLAVE_DIVORCIO = 'praetoria:cuestionario-divorcio';

/** El precio cerrado solo aplica al caso sencillo: mutuo acuerdo completo, sin hijos menores, sin bienes y sin urgencias. */
export function isSimpleCase(a: RespuestasDivorcio) {
  return (
    a.necesidad === 'Quiero divorciarme o separarme' &&
    a.acuerdo === 'Sí, estamos completamente de acuerdo' &&
    (a.hijos === 'No' || a.hijos === 'Sí, mayores e independientes') &&
    a.bienes === 'No' &&
    a.urgente === 'No, nada urgente'
  );
}

/** Solo respuestas válidas (de la lista) y completas; si no, null */
export function respuestasValidas(raw: unknown): RespuestasDivorcio | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const ok = preguntasDivorcio.every((p) => (p.options as readonly string[]).includes(String(r[p.id])));
  return ok ? Object.fromEntries(preguntasDivorcio.map((p) => [p.id, String(r[p.id])])) : null;
}

export function resumenDivorcio(a: RespuestasDivorcio) {
  const lineas = preguntasDivorcio.map((p) => `- ${p.q} ${a[p.id] ?? ''}`);
  const resultado = isSimpleCase(a)
    ? 'Resultado orientativo: podría tramitarse como mutuo acuerdo con precio cerrado (pendiente de confirmar).'
    : 'Resultado orientativo: necesita una valoración personalizada.';
  return [...lineas, resultado].join('\n');
}

export const leerRespuestasDivorcio = (): RespuestasDivorcio | null => {
  try {
    return respuestasValidas(JSON.parse(sessionStorage.getItem(CLAVE_DIVORCIO) ?? 'null'));
  } catch {
    return null;
  }
};
export const guardarRespuestasDivorcio = (a: RespuestasDivorcio | null) => {
  try {
    if (a) sessionStorage.setItem(CLAVE_DIVORCIO, JSON.stringify(a));
    else sessionStorage.removeItem(CLAVE_DIVORCIO);
  } catch {
    /* sin almacenamiento (modo privado o bloqueado): el cuestionario sigue funcionando, solo no se conserva */
  }
};
