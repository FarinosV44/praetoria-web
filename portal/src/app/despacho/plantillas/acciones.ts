'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { comoUsuario } from '@/lib/db';
import { UUID } from '@/lib/datos';
import { requerirPersonal } from '@/lib/sesion';

const t = (f: FormData, k: string, max: number) => String(f.get(k) ?? '').trim().slice(0, max);

// Las plantillas se editan sin tocar código. Los cambios solo afectan a solicitudes enviadas
// a partir de ahora: las listas ya creadas conservan su contenido.
export async function guardarItem(f: FormData) {
  const u = await requerirPersonal();
  const id = String(f.get('id'));
  if (!UUID.test(id)) redirect('/despacho/plantillas/');
  await comoUsuario(u.id, async (tx) => {
    await tx.query(`update portal.plantilla_items set titulo = $2, explicacion = $3, ejemplo = nullif($4, ''), obligatorio = $5, multiple = $6, activo = $7, orden = $8 where id = $1`,
      [id, t(f, 'titulo', 160), t(f, 'explicacion', 600), t(f, 'ejemplo', 300), f.get('obligatorio') === 'on', f.get('multiple') === 'on', f.get('activo') === 'on', Number(f.get('orden')) || 100]);
    await tx.query(`update portal.plantillas set updated_at = now(), updated_by = $2 where id = (select plantilla_id from portal.plantilla_items where id = $1)`, [id, u.id]);
  });
  revalidatePath('/despacho/plantillas/');
  redirect('/despacho/plantillas/?ok=1');
}

export async function nuevoItem(f: FormData) {
  const u = await requerirPersonal();
  const pid = String(f.get('plantilla'));
  if (!UUID.test(pid)) redirect('/despacho/plantillas/');
  const titulo = t(f, 'titulo', 160), explicacion = t(f, 'explicacion', 600);
  if (titulo.length < 3 || explicacion.length < 3) redirect('/despacho/plantillas/?error=1');
  await comoUsuario(u.id, (tx) => tx.query(`insert into portal.plantilla_items (plantilla_id, titulo, explicacion, obligatorio, multiple, orden)
    values ($1, $2, $3, $4, $5, (select coalesce(max(orden), 0) + 10 from portal.plantilla_items where plantilla_id = $1))`,
    [pid, titulo, explicacion, f.get('obligatorio') === 'on', f.get('multiple') === 'on']));
  revalidatePath('/despacho/plantillas/');
  redirect('/despacho/plantillas/?ok=1');
}
