import 'server-only';
import type { Tx } from './db';
import { fusionRRF, reordenarBiblioteca } from './fragmentar';
import { autorizaEmbeddings, embeddings, leerAjustes, vectorSql } from './ia-proveedores';

// Recuperación híbrida (texto completo + semántica). Todas las consultas se ejecutan bajo RLS, con la identidad de la persona:
//   · biblioteca: solo portal.bib_usable() → aprobado, versión vigente, no privado, visible para quien pregunta.
//   · expediente: solo el asunto pedido, última versión, ni papelera ni infectados.
// Sin embeddings autorizados sigue funcionando con la búsqueda textual: se indica en `semantica`.

export type PasajeBiblioteca = {
  id: string; modelo_id: string; version_id: string; version: number; titulo: string; clase: string; materia_id: string | null; procedimiento_id: string | null;
  procedimiento: string | null; tipo_escrito: string | null; seccion: string | null; pagina: number | null; texto: string; rrf: number;
};
export type PasajeExpediente = { id: string; documento_id: string; nombre: string; version: number; seccion: string | null; pagina: number | null; texto: string; rrf: number };
export type FiltrosBiblioteca = { materia?: string | null; procedimiento?: string | null; clase?: string | null; tipo?: string | null };

// Una pregunta en lenguaje natural no contiene todas sus palabras en el mismo pasaje: se busca cualquiera y se ordena por relevancia.
const CONSULTA_TS = `nullif(replace(plainto_tsquery('spanish', $1)::text, '&', '|'), '')::tsquery`;

const SELECT_BIB = `f.id, f.modelo_id, f.version_id, v.version, m.titulo, m.clase, m.materia_id, m.procedimiento_id, pr.nombre procedimiento, m.tipo_escrito, f.seccion, f.pagina, f.texto
  from portal.bib_fragmentos f join portal.bib_versiones v on v.id = f.version_id join portal.bib_modelos m on m.id = f.modelo_id
  left join portal.bib_procedimientos pr on pr.id = m.procedimiento_id`;

function whereBib(f: FiltrosBiblioteca, p: unknown[]) {
  const w = ['portal.bib_usable(f.version_id)'];
  const add = (v: unknown) => { p.push(v); return `$${p.length}`; };
  if (f.procedimiento) w.push(`m.procedimiento_id = ${add(f.procedimiento)}`);
  else if (f.materia) w.push(`m.materia_id = ${add(f.materia)}`);
  if (f.clase) w.push(`m.clase = ${add(f.clase)}`);
  if (f.tipo) w.push(`m.tipo_escrito = ${add(f.tipo)}`);
  return w.join(' and ');
}

/** Pasajes de la biblioteca para una consulta. Los filtros restringen; `prioridad` solo reordena. */
export async function buscarBiblioteca(tx: Tx, uid: string, consulta: string, o: { filtros?: FiltrosBiblioteca; prioridad?: { procedimiento?: string | null; materia?: string | null }; limite?: number } = {}) {
  const limite = o.limite ?? 8;
  const q = consulta.slice(0, 4000);
  const p1: unknown[] = [q];
  const texto = (await tx.query(`select ${SELECT_BIB} where ${whereBib(o.filtros ?? {}, p1)} and f.tsv @@ ${CONSULTA_TS}
    order by ts_rank_cd(f.tsv, ${CONSULTA_TS}) desc limit 40`, p1)).rows as PasajeBiblioteca[];
  let vector: PasajeBiblioteca[] = [];
  let semantica = false;
  const a = await leerAjustes(tx);
  if (autorizaEmbeddings(a, 'biblioteca')) {
    try {
      const { vectores } = await embeddings([q], uid, null);
      const p2: unknown[] = [vectorSql(vectores[0]!)];
      vector = (await tx.query(`select ${SELECT_BIB} where ${whereBib(o.filtros ?? {}, p2)} and f.embedding is not null
        order by f.embedding operator(extensions.<=>) $1::extensions.vector limit 40`, p2)).rows;
      semantica = true;
    } catch { console.error('IA: embeddings no disponibles; se usa solo la búsqueda textual'); }
  }
  const unidos = reordenarBiblioteca(fusionRRF([texto, vector]), o.prioridad ?? o.filtros ?? {}).slice(0, limite);
  return { pasajes: unidos, semantica };
}

/** Pasajes de UN expediente. La condición de asunto va en SQL y además la RLS la impone. */
export async function buscarExpediente(tx: Tx, uid: string, sid: string, consulta: string, limite = 30) {
  const q = consulta.slice(0, 4000);
  const base = `f.id, f.documento_id, d.nombre_original nombre, d.version, f.seccion, f.pagina, f.texto
    from portal.doc_fragmentos f join portal.documentos d on d.id = f.documento_id
    where f.solicitud_id = $2 and d.solicitud_id = $2 and d.analisis <> 'infectado' and not exists (select 1 from portal.documentos x where x.sustituye_a = d.id)`;
  const texto = (await tx.query(`select ${base} and f.tsv @@ ${CONSULTA_TS} order by ts_rank_cd(f.tsv, ${CONSULTA_TS}) desc limit 60`, [q, sid])).rows as PasajeExpediente[];
  let vector: PasajeExpediente[] = [];
  let semantica = false;
  const a = await leerAjustes(tx);
  if (autorizaEmbeddings(a, 'expediente')) {
    try {
      const { vectores } = await embeddings([q], uid, sid);
      vector = (await tx.query(`select ${base} and f.embedding is not null order by f.embedding operator(extensions.<=>) $1::extensions.vector limit 60`, [vectorSql(vectores[0]!), sid])).rows;
      semantica = true;
    } catch { console.error('IA: embeddings no disponibles; se usa solo la búsqueda textual'); }
  }
  return { pasajes: fusionRRF([texto, vector]).slice(0, limite), semantica };
}
