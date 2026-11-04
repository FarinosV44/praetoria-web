'use server';
import { createHash } from 'node:crypto';
import { redirect } from 'next/navigation';
import { hashPassword } from 'better-auth/crypto';
import { poolApp, poolAuth } from '@/portal/lib/db';
import { VERSION_PRIVACIDAD } from '@/portal/lib/textos';

// Canjea la invitación (personal o cliente): fija la contraseña elegida por la propia persona y marca el enlace como usado.
export async function aceptarInvitacion(_: { error?: string }, f: FormData): Promise<{ error?: string }> {
  const token = String(f.get('token') ?? '');
  const clave = String(f.get('clave') ?? ''), clave2 = String(f.get('clave2') ?? '');
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return { error: 'Invitación no válida.' };
  const sha = createHash('sha256').update(token).digest('hex');
  const tipo = (await poolApp().query('select portal.invitacion_tipo($1) t', [sha])).rows[0]?.t as string | null;
  const minimo = tipo === 'personal' ? 14 : 10;
  if (clave.length < minimo || clave.length > 128) return { error: `La contraseña debe tener entre ${minimo} y 128 caracteres.` };
  if (clave !== clave2) return { error: 'Las dos contraseñas no coinciden.' };
  if (tipo === 'cliente' && f.get('privacidad') !== 'on') return { error: 'Para activar tu acceso tienes que aceptar la información de privacidad.' };
  const uid = (await poolApp().query('select portal.invitacion_valida($1) u', [sha])).rows[0]?.u as string | null;
  if (!uid) return { error: 'Esta invitación no es válida, ya se usó o ha caducado.' };
  const hash = await hashPassword(clave);
  const c = await poolAuth().connect();
  try {
    await c.query('begin');
    const a = await c.query(`update identidad.account set password = $2, "updatedAt" = now() where "userId" = $1 and "providerId" = 'credential'`, [uid, hash]);
    if (!a.rowCount) await c.query(`insert into identidad.account ("accountId", "providerId", "userId", password, "updatedAt") values ($1::text, 'credential', $1::uuid, $2, now())`, [uid, hash]);
    await c.query(`delete from identidad.session where "userId" = $1`, [uid]);
    // El enlace llegó a ese correo: se da por verificado.
    await c.query(`update identidad."user" set "emailVerified" = true, "privacidadVersion" = coalesce("privacidadVersion", $2),
      "privacidadAceptadaAt" = coalesce("privacidadAceptadaAt", now()) where id = $1`, [uid, tipo === 'cliente' ? VERSION_PRIVACIDAD : 'personal']);
    await poolApp().query('select portal.usar_invitacion($1)', [sha]);
    if (tipo === 'cliente') await poolApp().query('select portal.aceptar_privacidad($1, $2)', [uid, VERSION_PRIVACIDAD]);
    await c.query('commit');
  } catch {
    await c.query('rollback').catch(() => {});
    return { error: 'No se ha podido activar la cuenta. Pide una nueva invitación.' };
  } finally { c.release(); }
  redirect('/entrar/?activada=1');
}
