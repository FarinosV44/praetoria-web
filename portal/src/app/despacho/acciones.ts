'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { comoUsuario, type Tx } from '@/lib/db';
import { UUID } from '@/lib/datos';
import { requerirPersonal } from '@/lib/sesion';

// Acciones del despacho. Cada una vuelve a comprobar que quien actúa es personal activo (y con
// doble factor); la base de datos lo comprueba otra vez con RLS y disparadores.

const txt = (f: FormData, k: string, max: number) => String(f.get(k) ?? '').trim().slice(0, max);

async function ejecutar(f: FormData, fn: (tx: Tx, sid: string, uid: string) => Promise<string | void>) {
  const u = await requerirPersonal();
  const sid = String(f.get('solicitud'));
  if (!UUID.test(sid)) redirect('/despacho/');
  let msg = 'Guardado.', error = '';
  try {
    const r = await comoUsuario(u.id, (tx) => fn(tx, sid, u.id));
    if (r) msg = r;
  } catch (e) {
    const m = (e as Error).message;
    error = m.length < 160 ? m : 'No se ha podido guardar.';
  }
  revalidatePath('/despacho', 'layout');
  redirect(`/despacho/solicitudes/${sid}/?${error ? `error=${encodeURIComponent(error)}` : `ok=${encodeURIComponent(msg)}`}`);
}

export async function marcarEnRevision(f: FormData) {
  await ejecutar(f, async (tx, sid) => {
    await tx.query(`update portal.solicitudes set estado = 'en_revision' where id = $1 and estado = 'enviada'`, [sid]);
    return 'Solicitud marcada en revisión.';
  });
}

export async function registrarConflictos(f: FormData) {
  await ejecutar(f, async (tx, sid, uid) => {
    if (f.get('confirmo') !== 'on') throw new Error('Marca la casilla para confirmar la revisión de conflictos.');
    await tx.query(`update portal.solicitudes set conflictos_revisados_at = now() where id = $1 and conflictos_revisados_at is null`, [sid]);
    const nota = txt(f, 'nota', 2000);
    if (nota) await tx.query('insert into portal.notas_internas (solicitud_id, autor_id, texto) values ($1, $2, $3)', [sid, uid, `Conflictos: ${nota}`]);
    return 'Revisión de conflictos registrada.';
  });
}

export async function asignarResponsable(f: FormData) {
  await ejecutar(f, async (tx, sid) => {
    const r = String(f.get('responsable'));
    if (!UUID.test(r)) throw new Error('Elige un responsable.');
    await tx.query('update portal.solicitudes set responsable_id = $2 where id = $1', [sid, r]);
    await tx.query('update portal.expedientes set responsable_id = $2 where solicitud_id = $1', [sid, r]);
    return 'Responsable asignado.';
  });
}

export async function publicarEstado(f: FormData) {
  await ejecutar(f, async (tx, sid) => {
    const t = txt(f, 'texto', 600);
    if (t.length < 3) throw new Error('Escribe la nota que verá el cliente.');
    await tx.query('update portal.solicitudes set estado_visible = $2 where id = $1', [sid, t]);
    await tx.query('update portal.expedientes set estado_visible = $2 where solicitud_id = $1', [sid, t]);
    return 'Nota publicada para el cliente.';
  });
}

export async function noAceptar(f: FormData) {
  await ejecutar(f, async (tx, sid) => {
    const motivo = txt(f, 'motivo', 1000);
    await tx.query(`update portal.solicitudes set estado = 'no_aceptada', motivo_no_aceptada = $2 where id = $1 and estado in ('enviada', 'en_revision')`, [sid, motivo]);
    return 'Solicitud marcada como no aceptada.';
  });
}

export async function convertirEnExpediente(f: FormData) {
  await ejecutar(f, async (tx, sid) => {
    const titulo = txt(f, 'titulo', 200), resp = String(f.get('responsable'));
    if (titulo.length < 3) throw new Error('Escribe un título para el expediente.');
    if (!UUID.test(resp)) throw new Error('Elige un responsable.');
    const r = await tx.query('select portal.convertir_en_expediente($1, $2, $3) id', [sid, titulo, resp]);
    return `Expediente abierto (${r.rows[0].id.slice(0, 8)}).`;
  });
}

export async function revisarDocumento(f: FormData) {
  await ejecutar(f, async (tx, sid) => {
    const doc = String(f.get('documento')), decision = String(f.get('decision'));
    if (!UUID.test(doc) || !['valido', 'rechazado'].includes(decision)) throw new Error('Acción no válida.');
    const motivo = txt(f, 'motivo', 1000);
    if (decision === 'rechazado' && motivo.length < 5) throw new Error('Explica al cliente qué debe corregir.');
    const d = await tx.query(`update portal.documentos set estado = $2, motivo = $3 where id = $1 and solicitud_id = $4
      returning requisito_id`, [doc, decision, decision === 'rechazado' ? motivo : (motivo || null), sid]);
    if (!d.rowCount) throw new Error('Documento no encontrado.');
    const req = d.rows[0].requisito_id;
    if (decision === 'rechazado') {
      await tx.query(`update portal.requisitos set estado = 'subsanacion', comentario = $2 where id = $1`, [req, motivo]);
      return 'Subsanación pedida al cliente.';
    }
    const multiple = (await tx.query('select multiple from portal.requisitos where id = $1', [req])).rows[0].multiple;
    if (!multiple) await tx.query(`update portal.requisitos set estado = 'validado', comentario = $2 where id = $1`, [req, motivo || 'Documento recibido correctamente.']);
    return multiple ? 'Documento validado. Cuando estén todos, valida el requisito.' : 'Documento validado.';
  });
}

export async function estadoRequisito(f: FormData) {
  await ejecutar(f, async (tx, sid) => {
    const req = String(f.get('requisito')), estado = String(f.get('estado'));
    if (!UUID.test(req) || !['pendiente', 'en_revision', 'validado', 'subsanacion', 'no_aplicable'].includes(estado)) throw new Error('Acción no válida.');
    const comentario = txt(f, 'comentario', 1000) || null;
    if (estado === 'subsanacion' && !comentario) throw new Error('Explica al cliente qué falta.');
    const r = await tx.query(`update portal.requisitos set estado = $2, comentario = coalesce($3, comentario) where id = $1 and solicitud_id = $4`, [req, estado, comentario, sid]);
    if (!r.rowCount) throw new Error('Requisito no encontrado.');
    return 'Estado del documento actualizado.';
  });
}

export async function anadirRequisito(f: FormData) {
  await ejecutar(f, async (tx, sid) => {
    const titulo = txt(f, 'titulo', 160), explicacion = txt(f, 'explicacion', 600);
    if (titulo.length < 3 || explicacion.length < 3) throw new Error('Escribe qué documento necesitas y por qué.');
    await tx.query(`insert into portal.requisitos (solicitud_id, titulo, explicacion, obligatorio, multiple, orden)
      values ($1, $2, $3, $4, $5, (select coalesce(max(orden), 0) + 10 from portal.requisitos where solicitud_id = $1))`,
      [sid, titulo, explicacion, f.get('obligatorio') === 'on', f.get('multiple') === 'on']);
    return 'Documento solicitado al cliente.';
  });
}

export async function notaInterna(f: FormData) {
  await ejecutar(f, async (tx, sid, uid) => {
    const t = txt(f, 'texto', 4000);
    if (!t) throw new Error('Escribe la nota.');
    await tx.query('insert into portal.notas_internas (solicitud_id, autor_id, texto) values ($1, $2, $3)', [sid, uid, t]);
    return 'Nota interna guardada (no la ve el cliente).';
  });
}
