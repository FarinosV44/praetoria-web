import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { comoUsuario } from '@/lib/db';
import { UUID } from '@/lib/datos';
import { leerObjeto } from '@/lib/storage';

export const runtime = 'nodejs';

// Descarga autenticada. La RLS decide si el documento existe para este usuario: a otra persona le
// responde 404 igual que a un identificador inexistente. Cada descarga queda registrada.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sesion = await auth.api.getSession({ headers: await headers() });
  if (!sesion) return new Response('No autorizado', { status: 401 });
  if (!UUID.test(id)) return new Response('No encontrado', { status: 404 });
  const doc = await comoUsuario(sesion.user.id, async (tx) => {
    const r = await tx.query('select storage_key, mime, nombre_original from portal.documentos where id = $1', [id]);
    if (!r.rowCount) return null;
    await tx.query('select portal.registrar_descarga($1)', [id]);
    return r.rows[0] as { storage_key: string; mime: string; nombre_original: string };
  });
  if (!doc) return new Response('No encontrado', { status: 404 });
  const blob = await leerObjeto(doc.storage_key);
  const imagen = doc.mime.startsWith('image/') && doc.mime !== 'image/heic' && doc.mime !== 'image/heif';
  const nombre = encodeURIComponent(doc.nombre_original);
  return new Response(blob.stream(), {
    headers: {
      'content-type': doc.mime,
      'content-length': String(blob.size),
      'content-disposition': `${imagen ? 'inline' : 'attachment'}; filename*=UTF-8''${nombre}`,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
