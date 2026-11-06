// Catálogo y reglas de los modelos del Copiloto Jurídico. Funciones puras: sin servidor ni red, para probarlas directamente.
// Las tarifas son las publicadas en USD por millón de tokens; el coste que se muestra es siempre una estimación.
// Las de OpenAI no se dan por supuestas: se configuran en Ajustes de IA hasta confirmarlas con la cuenta real.

export type Proveedor = 'anthropic' | 'openai';
export type Modo = 'rapido' | 'equilibrado' | 'maximo';
export type Tarifa = { entrada: number; salida: number; cacheLectura?: number; cacheEscritura?: number };
export type Consumo = { entrada: number | null; salida: number | null; cacheLectura?: number | null; cacheEscritura?: number | null };

export const MODOS: Record<Modo, { t: string; ayuda: string }> = {
  rapido: { t: 'Rápido', ayuda: 'Consultas breves y sencillas' },
  equilibrado: { t: 'Equilibrado', ayuda: 'El trabajo diario con expedientes' },
  maximo: { t: 'Máxima calidad', ayuda: 'Escritos y análisis complejos: prima la profundidad jurídica sobre el coste y el tiempo' },
};

export const TARIFAS: Record<string, Tarifa> = {
  'claude-fable-5-1': { entrada: 10, salida: 50, cacheLectura: 0.25 },
  'claude-fable-5': { entrada: 10, salida: 50 },
  'claude-opus-5-5': { entrada: 4, salida: 20, cacheLectura: 0.2 },
  'claude-opus-5': { entrada: 5, salida: 25 },
  'claude-sonnet-5-5': { entrada: 2, salida: 10, cacheLectura: 0.2 },
  'claude-sonnet-5': { entrada: 2, salida: 10 },
  'claude-haiku-5-5': { entrada: 0.1, salida: 0.5 },
};

export const MODELOS_SUGERIDOS: Record<Proveedor, string[]> = {
  anthropic: ['claude-fable-5-1', 'claude-opus-5-5', 'claude-opus-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'],
  openai: ['gpt-6-astra'],
};

// Modelos que admiten el reintento automático en el servidor de Anthropic cuando un clasificador rechaza la petición.
const CON_FALLBACK_SERVIDOR = new Set(['claude-fable-5-1', 'claude-opus-5-5', 'claude-opus-5', 'claude-sonnet-5-5']);

export const MODELO_VALIDO = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{2,79}$/;
export const proveedorDe = (modelo: string): Proveedor => (modelo.startsWith('claude-') ? 'anthropic' : 'openai');

/** Cuánto razona el modelo en cada modo. Máxima calidad no ahorra: usa el máximo que admite la API. */
export const esfuerzo = (modo: Modo): 'medium' | 'high' | 'max' => ({ rapido: 'medium', equilibrado: 'high', maximo: 'max' } as const)[modo];
export const maxTokens = (modo: Modo, pedido?: number) => pedido ?? ({ rapido: 16_000, equilibrado: 32_000, maximo: 64_000 } as const)[modo];

/** Parámetros de Anthropic para un modelo y un modo. El fallback del servidor solo cubre rechazos de clasificadores. */
export function parametrosAnthropic(modelo: string, modo: Modo) {
  return {
    thinking: { type: 'adaptive' as const, display: 'summarized' as const },
    output_config: { effort: esfuerzo(modo) },
    ...(CON_FALLBACK_SERVIDOR.has(modelo) ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
  };
}

/** Razonamiento para OpenAI: solo a los modelos que lo admiten; a los demás, no se les envía el parámetro. */
export function parametrosOpenAI(modelo: string, modo: Modo) {
  return /^(gpt-[5-9]|o\d)/.test(modelo) ? { reasoning: { effort: ({ rapido: 'low', equilibrado: 'medium', maximo: 'high' } as const)[modo] } } : {};
}

/** Coste estimado en USD, o null si no hay tarifa conocida (nunca se finge un coste de cero). */
export function costeUsd(modelo: string, c: Consumo, extra: Record<string, Tarifa> = {}): number | null {
  const t = extra[modelo] ?? TARIFAS[modelo];
  if (!t || c.entrada == null || c.salida == null) return null;
  const lectura = t.cacheLectura ?? t.entrada * 0.1;
  const escritura = t.cacheEscritura ?? t.entrada * 1.25;
  const total = c.entrada * t.entrada + c.salida * t.salida + (c.cacheLectura ?? 0) * lectura + (c.cacheEscritura ?? 0) * escritura;
  return Math.round((total / 1_000_000) * 1_000_000) / 1_000_000;
}

export type AjustesModelos = {
  proveedor: Proveedor; modo: Modo; modelos: Partial<Record<Proveedor, Partial<Record<Modo, string>>>>;
  fallback_proveedor: Proveedor | null; fallback_modelo: string | null; openai_autorizado: boolean;
};
export type Claves = { anthropic: boolean; openai: boolean };
export type Candidato = { proveedor: Proveedor; modelo: string; modo: Modo; esFallback: boolean };

/** Orden de intento: el modelo pedido y, si falla el proveedor, el fallback configurado (avisando siempre de que se usó). */
export function candidatos(a: AjustesModelos, claves: Claves, pedido: { proveedor?: Proveedor; modo?: Modo; modelo?: string } = {}): { lista: Candidato[]; problema: string | null } {
  const modo = pedido.modo ?? a.modo;
  const proveedor = pedido.modelo ? proveedorDe(pedido.modelo) : pedido.proveedor ?? a.proveedor;
  const modelo = pedido.modelo ?? a.modelos[proveedor]?.[modo];
  const usable = (p: Proveedor) => claves[p] && (p !== 'openai' || a.openai_autorizado);
  if (!modelo || !MODELO_VALIDO.test(modelo)) return { lista: [], problema: `No hay un modelo configurado para ${proveedor} en modo ${MODOS[modo].t}.` };
  // Lo pedido no se cambia por otra cosa sin decirlo: si ese proveedor no está disponible, se informa del motivo.
  if (proveedor === 'openai' && !a.openai_autorizado) return { lista: [], problema: 'OpenAI no está autorizado para este despacho. Actívalo en Ajustes de IA tras revisar el tratamiento de datos.' };
  if (!claves[proveedor]) return { lista: [], problema: `Falta la clave de ${proveedor === 'openai' ? 'OpenAI' : 'Anthropic'} en el servidor.` };
  const lista: Candidato[] = [{ proveedor, modelo, modo, esFallback: false }];
  if (a.fallback_modelo && a.fallback_proveedor && a.fallback_modelo !== modelo && usable(a.fallback_proveedor) && MODELO_VALIDO.test(a.fallback_modelo)) {
    lista.push({ proveedor: a.fallback_proveedor, modelo: a.fallback_modelo, modo, esFallback: true });
  }
  return { lista, problema: null };
}

/** Límites de gasto del despacho. Sin límite configurado no se bloquea. */
export function limiteSuperado(l: { diario: number | null; mensual: number | null; gastoDia: number; gastoMes: number; consultasHora: number; porHora: number }): string | null {
  if (l.consultasHora >= l.porHora) return `Has alcanzado el límite de ${l.porHora} consultas por hora.`;
  if (l.diario != null && l.gastoDia >= l.diario) return `Se ha alcanzado el límite diario de gasto en IA (${l.diario} USD). Puede ampliarse en Ajustes de IA.`;
  if (l.mensual != null && l.gastoMes >= l.mensual) return `Se ha alcanzado el límite mensual de gasto en IA (${l.mensual} USD). Puede ampliarse en Ajustes de IA.`;
  return null;
}
