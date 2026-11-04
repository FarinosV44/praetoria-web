import { inflateSync } from 'node:zlib';
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
  if (!(m in TIPOS)) return null;
  // Políglotas (auditoría M4): una imagen que lleva un PDF en su primer kilobyte la abriría un lector de PDF.
  if (m !== 'application/pdf' && Buffer.from(datos.subarray(0, 1024)).toString('latin1').includes('%PDF')) return null;
  return m as Mime;
}

const EXTENSIONES: Record<Mime, string> = {
  'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif',
};
/** Extensión que corresponde al tipo detectado (la del nombre que pone el cliente no cuenta). */
export const extensionDe = (mime: string) => EXTENSIONES[mime as Mime] ?? 'bin';

// Elementos activos de PDF que no admitimos, una vez normalizados los nombres (#xx) y descomprimidos los flujos.
const ACTIVOS = /\/(JavaScript|JS|Launch|EmbeddedFile|EmbeddedFiles|RichMedia|XFA|SubmitForm|ImportData|GoToR|GoToE|AA)\b/;
const normalizarNombres = (t: string) => t.replace(/#([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

/** Texto del PDF con los flujos FlateDecode descomprimidos (máximo 40 MB descomprimidos en total). */
function textoPdf(datos: Uint8Array): string {
  const bruto = Buffer.from(datos);
  const texto = bruto.toString('latin1');
  const partes: string[] = [texto];
  let total = 0;
  const re = /stream\r?\n/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto))) {
    const ini = m.index + m[0].length;
    const fin = texto.indexOf('endstream', ini);
    if (fin < 0) break;
    try {
      const d = inflateSync(bruto.subarray(ini, fin), { maxOutputLength: 10 * 1024 * 1024 });
      total += d.length;
      if (total > 40 * 1024 * 1024) break;
      partes.push(d.toString('latin1'));
    } catch { /* flujo no comprimido o con otro filtro: ya está en el texto bruto */ }
    re.lastIndex = fin;
  }
  return normalizarNombres(partes.join('\n'));
}

/** Comprobaciones básicas de PDF: estructura mínima y sin JavaScript ni acciones automáticas incrustadas. */
export function pdfSospechoso(datos: Uint8Array): string | null {
  const muestra = Buffer.from(datos).toString('latin1');
  if (!muestra.includes('%%EOF')) return 'El PDF parece incompleto o dañado.';
  // Auditoría M3: se miran también los objetos comprimidos (ObjStm) y los nombres escritos con #xx.
  if (ACTIVOS.test(textoPdf(datos))) {
    return 'El PDF contiene elementos activos que no admitimos. Guárdalo de nuevo como PDF (Imprimir → Guardar como PDF) y vuelve a subirlo.';
  }
  return null;
}

export function nombreSeguro(nombre: string): string {
  const base = nombre.split(/[\\/]/).pop() ?? 'documento';
  const limpio = base.normalize('NFC').replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '').replace(/\s+/g, ' ').trim();
  return (limpio || 'documento').slice(0, 200);
}
