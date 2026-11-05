import { q, q1, type Db, pool } from '../db';
import { sha256, token } from './clave';

export type Usuario = { id: string; email: string; nombre: string; rol: 'admin' | 'colaborador' };

export const DURACION_DIAS = 30;      // caducidad absoluta
export const INACTIVIDAD_DIAS = 14;   // caducidad por inactividad

export async function crearSesion(usuarioId: string, agente: string | null, db: Db = pool()) {
  const t = token();
  await q(
    `INSERT INTO sesiones (id, usuario_id, caduca_en, agente) VALUES ($1, $2, now() + make_interval(days => $3), $4)`,
    [sha256(t), usuarioId, DURACION_DIAS, agente?.slice(0, 200) ?? null], db,
  );
  await q('UPDATE usuarios SET ultimo_acceso = now() WHERE id = $1', [usuarioId], db);
  return t;
}

export async function usuarioDeToken(t: string | undefined | null, db: Db = pool()): Promise<Usuario | null> {
  if (!t || t.length > 100) return null;
  const fila = await q1<Usuario & { vista_en: Date }>(
    `SELECT u.id, u.email, u.nombre, u.rol, s.vista_en
       FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id
      WHERE s.id = $1 AND s.caduca_en > now() AND s.vista_en > now() - make_interval(days => $2) AND u.activo`,
    [sha256(t), INACTIVIDAD_DIAS], db,
  );
  if (!fila) return null;
  // Se actualiza la última actividad como mucho una vez por hora.
  if (Date.now() - new Date(fila.vista_en).getTime() > 3600_000) {
    await q('UPDATE sesiones SET vista_en = now() WHERE id = $1', [sha256(t)], db);
  }
  return { id: fila.id, email: fila.email, nombre: fila.nombre, rol: fila.rol };
}

export async function cerrarSesion(t: string | undefined | null, db: Db = pool()) {
  if (t) await q('DELETE FROM sesiones WHERE id = $1', [sha256(t)], db);
}

/** Cierra todas las sesiones de un usuario (cambio de contraseña, baja, revocación). */
export async function cerrarTodas(usuarioId: string, db: Db = pool()) {
  await q('DELETE FROM sesiones WHERE usuario_id = $1', [usuarioId], db);
}
