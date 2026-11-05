// Salvaguardas del redactor (#94): funciones puras, sin dependencias del servidor, para poder probarlas directamente.
// Evitan que un borrador lleve datos de otros asuntos o jurisprudencia sin fuente, y listan las normas citadas.

/** Patrones de datos identificables (también los usa el redactor para no trasvasar datos de otros asuntos). */
export const PATRONES_IDENTIFICABLES: [RegExp, string][] = [
  [/\b\d{8}[A-HJ-NP-TV-Z]\b/g, 'DNI'], [/\b[XYZ]\d{7}[A-HJ-NP-TV-Z]\b/g, 'NIE'], [/\b[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]\b/g, 'CIF'],
  [/\bES\d{2}(?:\s?\d{4}){5}\b/g, 'IBAN'], [/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, 'correo electrónico'],
  [/(?<!\d)(?:\+34\s?)?[6789]\d{2}\s?\d{3}\s?\d{3}(?!\d)/g, 'teléfono'],
  [/\b\d{1,5}\/\d{4}\b/g, 'número de procedimiento o autos'], [/\b(?:calle|c\/|avda\.?|avenida|plaza|pza\.?)\s+[A-ZÁÉÍÓÚÑ][^\n,]{2,40},?\s*(?:n[ºo°.]?\s*)?\d+/gi, 'dirección postal'],
  [/\b(?:D\.|Dña\.|Don|Doña)\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){1,3}/g, 'nombre de persona'],
  [/\bmatr[ií]cula\s+\d{4}\s?[A-Z]{3}\b/gi, 'matrícula'],
];

export const normaliza = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');

const NORMA_ANTES = /(ley|org[aá]nica|decreto|legislativo|directiva|reglamento|orden|circular|instrucci[oó]n|rd|lo|real)\s*$/i;
const IMPORTE = /\b\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?\s?(?:€|euros)/gi;

/** Datos identificables del borrador que están en algún modelo pero no en el expediente: se retiran. */
export function retirarTrasvases(borrador: string, textoModelos: string, textoCaso: string): { texto: string; retirados: string[] } {
  const caso = normaliza(textoCaso), modelos = normaliza(textoModelos);
  const retirados = new Set<string>();
  let texto = borrador;
  for (const re of [...PATRONES_IDENTIFICABLES.map(([r]) => r), IMPORTE]) {
    texto = texto.replace(new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`), (m: string, ...args: unknown[]) => {
      const pos = args.find((a) => typeof a === 'number') as number;
      if (/^\d{1,5}\/\d{4}$/.test(m) && NORMA_ANTES.test(texto.slice(Math.max(0, pos - 30), pos).replace(/[\s,]*(n[ºo°.]\s*)?$/i, ''))) return m;
      const n = normaliza(m);
      if (modelos.includes(n) && !caso.includes(n)) { retirados.add(m); return '[PENDIENTE: dato de otro asunto retirado]'; }
      return m;
    });
  }
  return { texto, retirados: [...retirados] };
}

const JURIS = /\b(?:ECLI:ES:[A-Z]{1,6}:\d{4}:\d{1,6}[A-Z]?|Roj:?\s*[A-Z]{2,4}\s*\d{1,6}\/\d{4}|(?:STS|SSTS|STSJ|SAP|STC|SAN|SJ[A-Z]{0,4}|ATS|AAP)\s+(?:\d{1,5}\/\d{4}|de\s+\d{1,2}\s+de\s+[a-z]+\s+de\s+\d{4}))/gi;

/** Jurisprudencia del borrador que no figura en ningún modelo ni fuente: se retira (no se inventan sentencias). */
export function retirarJurisprudencia(borrador: string, textoFuentes: string): { texto: string; retiradas: string[] } {
  const base = normaliza(textoFuentes);
  const retiradas: string[] = [];
  const texto = borrador.replace(JURIS, (m) => {
    if (base.includes(normaliza(m))) return m;
    retiradas.push(m);
    return '[PENDIENTE: cita de jurisprudencia retirada por no constar en las fuentes]';
  });
  return { texto, retiradas };
}

const NORMAS = /\b(?:art(?:[íi]culo|s?\.)\s*\d+[\w.º°]*(?:\s*(?:,|y)\s*\d+[\w.º°]*)*(?:\s+(?:LEC|LRJS|LGT|LJCA|CC|CP|LSC|ET|LPACAP|LOTT|LOPJ)\b|\s+(?:de la|del|de)\s+[A-ZÁÉÍÓÚ][\wÁÉÍÓÚáéíóúñ./ ]{1,60}?(?=[,.;)\n]|\s(?:y|en|que|para|por)\b)|(?=[\s,.;)]|$))|(?:Ley(?: Org[aá]nica)?|Real Decreto(?: Legislativo| Ley)?|RDL?|LO)\s+\d{1,4}\/\d{4}|\b(?:LEC|LRJS|LGT|LJCA|CC|CP|LSC|ET|LPACAP|LOTT)\b)/g;

/** Referencias normativas del borrador: todas quedan «sin verificar con fuente oficial». */
export function referenciasNormativas(texto: string): string[] {
  return [...new Set((texto.match(NORMAS) ?? []).map((m) => m.trim().replace(/\s+/g, ' ')))].slice(0, 60);
}

