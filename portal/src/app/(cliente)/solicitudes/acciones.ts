'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { comoUsuario } from '@/lib/db';
import { requerirCliente } from '@/lib/sesion';
import { UUID } from '@/lib/datos';

export async function nuevaSolicitud() {
  const u = await requerirCliente();
  const borradores = await comoUsuario(u.id, async (tx) =>
    (await tx.query(`select count(*)::int n from portal.solicitudes where cliente_id = $1 and estado = 'borrador'`, [u.id])).rows[0].n as number);
  if (borradores >= 5) redirect('/solicitudes/?aviso=borradores');
  const id = await comoUsuario(u.id, async (tx) =>
    (await tx.query(`insert into portal.solicitudes (cliente_id) values ($1) returning id`, [u.id])).rows[0].id as string);
  redirect(`/solicitudes/${id}/editar/?paso=1`);
}

const paso1 = z.object({ tipo_asunto_id: z.string().regex(/^[a-z0-9-]{3,60}$/) });
const paso2 = z.object({
  descripcion: z.string().trim().max(4000),
  fechas: z.string().trim().max(300).optional(),
  localidad: z.string().trim().max(120).optional(),
});
const paso3 = z.object({
  contraparte: z.string().trim().max(300).optional(),
  urgencia: z.enum(['normal', 'urgente']),
  contacto_preferido: z.enum(['portal', 'correo', 'telefono']),
});

export type EstadoForm = { error?: string };

export async function guardarPaso(_: EstadoForm, f: FormData): Promise<EstadoForm> {
  const u = await requerirCliente();
  const id = String(f.get('id'));
  const paso = Number(f.get('paso'));
  const salir = f.get('salir') === '1';
  if (!UUID.test(id)) return { error: 'Solicitud no válida.' };
  let siguiente = paso + 1;
  try {
    await comoUsuario(u.id, async (tx) => {
      if (paso === 1) {
        if (salir && !f.get('tipo_asunto_id')) return;
        const d = paso1.safeParse(Object.fromEntries(f));
        if (!d.success) throw new Error('Elige el tipo de asunto que mejor encaja.');
        const ok = await tx.query('select 1 from portal.tipos_asunto where id = $1 and activo', [d.data.tipo_asunto_id]);
        if (!ok.rowCount) throw new Error('Elige un tipo de asunto de la lista.');
        await upd(tx, id, { tipo_asunto_id: d.data.tipo_asunto_id, paso: Math.max(2, paso) });
      } else if (paso === 2) {
        const d = paso2.safeParse(Object.fromEntries(f));
        if (!d.success) throw new Error('Revisa los textos: son demasiado largos.');
        if (!salir && d.data.descripcion.length < 20) throw new Error('Cuéntanos un poco más (al menos 20 caracteres).');
        await upd(tx, id, { descripcion: d.data.descripcion || null, fechas: d.data.fechas || null, localidad: d.data.localidad || null, paso: 3 });
      } else if (paso === 3) {
        const d = paso3.safeParse(Object.fromEntries(f));
        if (!d.success) throw new Error('Revisa las opciones marcadas.');
        await upd(tx, id, { contraparte: d.data.contraparte || null, urgencia: d.data.urgencia, contacto_preferido: d.data.contacto_preferido, paso: 4 });
      } else if (paso === 4) {
        if (f.get('confirmo') !== 'on') throw new Error('Marca la casilla para confirmar que la información es correcta.');
        const r = await tx.query(`update portal.solicitudes set estado = 'enviada' where id = $1 and cliente_id = $2 and estado = 'borrador'`, [id, u.id]);
        if (!r.rowCount) throw new Error('No se ha podido enviar. Puede que ya estuviera enviada.');
        siguiente = 0;
      }
    });
  } catch (e) {
    const m = (e as Error).message;
    return { error: m.startsWith('Faltan datos') ? 'Faltan datos: elige el tipo de asunto y cuéntanos qué ha pasado.' : m.length < 140 ? m : 'No hemos podido guardar. Inténtalo de nuevo.' };
  }
  revalidatePath('/', 'layout');
  if (salir) redirect('/solicitudes/?guardado=1');
  if (siguiente === 0) redirect(`/solicitudes/${id}/?enviada=1`);
  redirect(`/solicitudes/${id}/editar/?paso=${siguiente}`);
}

async function upd(tx: import('@/lib/db').Tx, id: string, campos: Record<string, unknown>) {
  const cols = Object.keys(campos);
  const set = cols.map((c, i) => `${c} = $${i + 2}`).join(', ');
  const r = await tx.query(`update portal.solicitudes set ${set} where id = $1 and estado = 'borrador'`, [id, ...cols.map((c) => campos[c])]);
  if (!r.rowCount) throw new Error('Esta solicitud ya no se puede modificar.');
}
