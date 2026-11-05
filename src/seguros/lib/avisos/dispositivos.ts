import { q, type Db, pool } from '../db';

export type DispositivoPortal = { endpoint: string; p256dh: string; auth: string; dispositivo?: string | null };

/**
 * Copia en el gestor los dispositivos que la persona activó en la app de Praetoria («App móvil») y desactiva
 * los que ya no están allí. Así el planificador encola un envío por dispositivo con la misma lógica de
 * reintentos e idempotencia, y la notificación llega por la app de Praetoria.
 */
export async function sincronizarDispositivos(usuarioId: string, subs: DispositivoPortal[], db: Db = pool()) {
  for (const s of subs) {
    if (!/^https:\/\//.test(s.endpoint)) continue;
    await q(
      `INSERT INTO push_suscripciones (usuario_id, endpoint, p256dh, auth, agente, origen) VALUES ($1,$2,$3,$4,$5,'portal')
       ON CONFLICT (endpoint) DO UPDATE SET usuario_id = $1, p256dh = $3, auth = $4, agente = COALESCE($5, push_suscripciones.agente), origen = 'portal', revocada_en = NULL`,
      [usuarioId, s.endpoint, s.p256dh, s.auth, s.dispositivo?.slice(0, 200) ?? 'App Praetoria'], db,
    );
  }
  const bajas = await q(
    `UPDATE push_suscripciones SET revocada_en = now()
      WHERE usuario_id = $1 AND origen = 'portal' AND revocada_en IS NULL AND NOT (endpoint = ANY($2::text[])) RETURNING 1`,
    [usuarioId, subs.map((s) => s.endpoint)], db,
  );
  return { activos: subs.length, desactivados: bajas.length };
}

export const usuariosVinculados = (db: Db = pool()) =>
  q<{ id: string; portal_user_id: string }>('SELECT id, portal_user_id FROM usuarios WHERE portal_user_id IS NOT NULL AND activo', [], db);

export const dispositivosDe = (usuarioId: string, db: Db = pool()) =>
  q<{ id: string; agente: string | null; origen: string; creada_en: Date; ultimo_exito: Date | null; ultimo_error: string | null }>(
    `SELECT id, agente, origen, creada_en, ultimo_exito, ultimo_error FROM push_suscripciones
      WHERE usuario_id = $1 AND revocada_en IS NULL ORDER BY creada_en DESC`, [usuarioId], db);
