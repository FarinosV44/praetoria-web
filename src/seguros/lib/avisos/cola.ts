import { q, q1, type Db, pool, transaccion } from '../db';
import { correoConfigurado, enviarCorreo } from '../correo';
import { datosAviso, textoCorreo, textoPush } from './contenido';
import { enviarPush, pushConfigurado, type ResultadoPush } from './push';

/** Reintentos: 1 min, 5 min, 30 min, 2 h y 12 h. Después queda «fallido» y visible como incidencia. */
export const ESPERAS_MIN = [1, 5, 30, 120, 720];

export type Canales = {
  push: (sub: { endpoint: string; p256dh: string; auth: string }, carga: object) => Promise<ResultadoPush>;
  correo: (m: { para: string; asunto: string; texto: string }) => Promise<unknown>;
  pushListo: () => boolean;
  correoListo: () => boolean;
};

export const canalesReales: Canales = { push: enviarPush, correo: enviarCorreo, pushListo: pushConfigurado, correoListo: correoConfigurado };

type Envio = { id: string; aviso_id: string; usuario_id: string; canal: string; suscripcion_id: string | null; intentos: number; clave: string };

/**
 * Procesa la cola de envíos. Cada envío se reserva con FOR UPDATE SKIP LOCKED: varias instancias del worker
 * no envían dos veces lo mismo. «enviado» significa aceptado por el proveedor, no leído.
 */
export async function procesarCola(canales: Canales = canalesReales, limite = 50, db: Db = pool()) {
  const reservados = await transaccion(async (tx) => {
    const filas = await q<Envio>(
      `SELECT id, aviso_id, usuario_id, canal, suscripcion_id, intentos, clave FROM envios
        WHERE estado = 'pendiente' AND proximo_intento <= now() ORDER BY proximo_intento LIMIT $1 FOR UPDATE SKIP LOCKED`, [limite], tx,
    );
    if (filas.length) await q(`UPDATE envios SET estado = 'enviando', intentos = intentos + 1 WHERE id = ANY($1::uuid[])`, [filas.map((f) => f.id)], tx);
    return filas;
  });
  const resultado = { enviados: 0, fallidos: 0, reintentos: 0 };
  for (const e of reservados) {
    const r = await enviarUno(e, canales, db).catch((err) => ({ ok: false as const, error: String((err as Error).message).slice(0, 300), definitivo: false }));
    if (r.ok) {
      await q(`UPDATE envios SET estado = 'enviado', enviado_en = now(), ultimo_error = NULL WHERE id = $1`, [e.id], db);
      resultado.enviados++;
      continue;
    }
    const intento = e.intentos + 1;
    if (r.definitivo || intento >= ESPERAS_MIN.length + 1) {
      await q(`UPDATE envios SET estado = 'fallido', ultimo_error = $2 WHERE id = $1`, [e.id, r.error], db);
      resultado.fallidos++;
      if (e.canal === 'push') await respaldoCorreo(e, db);
    } else {
      await q(`UPDATE envios SET estado = 'pendiente', ultimo_error = $2, proximo_intento = now() + make_interval(mins => $3) WHERE id = $1`, [e.id, r.error, ESPERAS_MIN[intento - 1]], db);
      resultado.reintentos++;
    }
  }
  return resultado;
}

async function enviarUno(e: Envio, c: Canales, db: Db): Promise<{ ok: true } | { ok: false; error: string; definitivo: boolean }> {
  const d = await datosAviso(e.aviso_id, db);
  if (!d) return { ok: false, error: 'Aviso inexistente', definitivo: true };
  const u = await q1<{ email: string; activo: boolean; push_detallado: boolean }>('SELECT email, activo, push_detallado FROM usuarios WHERE id = $1', [e.usuario_id], db);
  if (!u?.activo) return { ok: false, error: 'Usuario desactivado', definitivo: true };
  const url = `${process.env.PORTAL_ORIGIN ?? process.env.APP_URL ?? ''}/admin/seguros/avisos/${e.aviso_id}/`;

  if (e.canal === 'push') {
    if (!c.pushListo()) return { ok: false, error: 'Push sin configurar (VAPID)', definitivo: true };
    const sub = e.suscripcion_id ? await q1<{ endpoint: string; p256dh: string; auth: string; revocada_en: Date | null }>('SELECT endpoint, p256dh, auth, revocada_en FROM push_suscripciones WHERE id = $1', [e.suscripcion_id], db) : null;
    if (!sub || sub.revocada_en) return { ok: false, error: 'Suscripción revocada', definitivo: true };
    const r = await c.push(sub, { ...textoPush(d, u.push_detallado), url: `/admin/seguros/avisos/${e.aviso_id}/`, tag: `aviso-${e.aviso_id}` });
    if (r.ok) {
      await q('UPDATE push_suscripciones SET ultimo_exito = now(), ultimo_error = NULL WHERE id = $1', [e.suscripcion_id], db);
      return { ok: true };
    }
    await q('UPDATE push_suscripciones SET ultimo_error = $2 WHERE id = $1', [e.suscripcion_id, r.error], db);
    if (r.caducada) {
      // El navegador la dio de baja: se limpia y no se vuelve a intentar.
      await q('UPDATE push_suscripciones SET revocada_en = now() WHERE id = $1', [e.suscripcion_id], db);
      return { ok: false, error: `Suscripción caducada: ${r.error}`, definitivo: true };
    }
    return { ok: false, error: r.error, definitivo: false };
  }

  if (e.canal === 'correo') {
    if (!c.correoListo()) return { ok: false, error: 'Correo sin configurar (SMTP)', definitivo: true };
    const m = textoCorreo(d, url);
    await c.correo({ para: u.email, asunto: m.asunto, texto: m.texto });
    return { ok: true };
  }
  return { ok: true };
}

/** Si falla el push de forma definitiva y la persona quiere correo de respaldo, se encola un correo (una sola vez). */
async function respaldoCorreo(e: Envio, db: Db) {
  const u = await q1<{ correo_avisos: string }>('SELECT correo_avisos FROM usuarios WHERE id = $1', [e.usuario_id], db);
  if (u?.correo_avisos !== 'respaldo' || !correoConfigurado()) return;
  const emision = e.clave.split(':')[1];
  await q(
    `INSERT INTO envios (clave, aviso_id, usuario_id, canal) VALUES ($1,$2,$3,'correo') ON CONFLICT (clave) DO NOTHING`,
    [`${e.aviso_id}:${emision}:correo:${e.usuario_id}:`, e.aviso_id, e.usuario_id], db,
  );
}
