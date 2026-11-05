/** Tipos admitidos, detectados por su contenido real y no por la extensión ni el tipo que declara el navegador. */
export const TIPOS_ADMITIDOS = {
  'application/pdf': 'PDF',
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
  'image/heic': 'HEIC',
} as const;
export type MimeAdmitido = keyof typeof TIPOS_ADMITIDOS;

export function detectarTipo(b: Buffer): MimeAdmitido | null {
  if (b.length < 12) return null;
  if (b.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  if (b.subarray(4, 8).toString('latin1') === 'ftyp' && /^(heic|heix|mif1|msf1|heim|heis)$/.test(b.subarray(8, 12).toString('latin1'))) return 'image/heic';
  return null;
}
