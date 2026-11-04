'use server';
import { revalidatePath } from 'next/cache';
import { comoUsuario, type Tx } from '@/portal/lib/db';
import { UUID } from '@/portal/lib/datos';
import { requerirPersonal } from '@/portal/lib/sesion';

export type Resultado = { ok?: string; error?: string; n?: number };

/** Se escribe el nombre de la persona (sin desplegables); se resuelve aquí entre el personal activo. */
async function persona(tx: Tx, nombre: string): Promise<string> {
  const r = await tx.query(`select user_id from portal.personal where activo and lower(nombre_visible) = lower($1)`, [nombre.trim()]);
  if (r.rowCount !== 1) throw new Error(`No hay nadie en el equipo que se llame «${nombre.slice(0, 60)}».`);
  return r.rows[0].user_id;
}
const breve = (e: unknown, defecto: string) => { const m = (e as Error).message; return m.length < 160 ? m : defecto; };

// Compositor del expediente: una sola acción que guarda lo escrito como nota interna (por defecto),
// mensaje al cliente (solo con confirmación expresa) o tarea con fecha. Todo queda en la cronología.
export async function guardarEntrada(_: Resultado, f: FormData): Promise<Resultado> {
  const u = await requerirPersonal();
  const sid = String(f.get('solicitud'));
  const modo = String(f.get('modo'));
  const texto = String(f.get('texto') ?? '').trim();
  if (!UUID.test(sid)) return { error: 'Asunto no válido.' };
  if (!texto) return { error: 'Escribe algo antes de guardar.' };
  if (texto.length > 20000) return { error: 'El texto es demasiado largo (máximo 20.000 caracteres).' };
  try {
    await comoUsuario(u.id, async (tx) => {
      if (modo === 'cliente') {
        if (f.get('confirmado') !== '1') throw new Error('Confirma el envío al cliente.');
        if (texto.length > 4000) throw new Error('Un mensaje al cliente admite como máximo 4.000 caracteres.');
        await tx.query('insert into portal.mensajes (solicitud_id, autor_id, del_despacho, texto) values ($1, $2, true, $3)', [sid, u.id, texto]);
      } else if (modo === 'tarea') {
        const fecha = String(f.get('fecha') ?? '');
        const hora = String(f.get('hora') ?? '');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error('Indica la fecha de la tarea.');
        const conHora = /^\d{2}:\d{2}$/.test(hora);
        const tipo = f.get('plazo') === '1' ? 'plazo' : 'tarea';
        const para = String(f.get('para') ?? '').trim();
        const responsable = para ? await persona(tx, para) : u.id;
        await tx.query(`insert into portal.agenda_eventos (propietario_id, titulo, tipo, inicio, todo_el_dia, solicitud_id, avisos_min)
          values ($1, $2, $3, ($4 || ' ' || $5)::timestamp at time zone 'Europe/Madrid', $6, $7, $8)`,
          [responsable, texto.slice(0, 200), tipo, fecha, conHora ? hora : '09:00', !conHora, sid, conHora ? [60] : [0]]);
      } else {
        const fuente = ['texto_aportado', 'llamada', 'reunion'].includes(String(f.get('fuente'))) ? String(f.get('fuente')) : 'nota';
        await tx.query('insert into portal.notas_internas (solicitud_id, autor_id, texto, fuente) values ($1, $2, $3, $4)', [sid, u.id, texto, fuente]);
      }
    });
  } catch (e) {
    const m = (e as Error).message;
    return { error: m.length < 160 ? m : 'No se ha podido guardar.' };
  }
  revalidatePath(`/admin/expedientes/${sid}/`);
  return { ok: modo === 'cliente' ? 'Mensaje enviado al cliente.' : modo === 'tarea' ? 'Tarea creada.' : 'Guardado en el expediente.', n: Date.now() };
}

export async function compartirDocumento(_: Resultado, f: FormData): Promise<Resultado> {
  const u = await requerirPersonal();
  const id = String(f.get('documento')), sid = String(f.get('solicitud'));
  if (!UUID.test(id) || !UUID.test(sid)) return { error: 'Documento no válido.' };
  try {
    const r = await comoUsuario(u.id, (tx) => tx.query('update portal.documentos set visible_cliente = true where id = $1 and solicitud_id = $2 and not visible_cliente', [id, sid]));
    if (!r.rowCount) return { error: 'Ya estaba compartido o no existe.' };
  } catch (e) { return { error: (e as Error).message.slice(0, 160) }; }
  revalidatePath(`/admin/expedientes/${sid}/`);
  return { ok: 'Documento compartido con el cliente.', n: Date.now() };
}

