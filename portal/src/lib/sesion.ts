import 'server-only';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { auth } from './auth';
import { comoUsuario } from './db';
import { env } from './env';

export type Usuario = { id: string; email: string; nombre: string; personal: null | { rol: string; nombre: string }; tienePerfil: boolean; mfa: boolean };

export const usuarioActual = cache(async (): Promise<Usuario | null> => {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return null;
  const extra = await comoUsuario(s.user.id, async (tx) => {
    const p = await tx.query('select rol, nombre_visible from portal.personal where user_id = $1 and activo', [s.user.id]);
    const f = await tx.query('select 1 from portal.perfiles where user_id = $1', [s.user.id]);
    return { personal: p.rows[0] ? { rol: p.rows[0].rol as string, nombre: p.rows[0].nombre_visible as string } : null, tienePerfil: (f.rowCount ?? 0) > 0 };
  });
  return { id: s.user.id, email: s.user.email, nombre: s.user.name, mfa: !!s.user.twoFactorEnabled, ...extra };
});

/** Páginas del área de clientes: exige sesión de cliente con perfil completado. */
export async function requerirCliente(): Promise<Usuario> {
  const u = await usuarioActual();
  if (!u) redirect('/entrar/');
  if (u.personal) redirect('/despacho/');
  if (!u.tienePerfil) redirect('/bienvenida/');
  return u;
}

/** Páginas del despacho: exige personal activo y, si está configurado, doble factor activado. */
export async function requerirPersonal(opciones?: { sinMfa?: boolean }): Promise<Usuario> {
  const u = await usuarioActual();
  if (!u) redirect('/entrar/');
  if (!u.personal) redirect('/inicio/');
  if (env.staffMfa && !u.mfa && !opciones?.sinMfa) redirect('/despacho/seguridad/');
  return u;
}

/** Comprobación de origen para rutas API que modifican datos (defensa CSRF adicional a SameSite). */
export async function origenValido(): Promise<boolean> {
  const h = await headers();
  const o = h.get('origin');
  return o === env.origin;
}
