'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { comoUsuario } from '@/portal/lib/db';
import { UUID } from '@/portal/lib/datos';
import { normalizarEstilo, estiloDesdeDocx } from '@/portal/lib/render';
import { leerObjeto } from '@/portal/lib/storage';
import { requerirGlobal } from '@/portal/lib/sesion';

export type ResultadoEstilo = { ok?: string; error?: string; n?: number };

function configDe(f: FormData) {
  const n = (k: string) => Number(String(f.get(k) ?? '').replace(',', '.'));
  return normalizarEstilo({
    fuente: String(f.get('fuente')) as never, tamano: n('tamano'), interlineado: n('interlineado'),
    margenes: { sup: n('m_sup'), inf: n('m_inf'), izq: n('m_izq'), der: n('m_der') }, sangria: n('sangria'),
    alineacion: f.get('alineacion') === 'izquierda' ? 'izquierda' : 'justificada',
    titulos: { mayusculas: f.get('t_may') === '1', negrita: f.get('t_neg') === '1', centrados: f.get('t_cen') === '1' },
    numeracion: f.get('numeracion') === 'arabigo' ? 'arabigo' : 'ordinal',
    encabezado: String(f.get('encabezado') ?? ''), pie: String(f.get('pie') ?? ''), firma: String(f.get('firma') ?? ''),
  });
}

export async function crearEstilo(_: ResultadoEstilo, f: FormData): Promise<ResultadoEstilo> {
  const u = await requerirGlobal();
  const nombre = String(f.get('nombre') ?? '').trim().slice(0, 80);
  if (nombre.length < 3) return { error: 'Pon un nombre al estilo (p. ej. «Judicial civil y familia»).' };
  let id = '';
  try {
    id = await comoUsuario(u.id, async (tx) => {
      const e = (await tx.query(`insert into portal.bib_estilos (nombre, destino, creado_por) values ($1, $2, $3) returning id`, [nombre, String(f.get('destino') ?? 'general'), u.id])).rows[0].id;
      await tx.query(`insert into portal.bib_estilo_versiones (estilo_id, version, config, creado_por) values ($1, 0, $2, $3)`, [e, JSON.stringify(normalizarEstilo({})), u.id]);
      return e as string;
    });
  } catch (e) { return { error: /unique|duplicate/.test((e as Error).message) ? 'Ya hay un estilo con ese nombre.' : 'No se ha podido crear.' }; }
  redirect(`/admin/biblioteca/estilos/${id}/`);
}

/** Guardar cambios = nueva versión (lo exportado antes no cambia). */
export async function guardarEstilo(_: ResultadoEstilo, f: FormData): Promise<ResultadoEstilo> {
  const u = await requerirGlobal();
  const id = String(f.get('estilo'));
  if (!UUID.test(id)) return { error: 'Estilo no válido.' };
  const materias = String(f.get('materias') ?? '').split(',').map((x) => x.trim()).filter((x) => /^[a-z0-9_]{2,40}$/.test(x));
  await comoUsuario(u.id, async (tx) => {
    await tx.query('update portal.bib_estilos set destino = $2, materias = $3 where id = $1', [id, String(f.get('destino') ?? 'general'), materias]);
    await tx.query(`insert into portal.bib_estilo_versiones (estilo_id, version, config, creado_por) values ($1, 0, $2, $3)`, [id, JSON.stringify(configDe(f)), u.id]);
  });
  revalidatePath('/admin/biblioteca/estilos', 'layout');
  return { ok: 'Guardado como nueva versión.', n: Date.now() };
}

/** Crear un estilo leyendo el formato de un Word de la biblioteca (solo formato; se revisa antes de usarlo). */
export async function estiloDesdeModelo(f: FormData) {
  const u = await requerirGlobal();
  const version = String(f.get('version'));
  if (!UUID.test(version)) redirect('/admin/biblioteca/estilos/');
  const id = await comoUsuario(u.id, async (tx) => {
    const v = (await tx.query(`select v.storage_key, v.mime, v.modelo_id, m.titulo from portal.bib_versiones v join portal.bib_modelos m on m.id = v.modelo_id
      where v.id = $1 and v.storage_key is not null`, [version])).rows[0];
    if (!v || !String(v.mime).startsWith('application/vnd.openxmlformats')) return null;
    const { estilo } = await estiloDesdeDocx(new Uint8Array(await (await leerObjeto(v.storage_key)).arrayBuffer()));
    const nombre = `Estilo de «${String(v.titulo).slice(0, 50)}» ${new Date().toISOString().slice(0, 10)}`;
    const e = (await tx.query(`insert into portal.bib_estilos (nombre, creado_por) values ($1, $2) returning id`, [nombre, u.id])).rows[0].id;
    await tx.query(`insert into portal.bib_estilo_versiones (estilo_id, version, config, origen_modelo, creado_por) values ($1, 0, $2, $3, $4)`, [e, JSON.stringify(estilo), v.modelo_id, u.id]);
    return e as string;
  });
  redirect(id ? `/admin/biblioteca/estilos/${id}/?detectado=1` : '/admin/biblioteca/estilos/');
}
