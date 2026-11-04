'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { comoUsuario } from '@/lib/db';
import { usuarioActual } from '@/lib/sesion';

const esquema = z.object({
  tipo: z.enum(['particular', 'empresa']),
  empresa: z.string().trim().max(200).optional(),
  cargo: z.string().trim().max(120).optional(),
  telefono: z.string().trim().regex(/^\+?[0-9 ]{9,20}$/).optional().or(z.literal('')),
});

export async function crearPerfil(_: unknown, f: FormData): Promise<{ error?: string }> {
  const u = await usuarioActual();
  if (!u || u.personal) redirect('/entrar/');
  const d = esquema.safeParse(Object.fromEntries(f));
  if (!d.success) return { error: 'Revisa los datos: el teléfono debe tener al menos 9 cifras.' };
  if (d.data.tipo === 'empresa' && !d.data.empresa) return { error: 'Indica el nombre de la empresa.' };
  await comoUsuario(u.id, async (tx) => {
    const p = await tx.query(`select "privacidadVersion" v, "privacidadAceptadaAt" a from identidad."user" where id = $1`, [u.id]);
    const nombre = u.nombre.trim();
    await tx.query(
      `insert into portal.perfiles (user_id, tipo, nombre, empresa, cargo, telefono, version_privacidad, acepta_privacidad_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8) on conflict (user_id) do nothing`,
      [u.id, d.data.tipo, nombre, d.data.tipo === 'empresa' ? d.data.empresa : null, d.data.tipo === 'empresa' ? d.data.cargo || null : null,
        d.data.telefono || null, p.rows[0]?.v ?? 'desconocida', p.rows[0]?.a ?? new Date()]);
  });
  redirect('/inicio/');
}
