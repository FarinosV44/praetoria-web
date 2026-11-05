import { headers } from 'next/headers';
import { auth } from '@/portal/lib/auth';
import { comoUsuario } from '@/portal/lib/db';
import { UUID } from '@/portal/lib/datos';
import { extensionDe } from '@/portal/lib/archivos';
import { leerObjeto } from '@/portal/lib/storage';
import { personalSinMfa } from '@/portal/lib/sesion';

export const runtime = 'nodejs';

// Original de una versión de la biblioteca: solo si la RLS deja ver ese modelo.
export async function GET(req: Request, { params }: { params: Promise<{ version: string }> }) {
  const { version } = await params;
  const sesion = await auth.api.getSession({ headers: await headers() });
  if (!sesion) return new Response('No autorizado', { status: 401 });
  if (await personalSinMfa(sesion.user.id, sesion.user.twoFactorEnabled)) return new Response('Activa el doble factor', { status: 403 });
  if (!UUID.test(version)) return new Response('No encontrado', { status: 404 });
  const v = await comoUsuario(sesion.user.id, async (tx) => (await tx.query(
    `select storage_key, mime, nombre_original from portal.bib_versiones where id = $1 and storage_key is not null`, [version])).rows[0] as
    { storage_key: string; mime: string; nombre_original: string } | undefined);
  if (!v) return new Response('No encontrado', { status: 404 });
  const blob = await leerObjeto(v.storage_key);
  const ver = new URL(req.url).searchParams.get('ver') === '1' && v.mime === 'application/pdf';
  const nombre = encodeURIComponent(`${v.nombre_original.replace(/\.[A-Za-z0-9]{1,5}$/, '')}.${extensionDe(v.mime)}`);
  return new Response(blob.stream(), {
    headers: {
      'content-type': v.mime, 'content-length': String(blob.size),
      'content-disposition': `${ver ? 'inline' : 'attachment'}; filename*=UTF-8''${nombre}`,
      'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff',
      'content-security-policy': ver ? "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; frame-ancestors 'none'" : "default-src 'none'; sandbox",
    },
  });
}
