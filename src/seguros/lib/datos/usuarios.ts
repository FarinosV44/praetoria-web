import { z } from 'zod';
import { q, q1, type Db, pool, transaccion } from '../db';
import { hashClave, problemaClave, verificarClave, sha256, token } from '../auth/clave';
import { cerrarTodas, crearSesion, type Usuario } from '../auth/sesiones';
import { limpiarFallos, registrarIntento, superaLimite } from '../auth/limites';
import { auditar } from '../auditoria';
import { esUuid, exigirRolAdmin } from '../acceso';
import { Invalido, NoEncontrado } from '../errores';
import { textoReq, validar } from '../validacion';

const MAX_FALLOS_CUENTA = 5;
const MAX_FALLOS_IP = 20;
const VENTANA_MIN = 15;

// Hash señuelo: se compara igualmente cuando el correo no existe para no revelar qué cuentas hay.
let senuelo: Promise<string> | null = null;

export type ResultadoAcceso = { ok: true; token: string; usuario: Usuario } | { ok: false; motivo: 'credenciales' | 'bloqueado' };

export async function acceder(email: string, clave: string, ip: string, agente: string | null, db: Db = pool()): Promise<ResultadoAcceso> {
  const correo = email.trim().toLowerCase().slice(0, 200);
  if ((await superaLimite(`acceso:${correo}`, MAX_FALLOS_CUENTA, VENTANA_MIN, db)) || (await superaLimite(`acceso-ip:${ip}`, MAX_FALLOS_IP, VENTANA_MIN, db))) {
    return { ok: false, motivo: 'bloqueado' };
  }
  const u = await q1<Usuario & { clave_hash: string; activo: boolean }>(
    'SELECT id, email, nombre, rol, clave_hash, activo FROM usuarios WHERE lower(email) = $1', [correo], db,
  );
  senuelo ??= hashClave('senuelo-no-valido');
  const valida = await verificarClave(clave.slice(0, 200), u?.clave_hash ?? (await senuelo));
  if (!u || !valida || !u.activo) {
    await registrarIntento(`acceso:${correo}`, false, db);
    await registrarIntento(`acceso-ip:${ip}`, false, db);
    await auditar(u?.id ?? null, 'acceso_fallido', 'usuario', u?.id ?? null, null, { ip }, db);
    return { ok: false, motivo: 'credenciales' };
  }
  await limpiarFallos(`acceso:${correo}`, db);
  const t = await crearSesion(u.id, agente, db);
  await auditar(u.id, 'acceso', 'usuario', u.id, null, { ip }, db);
  return { ok: true, token: t, usuario: { id: u.id, email: u.email, nombre: u.nombre, rol: u.rol } };
}

const esquemaNuevo = z.object({
  email: z.preprocess((v) => (typeof v === 'string' ? v.trim().toLowerCase() : v), z.email('Correo no válido.')),
  nombre: textoReq(120, 'Indica el nombre.'),
  rol: z.enum(['admin', 'colaborador']),
  clave: z.string().superRefine((c, ctx) => { const p = problemaClave(c); if (p) ctx.addIssue({ code: 'custom', message: p }); }),
});

/** Alta de usuario. Sin registro público: solo un administrador (o el comando usuario:crear). */
export async function crearUsuario(admin: Usuario | null, datos: unknown, db: Db = pool()) {
  if (admin) exigirRolAdmin(admin);
  const d = validar(esquemaNuevo, datos);
  if (await q1('SELECT 1 FROM usuarios WHERE lower(email) = $1', [d.email], db)) throw new Invalido({ email: 'Ya existe un usuario con ese correo.' });
  const { id } = (await q1<{ id: string }>(
    'INSERT INTO usuarios (email, nombre, rol, clave_hash) VALUES ($1,$2,$3,$4) RETURNING id', [d.email, d.nombre, d.rol, await hashClave(d.clave)], db,
  ))!;
  await auditar(admin?.id ?? null, 'usuario_creado', 'usuario', id, null, { rol: d.rol }, db);
  return id;
}

export async function listarUsuarios(admin: Usuario, db: Db = pool()) {
  exigirRolAdmin(admin);
  return q<{ id: string; email: string; nombre: string; rol: string; activo: boolean; ultimo_acceso: Date | null; titulares: string[] }>(
    `SELECT u.id, u.email, u.nombre, u.rol, u.activo, u.ultimo_acceso,
            coalesce(array_agg(a.titular_id::text) FILTER (WHERE a.titular_id IS NOT NULL), '{}') AS titulares
       FROM usuarios u LEFT JOIN accesos_titular a ON a.usuario_id = u.id
      GROUP BY u.id ORDER BY u.activo DESC, u.nombre`, [], db,
  );
}

