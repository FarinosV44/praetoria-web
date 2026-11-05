import { Readable } from 'node:stream';
import { usuarioApi } from '@/seguros/lib/auth/servidor';
import { documentoParaDescarga } from '@/seguros/lib/datos/documentos';
import { almacen } from '@/seguros/lib/almacen';
import { auditar } from '@/seguros/lib/auditoria';
import { NoEncontrado } from '@/seguros/lib/errores';

export const dynamic = 'force-dynamic';

const noEncontrado = () => new Response('No encontrado', { status: 404, headers: { 'Cache-Control': 'no-store' } });

/**
 * Sirve un documento privado tras comprobar la sesión y el permiso sobre su titular (#8).
 * Nunca hay URL pública permanente: sin sesión válida responde 404 igual que si no existiera.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await usuarioApi();
  if (!u) return noEncontrado();
  let doc;
  try {
    doc = await documentoParaDescarga(u, id);
  } catch (e) {
    if (e instanceof NoEncontrado) return noEncontrado();
    throw e;
  }
  const descargar = new URL(req.url).searchParams.has('descargar');
  const { stream, bytes } = await almacen().leer(doc.clave_almacen);
  await auditar(u.id, 'documento_descargado', 'documento', doc.id, doc.titular_id, { modo: descargar ? 'descarga' : 'vista' });
  const nombre = encodeURIComponent(doc.nombre_original);
  const ascii = doc.nombre_original.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '');
  return new Response(Readable.toWeb(stream as Readable) as ReadableStream, {
    headers: {
      'Content-Type': doc.mime,
      'Content-Length': String(bytes),
      'Content-Disposition': `${descargar ? 'attachment' : 'inline'}; filename="${ascii}"; filename*=UTF-8''${nombre}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex, nofollow',
      // Se puede previsualizar dentro de la propia aplicación, nunca desde otro sitio; sin scripts.
      'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; object-src 'self'; frame-ancestors 'self'",
      'Cross-Origin-Resource-Policy': 'same-origin',
    },
  });
}
