'use server';
import { createHash, randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { comoUsuario, type Tx } from '@/portal/lib/db';
import { UUID } from '@/portal/lib/datos';
import { enviarCorreo, plantillasCorreo } from '@/portal/lib/email';
import { env } from '@/portal/lib/env';
import { requerirPersonal } from '@/portal/lib/sesion';

export type ResultadoAlta = { error?: string; cliente?: string; expediente?: string; enlace?: string; correo?: 'enviado' | 'fallido' | 'no' };

const alta = z.object({
  nombre: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  tipo: z.enum(['particular', 'empresa']),
  empresa: z.string().trim().max(200).optional(),
  telefono: z.string().trim().regex(/^\+?[0-9 ]{9,20}$/).optional().or(z.literal('')),
  nif: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{8,12}$/).optional().or(z.literal('')),
  asunto: z.string().trim().max(200).optional(),
});

/** Genera la invitación dentro de la transacción (solo se guarda el hash). Devuelve el enlace UNA vez. */
async function invitar(tx: Tx, cliente: string) {
  const token = randomBytes(32).toString('base64url');
  await tx.query('select portal.invitar_cliente($1, $2)', [cliente, createHash('sha256').update(token).digest('hex')]);
  return `${env.origin}/invitacion/?token=${token}`;
}

/** Se envía DESPUÉS de confirmar la transacción, para no mandar enlaces que no existen. */
async function enviarInvitacion(email: string, enlace: string): Promise<'enviado' | 'fallido'> {
  try { const m = plantillasCorreo.invitacionCliente(enlace); await enviarCorreo(email, m.asunto, m.texto); return 'enviado'; }
  catch (e) { console.error('invitación: el correo no se pudo enviar', (e as Error).message); return 'fallido'; }
}

export async function crearCliente(_: ResultadoAlta, f: FormData): Promise<ResultadoAlta> {
  const u = await requerirPersonal();
  const d = alta.safeParse(Object.fromEntries(f));
  if (!d.success) return { error: 'Revisa los datos: nombre, un correo válido y, si lo indicas, un teléfono de 9 cifras o un NIF sin espacios.' };
  if (d.data.tipo === 'empresa' && !d.data.empresa) return { error: 'Indica el nombre de la empresa.' };
  try {
    const r = await comoUsuario(u.id, async (tx) => {
      const cliente = (await tx.query('select portal.crear_cliente($1, $2, $3, $4, $5, $6) id',
        [d.data.email, d.data.nombre, d.data.tipo, d.data.empresa ?? '', d.data.telefono ?? '', d.data.nif ?? ''])).rows[0].id as string;
      let expediente: string | undefined;
      if (d.data.asunto && d.data.asunto.length >= 3) {
        expediente = (await tx.query('select portal.abrir_expediente($1, $2, null, $3) id', [cliente, d.data.asunto, u.id])).rows[0].id;
      }
      const enlace = f.get('invitar') === 'on' ? await invitar(tx, cliente) : undefined;
      return { cliente, expediente, enlace };
    });
    return { ...r, correo: r.enlace ? await enviarInvitacion(d.data.email, r.enlace) : 'no' };
  } catch (e) {
    const m = (e as Error).message;
    return { error: /Ya existe/.test(m) ? 'Ya hay una cuenta con ese correo. Búscala arriba para abrir su ficha.' : m.length < 140 ? m : 'No se ha podido dar de alta.' };
  } finally {
    revalidatePath('/admin', 'layout');
  }
}

export async function reenviarInvitacion(_: ResultadoAlta, f: FormData): Promise<ResultadoAlta> {
  const u = await requerirPersonal();
  const cliente = String(f.get('cliente'));
  if (!UUID.test(cliente)) return { error: 'Cliente no válido.' };
  try {
    const r = await comoUsuario(u.id, async (tx) => {
      const q = await tx.query(`select email from identidad."user" where id = $1`, [cliente]);
      if (!q.rowCount) throw new Error('Cliente no encontrado.');
      return { email: q.rows[0].email as string, enlace: await invitar(tx, cliente) };
    });
    return { cliente, enlace: r.enlace, correo: f.get('enviar') === 'no' ? 'no' : await enviarInvitacion(r.email, r.enlace) };
  } catch (e) { return { error: (e as Error).message.slice(0, 140) }; }
}

export async function abrirExpediente(f: FormData) {
  const u = await requerirPersonal();
  const cliente = String(f.get('cliente')), titulo = String(f.get('titulo') ?? '').trim().slice(0, 200);
  if (!UUID.test(cliente) || titulo.length < 3) redirect(`/admin/clientes/${cliente}/?error=titulo`);
  const sid = await comoUsuario(u.id, async (tx) => (await tx.query('select portal.abrir_expediente($1, $2, null, $3) id', [cliente, titulo, u.id])).rows[0].id as string);
  revalidatePath('/admin', 'layout');
  redirect(`/admin/expedientes/${sid}/`);
}

const datos = z.object({
  telefono: z.string().trim().regex(/^\+?[0-9 ]{9,20}$/).optional().or(z.literal('')),
  nif: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{8,12}$/).optional().or(z.literal('')),
  empresa: z.string().trim().max(200).optional(),
  direccion: z.string().trim().max(200).optional(),
  codigo_postal: z.string().trim().toUpperCase().regex(/^[0-9A-Z -]{3,10}$/).optional().or(z.literal('')),
  localidad: z.string().trim().max(120).optional(),
  provincia: z.string().trim().max(120).optional(),
});

/** Datos de contacto y facturación de la ficha (los que usará la facturación, #53). */
export async function guardarFicha(_: ResultadoAlta, f: FormData): Promise<ResultadoAlta> {
  const u = await requerirPersonal();
  const cliente = String(f.get('cliente'));
  const d = datos.safeParse(Object.fromEntries(f));
  if (!UUID.test(cliente) || !d.success) return { error: 'Revisa el teléfono, el NIF (sin espacios) y el código postal.' };
  const v = d.data;
  await comoUsuario(u.id, (tx) => tx.query(`update portal.perfiles set telefono = nullif($2, ''), nif = nullif($3, ''), empresa = coalesce(nullif($4, ''), empresa),
      direccion = nullif($5, ''), codigo_postal = nullif($6, ''), localidad = nullif($7, ''), provincia = nullif($8, '') where user_id = $1`,
    [cliente, v.telefono ?? '', v.nif ?? '', v.empresa ?? '', v.direccion ?? '', v.codigo_postal ?? '', v.localidad ?? '', v.provincia ?? '']));
  revalidatePath(`/admin/clientes/${cliente}/`);
  return { cliente };
}
