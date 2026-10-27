import { fileTypeFromBuffer } from 'file-type';

// Validación del contenido REAL del archivo (firma binaria), no de la extensión ni del tipo que
// declara el navegador. Solo se admiten PDF e imágenes habituales de móvil y ordenador.
export const TIPOS = {
  'application/pdf': 'PDF',
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'image/webp': 'WEBP',
  'image/heic': 'HEIC',
  'image/heif': 'HEIF',
} as const;
export type Mime = keyof typeof TIPOS;

export async function detectarTipo(datos: Uint8Array): Promise<Mime | null> {
  const t = await fileTypeFromBuffer(datos);
  if (!t) return null;
  const m = t.mime === 'image/heic-sequence' ? 'image/heic' : t.mime === 'image/heif-sequence' ? 'image/heif' : t.mime;
  return (m in TIPOS ? m : null) as Mime | null;
}

/** Comprobaciones básicas de PDF: estructura mínima y sin JavaScript ni acciones automáticas incrustadas. */
export function pdfSospechoso(datos: Uint8Array): string | null {
  const muestra = Buffer.from(datos).toString('latin1');
  if (!muestra.includes('%%EOF')) return 'El PDF parece incompleto o dañado.';
  if (/\/JavaScript|\/JS\s*[(<]|\/Launch|\/EmbeddedFile|\/OpenAction\s*<<[^>]*\/JS/.test(muestra)) {
    return 'El PDF contiene elementos activos que no admitimos. Guárdalo de nuevo como PDF (Imprimir → Guardar como PDF) y vuelve a subirlo.';
  }
  return null;
}

export function nombreSeguro(nombre: string): string {
  const base = nombre.split(/[\\/]/).pop() ?? 'documento';
  const limpio = base.normalize('NFC').replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '').replace(/\s+/g, ' ').trim();
  return (limpio || 'documento').slice(0, 200);
}
