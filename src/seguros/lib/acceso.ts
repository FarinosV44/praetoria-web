import { q, q1, type Db, pool } from './db';
import type { Usuario } from './auth/sesiones';
import { NoEncontrado, Prohibido } from './errores';

/**
 * Autorización en servidor (#1, #8). Todas las consultas de datos pasan por aquí:
 * - administrador: todos los titulares;
 * - colaborador: solo los titulares que tenga concedidos expresamente.
 */
export async function titularesPermitidos(u: Usuario, db: Db = pool()): Promise<string[] | 'todos'> {
  if (u.rol === 'admin') return 'todos';
  const filas = await q<{ titular_id: string }>('SELECT titular_id FROM accesos_titular WHERE usuario_id = $1', [u.id], db);
  return filas.map((f) => f.titular_id);
}

export async function puedeVerTitular(u: Usuario, titularId: string, db: Db = pool()) {
  if (!esUuid(titularId)) return false;
  if (u.rol === 'admin') return !!(await q1('SELECT 1 FROM titulares WHERE id = $1', [titularId], db));
  return !!(await q1('SELECT 1 FROM accesos_titular WHERE usuario_id = $1 AND titular_id = $2', [u.id, titularId], db));
}

export async function exigirTitular(u: Usuario, titularId: string, db: Db = pool()) {
  if (!(await puedeVerTitular(u, titularId, db))) throw new NoEncontrado('titular');
}

/** Devuelve el titular de la póliza si el usuario puede verla; si no, NoEncontrado. */
export async function exigirPoliza(u: Usuario, polizaId: string, db: Db = pool()): Promise<string> {
  if (!esUuid(polizaId)) throw new NoEncontrado('póliza');
  const p = await q1<{ titular_id: string }>('SELECT titular_id FROM polizas WHERE id = $1', [polizaId], db);
  if (!p || !(await puedeVerTitular(u, p.titular_id, db))) throw new NoEncontrado('póliza');
  return p.titular_id;
}

export function exigirRolAdmin(u: Usuario) {
  if (u.rol !== 'admin') throw new Prohibido();
}

/** Fragmento SQL «columna = ANY($n)» o «TRUE» para administradores. */
export function filtroSql(permitidos: string[] | 'todos', columna: string, params: unknown[]) {
  if (permitidos === 'todos') return 'TRUE';
  params.push(permitidos);
  return `${columna} = ANY($${params.length}::uuid[])`;
}

export const esUuid = (v: unknown): v is string =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
