'use server';
import { revalidatePath } from 'next/cache';
import { comoUsuario } from '@/portal/lib/db';
import { UUID } from '@/portal/lib/datos';
import { contexto, llamarIA, verificarCitas, type Turno } from '@/portal/lib/ia';
import { requerirPersonal } from '@/portal/lib/sesion';

export type ResultadoIA = { error?: string; hilo?: string; n?: number; ok?: string };
const LIMITE_HORA = 40;

/** Pregunta al asistente. La consulta a la IA se hace FUERA de la transacción: primero se guarda la pregunta
 *  y se prepara el contexto (con RLS), luego se llama a la API y por último se guarda la respuesta. */
export async function preguntar(_: ResultadoIA, f: FormData): Promise<ResultadoIA> {
  const u = await requerirPersonal();
  const sid = String(f.get('solicitud')), texto = String(f.get('texto') ?? '').trim();
  let hilo = String(f.get('hilo') ?? '');
  if (!UUID.test(sid)) return { error: 'Asunto no válido.' };
  if (texto.length < 3) return { error: 'Escribe tu pregunta.' };
  if (texto.length > 8000) return { error: 'La pregunta es demasiado larga (máximo 8.000 caracteres).' };
  let prep: { fuentes: Awaited<ReturnType<typeof contexto>>['fuentes']; limites: string[]; historial: Turno[]; hilo: string };
  try {
    prep = await comoUsuario(u.id, async (tx) => {
      const n = (await tx.query(`select count(*)::int n from portal.ia_mensajes where autor_id = $1 and rol = 'usuario' and created_at > now() - interval '1 hour'`, [u.id])).rows[0].n;
      if (n >= LIMITE_HORA) throw new Error('Has alcanzado el límite de consultas por hora.');
      if (!UUID.test(hilo)) {
        hilo = (await tx.query(`insert into portal.ia_hilos (solicitud_id, titulo, creado_por) values ($1, $2, $3) returning id`, [sid, texto.slice(0, 80), u.id])).rows[0].id;
      }
      const historial = (await tx.query(`select rol, texto from portal.ia_mensajes where hilo_id = $1 and solicitud_id = $2 order by created_at`, [hilo, sid])).rows as Turno[];
      await tx.query(`insert into portal.ia_mensajes (hilo_id, solicitud_id, rol, texto, autor_id) values ($1, $2, 'usuario', $3, $4)`, [hilo, sid, texto, u.id]);
      return { ...(await contexto(tx, sid, texto)), historial, hilo };
    });
  } catch (e) {
    const m = (e as Error).message;
    return { error: /row-level|Sin permiso/.test(m) ? 'No tienes este asunto asignado.' : m.length < 160 ? m : 'No se ha podido preparar la consulta.' };
  }
  try {
    const r = await llamarIA(prep.historial, texto, prep.fuentes);
    const v = verificarCitas(r.texto, prep.fuentes);
    const limites = [...prep.limites, ...(v.invalidas.length ? [`Se han quitado ${v.invalidas.length} citas que no correspondían a ninguna fuente de este expediente.`] : []),
      ...(v.citas.length === 0 ? ['La respuesta no cita ninguna fuente: trátala con cautela.'] : [])];
    await comoUsuario(u.id, (tx) => tx.query(`insert into portal.ia_mensajes (hilo_id, solicitud_id, rol, texto, citas, limites, modelo, tokens_entrada, tokens_salida, autor_id)
      values ($1, $2, 'asistente', $3, $4, $5, $6, $7, $8, $9)`, [prep.hilo, sid, v.texto, JSON.stringify(v.citas), JSON.stringify(limites), r.modelo, r.entrada, r.salida, u.id]));
  } catch (e) {
    revalidatePath(`/admin/expedientes/${sid}/asistente/`);
    return { hilo: prep.hilo, error: (e as Error).message.slice(0, 160), n: Date.now() };
  }
  revalidatePath(`/admin/expedientes/${sid}/asistente/`);
  return { hilo: prep.hilo, n: Date.now() };
}

/** Pasar una respuesta revisada al expediente como nota interna (acción humana; nunca va al cliente). */
export async function guardarComoNota(_: ResultadoIA, f: FormData): Promise<ResultadoIA> {
  const u = await requerirPersonal();
  const sid = String(f.get('solicitud')), id = String(f.get('mensaje'));
  if (!UUID.test(sid) || !UUID.test(id)) return { error: 'Respuesta no válida.' };
  try {
    await comoUsuario(u.id, async (tx) => {
      const m = (await tx.query(`select texto from portal.ia_mensajes where id = $1 and solicitud_id = $2 and rol = 'asistente'`, [id, sid])).rows[0];
      if (!m) throw new Error('Respuesta no encontrada.');
      await tx.query(`insert into portal.notas_internas (solicitud_id, autor_id, texto, fuente) values ($1, $2, $3, 'nota')`,
        [sid, u.id, `[Borrador preparado con IA y revisado por ${u.personal!.nombre}]\n\n${m.texto}`.slice(0, 20000)]);
    });
  } catch (e) { return { error: (e as Error).message.slice(0, 160) }; }
  revalidatePath(`/admin/expedientes/${sid}/`);
  return { ok: 'Guardado como nota interna.', n: Date.now() };
}
