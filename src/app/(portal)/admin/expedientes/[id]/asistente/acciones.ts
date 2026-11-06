'use server';
import { revalidatePath } from 'next/cache';
import { comoUsuario } from '@/portal/lib/db';
import { UUID } from '@/portal/lib/datos';
import { requerirPersonal } from '@/portal/lib/sesion';

export type ResultadoIA = { error?: string; hilo?: string; n?: number; ok?: string; escrito?: string };

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

/** Crear un escrito a partir de una respuesta del asistente: queda como borrador versionado del asunto. Lo decide una persona. */
export async function crearEscritoDesdeRespuesta(_: ResultadoIA, f: FormData): Promise<ResultadoIA> {
  const u = await requerirPersonal();
  const sid = String(f.get('solicitud')), id = String(f.get('mensaje'));
  if (!UUID.test(sid) || !UUID.test(id)) return { error: 'Respuesta no válida.' };
  try {
    const eid = await comoUsuario(u.id, async (tx) => {
      const m = (await tx.query(`select texto, citas from portal.ia_mensajes where id = $1 and solicitud_id = $2 and rol = 'asistente'`, [id, sid])).rows[0];
      if (!m) throw new Error('Respuesta no encontrada.');
      const titulo = (String(m.texto).split('\n').find((l: string) => l.trim().length > 3)?.trim() ?? 'Borrador desde la conversación').slice(0, 120).padEnd(3, '.');
      const e = (await tx.query(`insert into portal.escritos (solicitud_id, titulo, creado_por) values ($1, $2, $3) returning id`, [sid, titulo, u.id])).rows[0].id as string;
      await tx.query(`insert into portal.escrito_versiones (escrito_id, solicitud_id, texto, origen, instruccion, mensaje_id, citas, avisos, autor_id)
        values ($1, $2, $3, 'ia', 'Creado a partir de una respuesta del asistente', $4, $5, '[]', $6)`, [e, sid, String(m.texto).slice(0, 200000), id, JSON.stringify(m.citas), u.id]);
      return e;
    });
    revalidatePath(`/admin/expedientes/${sid}/`);
    return { ok: 'Escrito creado.', escrito: eid, n: Date.now() };
  } catch (e) { const m = (e as Error).message; return { error: /row-level|42501/.test(m) ? 'No tienes permiso para escribir en este asunto.' : m.slice(0, 160) }; }
}
