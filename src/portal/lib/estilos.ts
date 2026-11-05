import 'server-only';
import type { Tx } from './db';
import { normalizarEstilo, type Estilo } from './render';

export const DESTINOS: Record<string, string> = {
  judicial: 'Escrito judicial', administrativo: 'Administrativo / TEAR', convenio: 'Convenio', contrato: 'Contrato',
  informe: 'Informe al cliente', extrajudicial: 'Extrajudicial', general: 'General',
};

export type EstiloGuardado = { id: string; nombre: string; destino: string; materias: string[]; version: number; version_id: string; config: Estilo };

/** Estilos activos con su última versión (RLS: solo el equipo jurídico). */
export async function estilosDisponibles(tx: Tx): Promise<EstiloGuardado[]> {
  return (await tx.query(`select e.id, e.nombre, e.destino, e.materias, v.version, v.id version_id, v.config from portal.bib_estilos e
    join lateral (select id, version, config from portal.bib_estilo_versiones x where x.estilo_id = e.id order by version desc limit 1) v on true
    where e.activo order by e.nombre`)).rows.map((r) => ({ ...r, config: normalizarEstilo(r.config) }));
}

/** Estilo elegido, o el preferido para la materia, o el primero; si no hay ninguno, el base. */
export function elegirEstilo(lista: EstiloGuardado[], id?: string | null, materia?: string | null): { estilo: Estilo; nombre: string; version_id: string | null } {
  const e = lista.find((x) => x.id === id) ?? (materia ? lista.find((x) => x.materias.includes(materia)) : undefined) ?? lista[0];
  return e ? { estilo: e.config, nombre: `${e.nombre} v${e.version}`, version_id: e.version_id } : { estilo: normalizarEstilo({}), nombre: 'Estilo base', version_id: null };
}
