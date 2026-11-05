import { q1, type Db, pool } from '../db';
import type { Usuario } from './sesiones';

type Fila = { id: string; email: string; nombre: string; activo: boolean };

/**
 * Cuenta del gestor de seguros para una persona del portal. Se vincula por el identificador del portal y, la
 * primera vez, por el correo (si ya existía una cuenta con ese correo y sin vincular). Siempre como
 * administrador: solo la superadministración del portal llega hasta aquí (requerirGlobal, en el servidor).
 * Las cuentas creadas así no tienen contraseña propia («!portal» nunca coincide con un hash scrypt).
 */
export async function usuarioDePortal(p: { id: string; email: string; nombre: string }, db: Db = pool()): Promise<Usuario> {
  let f = await q1<Fila>('SELECT id, email, nombre, activo FROM usuarios WHERE portal_user_id = $1', [p.id], db);
  if (!f) {
    f = await q1<Fila>(
      `INSERT INTO usuarios (email, nombre, clave_hash, rol, portal_user_id, ultimo_acceso)
         VALUES (lower($1), $2, '!portal', 'admin', $3, now())
       ON CONFLICT ((lower(email))) DO UPDATE SET portal_user_id = EXCLUDED.portal_user_id, rol = 'admin', ultimo_acceso = now()
         WHERE usuarios.portal_user_id IS NULL
       RETURNING id, email, nombre, activo`,
      [p.email, p.nombre || p.email, p.id], db,
    );
    if (!f) throw new Error('Esta cuenta del portal no se puede vincular al gestor de seguros: su correo ya está vinculado a otra persona.');
  }
  if (!f.activo) throw new Error('La cuenta del gestor de seguros está desactivada.');
  return { id: f.id, email: f.email, nombre: f.nombre, rol: 'admin' };
}
