'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { comoUsuario } from '@/portal/lib/db';
import { UUID } from '@/portal/lib/datos';
import { requerirGlobal, requerirPersonal } from '@/portal/lib/sesion';

export type ResultadoBib = { ok?: string; error?: string; n?: number };
const breve = (e: unknown, d: string) => { const m = (e as Error).message; return /row-level/.test(m) ? 'No tienes permiso para cambiar este modelo.' : m.length < 180 ? m : d; };

const ficha = z.object({
  modelo: z.string().regex(/^[0-9a-f-]{36}$/), titulo: z.string().trim().min(3).max(200),
  materia: z.string().trim().max(40).optional(), procedimiento: z.string().trim().max(160).optional(),
  tipo: z.string().trim().max(80).optional(), variante: z.string().trim().max(120).optional(),
  clase: z.enum(['maestro', 'historico_anonimizado', 'caso_privado', 'clausula', 'estilo']),
  etiquetas: z.string().max(400).optional(), organo: z.string().trim().max(160).optional(),
  posicion: z.enum(['', 'actor', 'demandado', 'recurrente', 'neutral']).optional(), fecha: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/).optional(),
});

/** Clasificación del modelo. El procedimiento se escribe (con sugerencias) y se resuelve aquí. */
export async function guardarFicha(_: ResultadoBib, f: FormData): Promise<ResultadoBib> {
  const u = await requerirPersonal();
  const d = ficha.safeParse(Object.fromEntries(f));
  if (!d.success) return { error: 'Revisa el título (mínimo 3 caracteres) y la fecha.' };
  const v = d.data;
  try {
    const n = await comoUsuario(u.id, async (tx) => {
      let proc: string | null = null;
      if (v.procedimiento) {
        const r = await tx.query(`select id from portal.bib_procedimientos where lower(nombre) = lower($1) and ($2 = '' or materia_id = $2) order by activo desc limit 1`, [v.procedimiento, v.materia ?? '']);
        if (!r.rowCount) throw new Error(`No existe el procedimiento «${v.procedimiento}» en el catálogo. Elígelo de la lista o pide que se añada.`);
        proc = r.rows[0].id;
      }
      const etiquetas = [...new Set((v.etiquetas ?? '').split(',').map((e) => e.trim().toLowerCase()).filter((e) => e.length >= 2).slice(0, 15))];
      return (await tx.query(`update portal.bib_modelos set titulo = $2, materia_id = nullif($3, ''), procedimiento_id = $4, tipo_escrito = nullif($5, ''), variante = nullif($6, ''),
          clase = $7, etiquetas = $8, organo = nullif($9, ''), posicion = nullif($10, ''), fecha_normativa = nullif($11, '')::date where id = $1`,
        [v.modelo, v.titulo, v.materia ?? '', proc, v.tipo ?? '', v.variante ?? '', v.clase, etiquetas, v.organo ?? '', v.posicion ?? '', v.fecha ?? ''])).rowCount;
    });
    if (!n) return { error: 'No puedes editar este modelo (solo su autor mientras no está aprobado, o la superadministración).' };
  } catch (e) { return { error: breve(e, 'No se ha podido guardar.') }; }
  revalidatePath('/admin/biblioteca', 'layout');
  return { ok: 'Clasificación guardada.', n: Date.now() };
}

export async function cambiarEstado(_: ResultadoBib, f: FormData): Promise<ResultadoBib> {
  const u = await requerirPersonal();
  const id = String(f.get('modelo')), estado = String(f.get('estado'));
  if (!UUID.test(id) || !['pendiente', 'revision', 'obsoleto'].includes(estado)) return { error: 'Cambio no válido.' };
  try {
    const n = await comoUsuario(u.id, async (tx) => (await tx.query('update portal.bib_modelos set estado = $2 where id = $1', [id, estado])).rowCount);
    if (!n) return { error: 'No puedes cambiar el estado de este modelo.' };
  } catch (e) { return { error: breve(e, 'No se ha podido cambiar.') }; }
  revalidatePath('/admin/biblioteca', 'layout');
  return { ok: estado === 'obsoleto' ? 'Marcado como obsoleto: no se ofrecerá para nuevos escritos.' : 'Enviado a revisión.', n: Date.now() };
}

export async function aprobar(_: ResultadoBib, f: FormData): Promise<ResultadoBib> {
  const u = await requerirGlobal();
  const id = String(f.get('modelo'));
  if (!UUID.test(id)) return { error: 'Modelo no válido.' };
  try { await comoUsuario(u.id, (tx) => tx.query('select portal.bib_aprobar($1, $2)', [id, f.get('anonimizado') === '1'])); }
  catch (e) { return { error: breve(e, 'No se ha podido aprobar.') }; }
  revalidatePath('/admin/biblioteca', 'layout');
  return { ok: 'Aprobado para la biblioteca del despacho.', n: Date.now() };
}

// ── Catálogo (#93): materias y procedimientos editables por la superadministración ──
export async function nuevoProcedimiento(_: ResultadoBib, f: FormData): Promise<ResultadoBib> {
  const u = await requerirGlobal();
  const materia = String(f.get('materia') ?? ''), nombre = String(f.get('nombre') ?? '').trim().slice(0, 160);
  if (!/^[a-z0-9_]{2,40}$/.test(materia) || nombre.length < 3) return { error: 'Elige la materia y escribe el nombre del procedimiento.' };
  try { await comoUsuario(u.id, (tx) => tx.query('insert into portal.bib_procedimientos (materia_id, nombre) values ($1, $2)', [materia, nombre])); }
  catch (e) { return { error: /duplicate|unique/.test((e as Error).message) ? 'Ese procedimiento ya existe en esa materia.' : breve(e, 'No se ha podido añadir.') }; }
  revalidatePath('/admin/biblioteca', 'layout');
  return { ok: `Añadido «${nombre}».`, n: Date.now() };
}

export async function alternarProcedimiento(f: FormData) {
  const u = await requerirGlobal();
  const id = String(f.get('procedimiento'));
  if (UUID.test(id)) await comoUsuario(u.id, (tx) => tx.query('update portal.bib_procedimientos set activo = not activo where id = $1', [id]));
  revalidatePath('/admin/biblioteca', 'layout');
}

export async function nuevaMateria(_: ResultadoBib, f: FormData): Promise<ResultadoBib> {
  const u = await requerirGlobal();
  const nombre = String(f.get('nombre') ?? '').trim().slice(0, 80);
  const id = nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
  if (nombre.length < 2 || id.length < 2) return { error: 'Escribe el nombre de la materia.' };
  try { await comoUsuario(u.id, (tx) => tx.query('insert into portal.bib_materias (id, nombre, orden) values ($1, $2, 200)', [id, nombre])); }
  catch (e) { return { error: /duplicate|unique/.test((e as Error).message) ? 'Esa materia ya existe.' : breve(e, 'No se ha podido añadir.') }; }
  revalidatePath('/admin/biblioteca', 'layout');
  return { ok: `Materia «${nombre}» añadida.`, n: Date.now() };
}
