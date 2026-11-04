import 'server-only';
import { headers } from 'next/headers';
import { auth } from './auth';
import { comoUsuario } from './db';
import { env } from './env';

/** Para rutas API del despacho: sesión válida, personal activo y doble factor (si es obligatorio). */
export async function personalApi(): Promise<{ uid: string } | { error: Response }> {
  const h = await headers();
  const s = await auth.api.getSession({ headers: h });
  if (!s) return { error: new Response('No autorizado', { status: 401 }) };
  const es = await comoUsuario(s.user.id, async (tx) => ((await tx.query('select 1 from portal.personal where user_id = $1 and activo', [s.user.id])).rowCount ?? 0) > 0);
  if (!es) return { error: new Response('No encontrado', { status: 404 }) };
  if (env.staffMfa && !s.user.twoFactorEnabled) return { error: new Response('Activa el doble factor', { status: 403 }) };
  return { uid: s.user.id };
}

export async function origenOk(): Promise<boolean> {
  return (await headers()).get('origin') === env.origin;
}
