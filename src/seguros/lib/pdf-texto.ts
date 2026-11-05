import { q, type Db, pool } from './db';

/**
 * Texto por página de un PDF (capa de texto). Sirve para comprobar que las citas del asistente existen
 * en la página indicada. No es OCR: los escaneados devuelven páginas vacías y la lectura visual la hace la IA.
 */
export async function textoPorPagina(datos: Buffer): Promise<string[] | null> {
  try {
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await getDocument({ data: new Uint8Array(datos), useSystemFonts: false, verbosity: 0 }).promise;
    const paginas: string[] = [];
    for (let i = 1; i <= Math.min(doc.numPages, 500); i++) {
      const p = await doc.getPage(i);
      const t = await p.getTextContent();
      paginas.push(t.items.map((x) => ('str' in x ? x.str : '')).join(' ').replace(/\s+/g, ' ').trim());
    }
    await doc.cleanup();
    return paginas;
  } catch {
    return null; // PDF dañado o cifrado: el documento se conserva igualmente
  }
}

export async function guardarTextoDocumento(documentoId: string, datos: Buffer, db: Db = pool()) {
  const paginas = await textoPorPagina(datos);
  if (!paginas) return { paginas: null, conTexto: false };
  for (let i = 0; i < paginas.length; i++) {
    if (paginas[i]) await q('INSERT INTO documento_paginas (documento_id, pagina, texto) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [documentoId, i + 1, paginas[i]], db);
  }
  const conTexto = paginas.some((p) => p.length > 20);
  await q('UPDATE documentos SET paginas = $2, texto_extraido = $3 WHERE id = $1', [documentoId, paginas.length, conTexto], db);
  return { paginas: paginas.length, conTexto };
}

/** Normaliza para comparar citas: minúsculas, sin tildes, sin signos ni espacios repetidos. */
export const normalizar = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ]+/g, ' ').trim();

/**
 * ¿Aparece la cita en el texto de la página? Admite pequeñas diferencias (saltos de línea, guiones, OCR):
 * basta con que coincida un tramo continuo de al menos 8 palabras, o la cita completa si es más corta.
 */
export function citaEnTexto(cita: string, texto: string): boolean {
  const c = normalizar(cita).split(' ').filter(Boolean);
  const t = ` ${normalizar(texto)} `;
  if (c.length === 0) return false;
  const tramo = Math.min(8, c.length);
  for (let i = 0; i + tramo <= c.length; i++) {
    if (t.includes(` ${c.slice(i, i + tramo).join(' ')} `)) return true;
  }
  return false;
}
