import 'server-only';
import { cache } from 'react';
import { requerirGlobal, usuarioActual as usuarioPortal } from '@/portal/lib/sesion';
import { env } from '@/portal/lib/env';
import { usuarioDePortal } from './usuario-portal';
import type { Usuario } from './sesiones';

/**
 * Identidad en /admin/seguros: la del portal de Praetoria. Exige superadministración (rol «administrador»)
 * y, si está configurado, doble factor; si no, requerirGlobal redirige. No hay acceso propio ni cookies propias.
 */
export const exigirUsuario = cache(async (): Promise<Usuario> => {
  const p = await requerirGlobal();
  return usuarioDePortal(p);
});

export const exigirAdmin = exigirUsuario;

/** Para rutas API: sin redirecciones. Devuelve null si no es superadministración con doble factor. */
export async function usuarioApi(): Promise<Usuario | null> {
  const p = await usuarioPortal();
  if (!p?.personal || p.personal.rol !== 'administrador') return null;
  if (env.staffMfa && !p.mfa) return null;
  return usuarioDePortal(p);
}

