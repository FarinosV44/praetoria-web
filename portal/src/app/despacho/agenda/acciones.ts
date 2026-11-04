'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { comoUsuario } from '@/lib/db';
import { UUID } from '@/lib/datos';
import { requerirPersonal } from '@/lib/sesion';
import { TIPOS } from '@/lib/agenda';


const esquema = z.object({
  titulo: z.string().trim().min(2).max(200),
  tipo: z.enum(TIPOS),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hora: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal('')),
  duracion: z.coerce.number().int().min(0).max(1440).default(60),
  repeticion: z.enum(['ninguna', 'diaria', 'semanal', 'mensual']).default('ninguna'),
  repetir_hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  prioridad: z.enum(['normal', 'alta']).default('normal'),
  nota: z.string().trim().max(2000).optional(),
  solicitud: z.string().regex(/^[0-9a-f-]{36}$/).optional().or(z.literal('')),
  plazo_fuente: z.string().trim().max(300).optional(),
  aviso_extra: z.coerce.number().int().min(0).max(999).optional().or(z.literal('')),
  aviso_extra_unidad: z.enum(['min', 'h', 'd']).optional(),
});

function leer(f: FormData) {
  const d = esquema.safeParse(Object.fromEntries(f));
  if (!d.success) throw new Error('Revisa los datos: título, tipo y fecha son obligatorios.');
  const avisos = new Set(f.getAll('avisos').map(Number).filter((n) => [0, 15, 60, 1440, 10080].includes(n)));
  if (d.data.aviso_extra !== '' && d.data.aviso_extra !== undefined) {
    const mult = { min: 1, h: 60, d: 1440 }[d.data.aviso_extra_unidad ?? 'min'];
    const m = Number(d.data.aviso_extra) * mult;
    if (m > 0 && m <= 60 * 24 * 60) avisos.add(m);
  }
  if (avisos.size > 6) throw new Error('Como máximo seis avisos por evento.');
  const todoElDia = f.get('todo_el_dia') === 'on' || !d.data.hora;
  return { ...d.data, avisos: [...avisos].sort((a, b) => b - a), todoElDia, hora: todoElDia ? '09:00' : d.data.hora!, verificado: f.get('verificado') === 'on' };
}

function volver(destino: string, ok?: string, error?: string): never {
  revalidatePath('/despacho', 'layout');
  redirect(`${destino}${destino.includes('?') ? '&' : '?'}${error ? `error=${encodeURIComponent(error)}` : `ok=${encodeURIComponent(ok ?? 'Guardado.')}`}`);
}

export async function crearEvento(f: FormData) {
  const u = await requerirPersonal();
  let id = '';
  try {
    const e = leer(f);
    id = await comoUsuario(u.id, async (tx) => (await tx.query(
      `insert into portal.agenda_eventos (propietario_id, titulo, tipo, inicio, duracion_min, todo_el_dia, repeticion, repetir_hasta, prioridad, nota,
         solicitud_id, avisos_min, plazo_fuente, plazo_verificado_at)
       values ($1, $2, $3, ($4 || ' ' || $5)::timestamp at time zone 'Europe/Madrid', $6, $7, $8, nullif($9, '')::date, $10, nullif($11, ''),
         nullif($12, '')::uuid, $13, nullif($14, ''), case when $15 then now() end) returning id`,
      [u.id, e.titulo, e.tipo, e.fecha, e.hora, e.duracion, e.todoElDia, e.repeticion, e.repetir_hasta ?? '', e.prioridad, e.nota ?? '',
        e.solicitud ?? '', e.avisos, e.plazo_fuente ?? '', e.tipo === 'plazo' && e.verificado])).rows[0].id);
  } catch (err) {
    volver('/despacho/agenda/', undefined, (err as Error).message.slice(0, 160));
  }
  volver(`/despacho/agenda/${id}/`, 'Evento creado y avisos programados.');
}

export async function editarEvento(f: FormData) {
  const u = await requerirPersonal();
  const id = String(f.get('id'));
  if (!UUID.test(id)) redirect('/despacho/agenda/');
  try {
    const e = leer(f);
    const r = await comoUsuario(u.id, (tx) => tx.query(
      `update portal.agenda_eventos set titulo = $2, tipo = $3, inicio = ($4 || ' ' || $5)::timestamp at time zone 'Europe/Madrid', duracion_min = $6,
         todo_el_dia = $7, repeticion = $8, repetir_hasta = nullif($9, '')::date, prioridad = $10, nota = nullif($11, ''),
         solicitud_id = nullif($12, '')::uuid, avisos_min = $13, plazo_fuente = nullif($14, ''),
         plazo_verificado_at = case when $15 then coalesce(plazo_verificado_at, now()) else null end
       where id = $1`,
      [id, e.titulo, e.tipo, e.fecha, e.hora, e.duracion, e.todoElDia, e.repeticion, e.repetir_hasta ?? '', e.prioridad, e.nota ?? '',
        e.solicitud ?? '', e.avisos, e.plazo_fuente ?? '', e.tipo === 'plazo' && e.verificado]));
    if (!r.rowCount) throw new Error('Evento no encontrado.');
  } catch (err) {
    volver(`/despacho/agenda/${id}/`, undefined, (err as Error).message.slice(0, 160));
  }
  volver(`/despacho/agenda/${id}/`, 'Evento actualizado. Los avisos se han vuelto a programar.');
}

export async function cambiarEstado(f: FormData) {
  const u = await requerirPersonal();
  const id = String(f.get('id')), estado = String(f.get('estado')), destino = String(f.get('destino') || '/despacho/agenda/');
  if (!UUID.test(id) || !['pendiente', 'completado', 'cancelado'].includes(estado) || !destino.startsWith('/despacho/')) redirect('/despacho/agenda/');
  await comoUsuario(u.id, (tx) => tx.query('update portal.agenda_eventos set estado = $2 where id = $1', [id, estado]));
  volver(destino, estado === 'completado' ? 'Marcado como completado.' : estado === 'cancelado' ? 'Evento cancelado y avisos anulados.' : 'Evento reabierto.');
}

export async function posponer(f: FormData) {
  const u = await requerirPersonal();
  const aviso = String(f.get('aviso')), minutos = Number(f.get('minutos'));
  if (!UUID.test(aviso)) redirect('/despacho/avisos/');
  try {
    await comoUsuario(u.id, (tx) => tx.query('select portal.posponer_aviso($1, $2)', [aviso, minutos]));
  } catch { volver('/despacho/avisos/', undefined, 'No se ha podido posponer.'); }
  volver('/despacho/avisos/', 'Aviso pospuesto.');
}

export async function marcarLeidos() {
  const u = await requerirPersonal();
  await comoUsuario(u.id, (tx) => tx.query('update portal.avisos_internos set leido_at = now() where user_id = $1 and leido_at is null', [u.id]));
  volver('/despacho/avisos/', 'Avisos marcados como vistos.');
}
