import { DOCX, detectarTipo, nombreSeguro, pdfSospechoso } from '@/portal/lib/archivos';
import { personalApi, origenOk } from '@/portal/lib/api-personal';
import { extraerTexto } from '@/portal/lib/ia';

export const runtime = 'nodejs';
const MAX = 15 * 1024 * 1024;
const fallo = (status: number, error: string) => Response.json({ error }, { status, headers: { 'cache-control': 'no-store' } });

// Adjunto puntual para una consulta: valida el archivo por su contenido y devuelve su texto. No se guarda.
// En un expediente, los documentos se suben al propio expediente, donde quedan versionados e indexados.
export async function POST(req: Request) {
  if (!(await origenOk())) return fallo(403, 'Origen no permitido.');
  const s = await personalApi();
  if ('error' in s) return s.error;
  if (Number(req.headers.get('content-length') || 0) > MAX + 64 * 1024) return fallo(413, 'El archivo supera el máximo de 15 MB.');
  const f = (await req.formData().catch(() => null))?.get('archivo');
  if (!(f instanceof File) || f.size === 0) return fallo(400, 'No se ha recibido ningún archivo.');
  if (f.size > MAX) return fallo(413, 'El archivo supera el máximo de 15 MB.');
  const datos = new Uint8Array(await f.arrayBuffer());
  const mime = await detectarTipo(datos);
  if (mime !== 'application/pdf' && mime !== DOCX) return fallo(415, 'Adjunta un PDF o un Word (DOCX).');
  if (mime === 'application/pdf') { const r = pdfSospechoso(datos); if (r) return fallo(422, r); }
  try {
    const x = await extraerTexto(datos, mime);
    if (!x.paginas.length) return fallo(422, x.detalle ?? 'No se ha podido leer texto de este archivo.');
    return Response.json({ nombre: nombreSeguro(f.name), texto: x.paginas.join('\n\n').slice(0, 100_000) }, { headers: { 'cache-control': 'no-store' } });
  } catch { return fallo(422, 'No se ha podido leer este archivo.'); }
}
