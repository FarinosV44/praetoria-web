import webpush from 'web-push';

/**
 * Web Push estándar (VAPID) con las MISMAS claves que la app de Praetoria: los avisos de seguros llegan a los
 * dispositivos activados en «App móvil». Si faltan las claves, el canal queda «sin configurar»: no se simula
 * ningún envío. El service worker del portal muestra siempre un texto neutro en la pantalla de bloqueo.
 */
export const pushConfigurado = () => !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
export const clavePublicaVapid = () => process.env.VAPID_PUBLIC_KEY ?? null;
// Mismo remitente por defecto que src/portal/lib/push-core.ts (web-push guarda una única configuración).
const sujeto = () => process.env.VAPID_SUBJECT || 'mailto:juanfarinos@icav.es';

let listo = false;
function preparar() {
  if (!pushConfigurado()) throw new Error('Push sin configurar: faltan VAPID_PUBLIC_KEY o VAPID_PRIVATE_KEY.');
  if (!listo) { webpush.setVapidDetails(sujeto(), process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!); listo = true; }
}

export type ResultadoPush = { ok: true } | { ok: false; caducada: boolean; error: string };

export async function enviarPush(sub: { endpoint: string; p256dh: string; auth: string }, carga: object): Promise<ResultadoPush> {
  preparar();
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(carga), { TTL: 86400, urgency: 'high' });
    return { ok: true };
  } catch (e) {
    const st = (e as { statusCode?: number }).statusCode;
    return { ok: false, caducada: st === 404 || st === 410, error: `${st ?? ''} ${(e as Error).message}`.trim().slice(0, 300) };
  }
}
