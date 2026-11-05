'use server';
import { after } from 'next/server';
import { comoUsuario } from '@/portal/lib/db';
import { UUID } from '@/portal/lib/datos';
import { prepararRedaccion, recomendarModelos, redactar, type ModeloCandidato } from '@/portal/lib/redactor';
import { requerirPersonal } from '@/portal/lib/sesion';

// Redacción de escritos con modelos aprobados (#94). La llamada a la IA puede durar minutos: se hace después de
// responder (after) y el navegador consulta el estado. Lo que se guarda es siempre un BORRADOR versionado.

const LIMITE_HORA = 40;
type Trabajo = { uid: string; sid: string; hilo: string; estado: 'en_curso' | 'listo' | 'error'; error?: string; escrito?: string; version?: number; inicio: number };
const g = globalThis as unknown as { __redacciones?: Map<string, Trabajo> };
const trabajos = (g.__redacciones ??= new Map());
const limpiar = () => { const t = Date.now(); for (const [k, v] of trabajos) if (t - v.inicio > 3_600_000) trabajos.delete(k); };
const mensajeError = (e: unknown) => {
  const m = (e as Error).message ?? '';
  return /row-level|Sin permiso|42501/.test(m) ? 'No tienes permiso para escribir en este asunto.' : m.length < 200 ? m : 'No se ha podido preparar la redacción.';
};

export type Propuesta = { error?: string; procedimiento?: { id: string; nombre: string } | null; modelos?: ModeloCandidato[]; n?: number };

/** Modelos aprobados recomendados para lo que pide el abogado (y el resto de utilizables, para elegir a mano). */
export async function proponerModelos(sid: string, instruccion: string): Promise<Propuesta> {
  const u = await requerirPersonal();
  if (!UUID.test(sid)) return { error: 'Asunto no válido.' };
  if (instruccion.trim().length < 3) return { error: 'Escribe qué escrito necesitas.' };
  try {
    const r = await comoUsuario(u.id, (tx) => recomendarModelos(tx, sid, instruccion.slice(0, 2000)));
    return { procedimiento: r.procedimiento ? { id: r.procedimiento.id, nombre: r.procedimiento.nombre } : null, modelos: r.modelos, n: Date.now() };
  } catch (e) { return { error: mensajeError(e) }; }
}

export type Inicio = { error?: string; trabajo?: string; hilo?: string };

