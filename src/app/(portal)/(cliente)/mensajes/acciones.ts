'use server';
import { revalidatePath } from 'next/cache';
import { comoUsuario } from '@/portal/lib/db';
import { UUID } from '@/portal/lib/datos';
import { usuarioActual } from '@/portal/lib/sesion';
import { env } from '@/portal/lib/env';

// Compartida por cliente y despacho: la RLS y los disparadores deciden autor y visibilidad.
export async function enviarMensaje(_: { error?: string; ok?: number }, f: FormData): Promise<{ error?: string; ok?: number }> {
  const u = await usuarioActual();
  if (!u) return { error: 'Tu sesión ha caducado. Vuelve a entrar.' };
  // Auditoría A1: el personal sin doble factor no escribe; un cliente debe haber completado su perfil.
  if (u.personal && env.staffMfa && !u.mfa) return { error: 'Activa el doble factor antes de continuar.' };
  if (!u.personal && !u.tienePerfil) return { error: 'Completa tus datos antes de escribir.' };
  const sid = String(f.get('solicitud'));
  const texto = String(f.get('texto') ?? '').trim();
  if (!UUID.test(sid) || !texto) return { error: 'Escribe el mensaje.' };
  if (texto.length > 4000) return { error: 'El mensaje es demasiado largo.' };
  try {
    await comoUsuario(u.id, (tx) => tx.query('insert into portal.mensajes (solicitud_id, autor_id, del_despacho, texto) values ($1, $2, false, $3)', [sid, u.id, texto]));
  } catch {
    return { error: 'No se ha podido enviar el mensaje.' };
  }
  revalidatePath('/', 'layout');
  return { ok: Date.now() };
}