export async function moverDocumento(_: Resultado, f: FormData): Promise<Resultado> {
  const u = await requerirPersonal();
  const id = String(f.get('documento')), sid = String(f.get('solicitud')), carpeta = String(f.get('carpeta') ?? '').trim().slice(0, 80);
  if (!UUID.test(id) || !UUID.test(sid) || carpeta.length < 2) return { error: 'Escribe el nombre de la carpeta.' };
  const r = await comoUsuario(u.id, (tx) => tx.query('update portal.documentos set carpeta = $3 where id = $1 and solicitud_id = $2 and requisito_id is null', [id, sid, carpeta]));
  if (!r.rowCount) return { error: 'Este documento está ligado a un documento solicitado; su carpeta es la de la solicitud.' };
  revalidatePath(`/admin/expedientes/${sid}/`);
  return { ok: `Movido a «${carpeta}».`, n: Date.now() };
}

export async function estadoCliente(_: Resultado, f: FormData): Promise<Resultado> {
  const u = await requerirPersonal();
  const sid = String(f.get('solicitud')), texto = String(f.get('texto') ?? '').trim().slice(0, 600);
  if (!UUID.test(sid) || texto.length < 3) return { error: 'Escribe el estado que verá el cliente.' };
  const n = await comoUsuario(u.id, async (tx) => {
    const r = await tx.query('update portal.solicitudes set estado_visible = $2 where id = $1', [sid, texto]);
    await tx.query('update portal.expedientes set estado_visible = $2 where solicitud_id = $1', [sid, texto]);
    return r.rowCount;
  });
  if (!n) return { error: 'No tienes permiso para publicar en este asunto.' };
  revalidatePath(`/admin/expedientes/${sid}/`);
  return { ok: 'Estado publicado para el cliente.', n: Date.now() };
}

export async function completarTarea(_: Resultado, f: FormData): Promise<Resultado> {
  const u = await requerirPersonal();
  const id = String(f.get('tarea')), sid = String(f.get('solicitud')), resultado = String(f.get('resultado') ?? '').trim().slice(0, 2000);
  if (!UUID.test(id) || !UUID.test(sid)) return { error: 'Tarea no válida.' };
  const r = await comoUsuario(u.id, (tx) => tx.query(`update portal.agenda_eventos set estado = 'completado', resultado = nullif($3, '') where id = $1 and solicitud_id = $2`, [id, sid, resultado]));
  if (!r.rowCount) return { error: 'No puedes completar esta tarea.' };
  revalidatePath(`/admin/expedientes/${sid}/`);
  return { ok: 'Tarea completada.', n: Date.now() };
}

/** Encargar una tarea pendiente a otra persona del equipo que tenga el asunto. */
export async function reasignarTarea(_: Resultado, f: FormData): Promise<Resultado> {
  const u = await requerirPersonal();
  const id = String(f.get('tarea')), sid = String(f.get('solicitud'));
  if (!UUID.test(id) || !UUID.test(sid)) return { error: 'Tarea no válida.' };
  try {
    const n = await comoUsuario(u.id, async (tx) => (await tx.query(`update portal.agenda_eventos set propietario_id = $3 where id = $1 and solicitud_id = $2 and estado = 'pendiente'`,
      [id, sid, await persona(tx, String(f.get('para') ?? ''))])).rowCount);
    if (!n) return { error: 'No puedes reasignar esta tarea.' };
  } catch (e) { return { error: breve(e, 'No se ha podido reasignar.') }; }
  revalidatePath(`/admin/expedientes/${sid}/`);
  return { ok: 'Tarea reasignada.', n: Date.now() };
}

/** Equipo del asunto: incorporar a alguien, quitarlo o pasarle la responsabilidad (relevo). */
export async function equipoAsunto(_: Resultado, f: FormData): Promise<Resultado> {
  const u = await requerirPersonal();
  const sid = String(f.get('solicitud')), accion = String(f.get('accion'));
  if (!UUID.test(sid)) return { error: 'Asunto no válido.' };
  try {
    await comoUsuario(u.id, async (tx) => {
      const quien = UUID.test(String(f.get('persona'))) ? String(f.get('persona')) : await persona(tx, String(f.get('nombre') ?? ''));
      if (accion === 'responsable') await tx.query('select portal.cambiar_responsable($1, $2)', [sid, quien]);
      else if (accion === 'quitar') await tx.query('select portal.retirar_asignacion($1, $2)', [sid, quien]);
      else await tx.query('select portal.asignar($1, $2, $3)', [sid, quien, f.get('papel') === 'suplente' ? 'suplente' : 'colaborador']);
    });
  } catch (e) { return { error: breve(e, 'No se ha podido cambiar el equipo.') }; }
  revalidatePath(`/admin/expedientes/${sid}/`);
  return { ok: accion === 'responsable' ? 'Nuevo responsable asignado.' : accion === 'quitar' ? 'Ya no está en el asunto.' : 'Incorporado al asunto.', n: Date.now() };
}
