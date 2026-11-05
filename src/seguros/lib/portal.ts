import 'server-only';
import type { Pool } from 'pg';
import { comoUsuario } from '@/portal/lib/db';
import { sincronizarDispositivos, usuariosVinculados, type DispositivoPortal } from './avisos/dispositivos';

/** Dispositivos activos de la propia persona en la app de Praetoria (con su identidad y RLS del portal). */
export const dispositivosPropiosPortal = (portalUserId: string) =>
  comoUsuario(portalUserId, async (tx) => (await tx.query<DispositivoPortal>(
    'select endpoint, p256dh, auth, dispositivo from portal.push_suscripciones where user_id = $1 and revocada_at is null', [portalUserId])).rows);

/**
 * Para la tarea programada: con el rol notificador del portal (solo puede leer suscripciones, nunca datos
 * de clientes) sincroniza los dispositivos de todas las personas vinculadas al gestor.
 */
export async function sincronizarDispositivosPortal(poolPortal: Pool) {
  let personas = 0;
  for (const u of await usuariosVinculados()) {
    const c = await poolPortal.connect();
    let subs: DispositivoPortal[];
    try {
      await c.query('begin');
      await c.query("select set_config('app.proceso', 'notificador', true)");
      subs = (await c.query<DispositivoPortal>('select endpoint, p256dh, auth from portal.suscripciones_de($1)', [u.portal_user_id])).rows;
      await c.query('commit');
    } catch (e) { await c.query('rollback').catch(() => {}); throw e; } finally { c.release(); }
    await sincronizarDispositivos(u.id, subs);
    personas++;
  }
  return { personas };
}