export async function cambiarClave(u: Usuario, actual: string, nueva: string) {
  const fila = await q1<{ clave_hash: string }>('SELECT clave_hash FROM usuarios WHERE id = $1', [u.id]);
  if (!fila || !(await verificarClave(actual, fila.clave_hash))) throw new Invalido({ actual: 'La contraseña actual no es correcta.' });
  const p = problemaClave(nueva);
  if (p) throw new Invalido({ nueva: p });
  await transaccion(async (db) => {
    await q('UPDATE usuarios SET clave_hash = $2 WHERE id = $1', [u.id, await hashClave(nueva)], db);
    await cerrarTodas(u.id, db);
    await auditar(u.id, 'clave_cambiada', 'usuario', u.id, null, null, db);
  });
}

/** Permisos de un colaborador: sustituye la lista de titulares a los que tiene acceso. */
export async function fijarAccesos(admin: Usuario, usuarioId: string, titularIds: string[]) {
  exigirRolAdmin(admin);
  if (!esUuid(usuarioId) || !(await q1('SELECT 1 FROM usuarios WHERE id = $1', [usuarioId]))) throw new NoEncontrado('usuario');
  const ids = [...new Set(titularIds.filter(esUuid))];
  await transaccion(async (db) => {
    const antes = (await q<{ titular_id: string }>('SELECT titular_id FROM accesos_titular WHERE usuario_id = $1', [usuarioId], db)).map((r) => r.titular_id);
    await q('DELETE FROM accesos_titular WHERE usuario_id = $1 AND NOT (titular_id = ANY($2::uuid[]))', [usuarioId, ids], db);
    await q(
      'INSERT INTO accesos_titular (usuario_id, titular_id) SELECT $1, t.id FROM titulares t WHERE t.id = ANY($2::uuid[]) ON CONFLICT DO NOTHING',
      [usuarioId, ids], db,
    );
    const concedidos = ids.filter((i) => !antes.includes(i));
    const retirados = antes.filter((i) => !ids.includes(i));
    if (concedidos.length) await auditar(admin.id, 'permiso_concedido', 'usuario', usuarioId, null, { titulares: concedidos }, db);
    if (retirados.length) await auditar(admin.id, 'permiso_retirado', 'usuario', usuarioId, null, { titulares: retirados }, db);
  });
}

/** Activa o desactiva una cuenta. Al desactivarla se cierran sus sesiones al momento. */
export async function activarUsuario(admin: Usuario, usuarioId: string, activo: boolean) {
  exigirRolAdmin(admin);
  if (usuarioId === admin.id && !activo) throw new Invalido({ _: 'No puedes desactivar tu propia cuenta.' });
  await transaccion(async (db) => {
    await q('UPDATE usuarios SET activo = $2 WHERE id = $1', [usuarioId, activo], db);
    if (!activo) await cerrarTodas(usuarioId, db);
    await auditar(admin.id, 'usuario_modificado', 'usuario', usuarioId, null, { activo }, db);
  });
}

// ---------------------------------------------------------------- Recuperación de contraseña
/**
 * Crea un enlace de recuperación de un solo uso (1 hora). Devuelve null si el correo no existe,
 * pero quien llama debe responder igual en ambos casos.
 */
export async function crearRecuperacion(email: string, ip: string) {
  const correo = email.trim().toLowerCase();
  if (await superaLimite(`recuperacion-ip:${ip}`, 5, 60)) return null;
  await registrarIntento(`recuperacion-ip:${ip}`, false);
  const u = await q1<{ id: string }>('SELECT id FROM usuarios WHERE lower(email) = $1 AND activo', [correo]);
  if (!u) return null;
  const t = token();
  await q(`INSERT INTO recuperaciones (id, usuario_id, caduca_en) VALUES ($1, $2, now() + interval '1 hour')`, [sha256(t), u.id]);
  await auditar(u.id, 'recuperacion_solicitada', 'usuario', u.id, null, { ip });
  return t;
}

export async function restablecerClave(t: string, nueva: string) {
  const p = problemaClave(nueva);
  if (p) throw new Invalido({ nueva: p });
  return transaccion(async (db) => {
    const r = await q1<{ usuario_id: string }>(
      'SELECT usuario_id FROM recuperaciones WHERE id = $1 AND usada_en IS NULL AND caduca_en > now() FOR UPDATE', [sha256(t)], db,
    );
    if (!r) throw new Invalido({ _: 'El enlace no es válido o ha caducado. Solicita uno nuevo.' });
    await q('UPDATE recuperaciones SET usada_en = now() WHERE id = $1', [sha256(t)], db);
    await q('UPDATE usuarios SET clave_hash = $2 WHERE id = $1', [r.usuario_id, await hashClave(nueva)], db);
    await cerrarTodas(r.usuario_id, db);
    await auditar(r.usuario_id, 'clave_cambiada', 'usuario', r.usuario_id, null, { via: 'recuperacion' }, db);
    return r.usuario_id;
  });
}
