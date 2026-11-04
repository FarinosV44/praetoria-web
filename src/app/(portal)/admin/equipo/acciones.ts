'use server';
import { createHash, randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { comoUsuario, type Tx } from '@/portal/lib/db';
import { UUID } from '@/portal/lib/datos';
import { enviarCorreo, plantillasCorreo } from '@/portal/lib/email';
import { env } from '@/portal/lib/env';
import { requerirGlobal } from '@/portal/lib/sesion';

export type ResultadoEquipo = { error?: string; ok?: string; enlace?: string; correo?: 'enviado' | 'fallido' };
const ROL = z.enum(['administrador', 'abogado', 'apoyo', 'facturacion', 'lectura']);

async function invitar(tx: Tx, empleado: string) {
  const token = randomBytes(32).toString('base64url');
  await tx.query('select portal.invitar_empleado($1, $2)', [empleado, createHash('sha256').update(token).digest('hex')]);
  return `${env.origin}/invitacion/?token=${token}`;
}
async function enviar(email: string, enlace: string): Promise<'enviado' | 'fallido'> {
  try { const m = plantillasCorreo.invitacionEmpleado(enlace); await enviarCorreo(email, m.asunto, m.texto); return 'enviado'; }
  catch (e) { console.error('invitación de empleado: el correo no se pudo enviar', (e as Error).message); return 'fallido'; }
}
const breve = (e: unknown) => { const m = (e as Error).message; return /Ya existe/.test(m) ? 'Ya hay una cuenta con ese correo.' : m.length < 140 ? m : 'No se ha podido completar.'; };

export async function invitarEmpleado(_: ResultadoEquipo, f: FormData): Promise<ResultadoEquipo> {
  const u = await requerirGlobal();
  const d = z.object({ nombre: z.string().trim().min(2).max(120), email: z.string().trim().toLowerCase().email().max(254), rol: ROL }).safeParse(Object.fromEntries(f));
  if (!d.success) return { error: 'Indica nombre, un correo válido y el rol.' };
  try {
    const enlace = await comoUsuario(u.id, async (tx) => {
      const id = (await tx.query('select portal.crear_empleado($1, $2, $3) id', [d.data.email, d.data.nombre, d.data.rol])).rows[0].id as string;
      return invitar(tx, id);
    });
    revalidatePath('/admin/equipo/');
    return { ok: `${d.data.nombre} invitado.`, enlace, correo: await enviar(d.data.email, enlace) };
  } catch (e) { return { error: breve(e) }; }
}

export async function reinvitarEmpleado(_: ResultadoEquipo, f: FormData): Promise<ResultadoEquipo> {
  const u = await requerirGlobal();
  const id = String(f.get('empleado'));
  if (!UUID.test(id)) return { error: 'Empleado no válido.' };
  try {
    const r = await comoUsuario(u.id, async (tx) => ({ email: (await tx.query('select email from identidad."user" where id = $1', [id])).rows[0]?.email as string, enlace: await invitar(tx, id) }));
    return { ok: 'Nueva invitación creada.', enlace: r.enlace, correo: await enviar(r.email, r.enlace) };
  } catch (e) { return { error: breve(e) }; }
}

export async function cambiarEmpleado(_: ResultadoEquipo, f: FormData): Promise<ResultadoEquipo> {
  const u = await requerirGlobal();
  const id = String(f.get('empleado')), rol = ROL.safeParse(f.get('rol')), activo = f.get('activo') === '1';
  if (!UUID.test(id) || !rol.success) return { error: 'Datos no válidos.' };
  try { await comoUsuario(u.id, (tx) => tx.query('select portal.cambiar_empleado($1, $2, $3)', [id, rol.data, activo])); }
  catch (e) { return { error: breve(e) }; }
  revalidatePath('/admin/equipo/');
  return { ok: activo ? 'Guardado.' : 'Acceso desactivado: sus sesiones se han cerrado.' };
}
