'use server';
import { revalidatePath } from 'next/cache';
import { comoUsuario } from '@/portal/lib/db';
import { UUID } from '@/portal/lib/datos';
import { requerirPersonal } from '@/portal/lib/sesion';

export type ResultadoEscrito = { error?: string; ok?: string; version?: number; n?: number };

/** Corrección a mano: crea una versión nueva a partir de la vigente; la anterior se conserva intacta. */
export async function guardarVersion(_: ResultadoEscrito, f: FormData): Promise<ResultadoEscrito> {
  const u = await requerirPersonal();
  const sid = String(f.get('solicitud')), eid = String(f.get('escrito')), base = Number(f.get('base'));
  const texto = String(f.get('texto') ?? '').replace(/\r/g, '').trim();
  if (!UUID.test(sid) || !UUID.test(eid)) return { error: 'Borrador no válido.' };
  if (texto.length < 1 || texto.length > 200000) return { error: 'El texto está vacío o es demasiado largo.' };
  try {
    const v = await comoUsuario(u.id, async (tx) => {
      const ult = (await tx.query(`select v.version, v.texto, v.modelos, v.citas from portal.escrito_versiones v join portal.escritos e on e.id = v.escrito_id
        where v.escrito_id = $1 and e.solicitud_id = $2 order by v.version desc limit 1`, [eid, sid])).rows[0];
      if (!ult) throw new Error('Borrador no encontrado.');
      if (ult.version !== base) throw new Error(`Mientras editabas se ha creado la versión ${ult.version}. Ábrela y vuelve a aplicar tu cambio.`);
      if (ult.texto === texto) throw new Error('No hay cambios respecto a la versión vigente.');
      // Se conservan las citas que siguen en el texto; los modelos de los que procede se mantienen como referencia.
      const citas = (ult.citas as { id: string }[]).filter((c) => texto.includes(`[${c.id}]`));
      return (await tx.query(`insert into portal.escrito_versiones (escrito_id, solicitud_id, texto, origen, instruccion, modelos, citas, avisos, autor_id)
        values ($1, $2, $3, 'manual', 'Corrección a mano', $4, $5, '[]', $6) returning version`, [eid, sid, texto, JSON.stringify(ult.modelos), JSON.stringify(citas), u.id])).rows[0].version as number;
    });
    revalidatePath(`/admin/expedientes/${sid}/escritos/${eid}/`);
    return { ok: `Guardada la versión ${v}.`, version: v, n: Date.now() };
  } catch (e) {
    const m = (e as Error).message;
    return { error: /row-level|42501/.test(m) ? 'No tienes permiso para escribir en este asunto.' : m.slice(0, 200) };
  }
}