export async function iniciarRedaccion(f: { sid: string; hilo: string | null; instruccion: string; versiones: string[]; titulo: string; procedimiento: string | null }): Promise<Inicio> {
  const u = await requerirPersonal();
  const instruccion = f.instruccion.trim();
  if (!UUID.test(f.sid)) return { error: 'Asunto no válido.' };
  if (instruccion.length < 3) return { error: 'Escribe la instrucción.' };
  if (instruccion.length > 8000) return { error: 'La instrucción es demasiado larga (máximo 8.000 caracteres).' };
  if (!Array.isArray(f.versiones) || f.versiones.length > 5 || f.versiones.some((v) => !UUID.test(v))) return { error: 'Elige como máximo cinco modelos.' };
  const procedimiento = f.procedimiento && UUID.test(f.procedimiento) ? f.procedimiento : null;
  limpiar();
  if ([...trabajos.values()].some((t) => t.uid === u.id && t.estado === 'en_curso')) return { error: 'Ya tienes una redacción en curso. Espera a que termine.' };
  let prep: Awaited<ReturnType<typeof prepararRedaccion>>, hilo = f.hilo && UUID.test(f.hilo) ? f.hilo : '';
  let escrito: { id: string; titulo: string; version: number; texto: string } | null = null;
  try {
    ({ prep, hilo, escrito } = await comoUsuario(u.id, async (tx) => {
      if (!(await tx.query('select portal.personal_escribe($1) ok', [f.sid])).rows[0].ok) throw new Error('No tienes permiso para escribir en este asunto.');
      const n = (await tx.query(`select count(*)::int n from portal.ia_mensajes where autor_id = $1 and rol = 'usuario' and created_at > now() - interval '1 hour'`, [u.id])).rows[0].n;
      if (n >= LIMITE_HORA) throw new Error('Has alcanzado el límite de consultas por hora.');
      let h = hilo;
      if (h && !(await tx.query('select 1 from portal.ia_hilos where id = $1 and solicitud_id = $2', [h, f.sid])).rowCount) h = '';
      if (!h) h = (await tx.query(`insert into portal.ia_hilos (solicitud_id, titulo, creado_por) values ($1, $2, $3) returning id`, [f.sid, `✍️ ${(f.titulo || instruccion).slice(0, 100)}`, u.id])).rows[0].id;
      const e = (await tx.query(`select e.id, e.titulo, v.version, v.texto from portal.escritos e
        join lateral (select version, texto from portal.escrito_versiones x where x.escrito_id = e.id order by version desc limit 1) v on true
        where e.hilo_id = $1 and e.solicitud_id = $2`, [h, f.sid])).rows[0] ?? null;
      await tx.query(`insert into portal.ia_mensajes (hilo_id, solicitud_id, rol, texto, autor_id) values ($1, $2, 'usuario', $3, $4)`, [h, f.sid, `✍️ ${instruccion}`, u.id]);
      return { prep: await prepararRedaccion(tx, f.sid, instruccion, f.versiones), hilo: h, escrito: e };
    }));
  } catch (e) { return { error: mensajeError(e) }; }

  const id = crypto.randomUUID();
  trabajos.set(id, { uid: u.id, sid: f.sid, hilo, estado: 'en_curso', inicio: Date.now() });
  const titulo = (escrito?.titulo ?? (f.titulo.trim() || instruccion)).slice(0, 200).padEnd(3, '.');
  after(async () => {
    const t = trabajos.get(id)!;
    try {
      const r = await redactar(prep, instruccion, escrito ? { version: escrito.version, texto: escrito.texto } : null);
      const res = await comoUsuario(u.id, async (tx) => {
        const eid = escrito?.id ?? (await tx.query(`insert into portal.escritos (solicitud_id, titulo, procedimiento_id, hilo_id, creado_por) values ($1, $2, $3, $4, $5) returning id`,
          [f.sid, titulo, procedimiento, hilo, u.id])).rows[0].id;
        const nVersion = (escrito?.version ?? 0) + 1;
        const resumen = `Borrador «${titulo}» · versión ${nVersion} guardada en el expediente (BORRADOR, requiere revisión).\n\n${r.texto.slice(0, 1500)}${r.texto.length > 1500 ? '…' : ''}`;
        const m = (await tx.query(`insert into portal.ia_mensajes (hilo_id, solicitud_id, rol, texto, citas, limites, modelo, tokens_entrada, tokens_salida, autor_id)
          values ($1, $2, 'asistente', $3, $4, '[]', $5, $6, $7, $8) returning id`, [hilo, f.sid, resumen, JSON.stringify(r.citas), r.modelo, r.entrada, r.salida, u.id])).rows[0].id;
        const v = (await tx.query(`insert into portal.escrito_versiones (escrito_id, solicitud_id, texto, origen, instruccion, mensaje_id, modelos, citas, avisos, autor_id)
          values ($1, $2, $3, 'ia', $4, $5, $6, $7, $8, $9) returning id, version`,
          [eid, f.sid, r.texto, instruccion, m, JSON.stringify(r.modelos), JSON.stringify(r.citas), JSON.stringify(r.avisos), u.id])).rows[0];
        for (const mo of r.modelos) {
          await tx.query(`insert into portal.bib_usos (version_id, solicitud_id, user_id, escrito_version_id) values ($1, $2, $3, $4)`, [mo.version_id, f.sid, u.id, v.id]);
        }
        return { eid, version: v.version as number };
      });
      Object.assign(t, { estado: 'listo', escrito: res.eid, version: res.version });
    } catch (e) {
      console.error(`redacción fallida trabajo=${id.slice(0, 8)}: ${(e as Error).name}`);
      Object.assign(t, { estado: 'error', error: mensajeError(e) });
    }
  });
  return { trabajo: id, hilo };
}

export async function estadoRedaccion(trabajo: string): Promise<{ estado: 'en_curso' | 'listo' | 'error' | 'desconocido'; error?: string; hilo?: string; escrito?: string; version?: number }> {
  const u = await requerirPersonal();
  const t = trabajos.get(trabajo);
  if (!t || t.uid !== u.id) return { estado: 'desconocido', error: 'La redacción se ha interrumpido (por ejemplo, al reiniciarse el servidor). Vuelve a pedirla.' };
  return { estado: t.estado, error: t.error, hilo: t.hilo, escrito: t.escrito, version: t.version };
}
