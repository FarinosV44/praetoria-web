// Web Push (estándar VAPID, sin proveedores de pago). Sin 'server-only' para usarlo desde la función
// programada de Netlify. El contenido es SIEMPRE neutro: nada del cliente ni del asunto en la pantalla de bloqueo.
import webpush from 'web-push';

export const MENSAJE_NEUTRO = { title: 'Praetoria', body: 'Tienes un aviso pendiente en Praetoria.' };

let configurado = false;
function configurar() {
  if (configurado) return;
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) throw new Error('Faltan VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY');
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:juanfarinos@icav.es', pub, priv);
  configurado = true;
}

export type Suscripcion = { id: string; endpoint: string; p256dh: string; auth: string };

/** Envía un push neutro. Devuelve el código HTTP del servicio de push (201 = aceptado). */
export async function enviarPush(s: Suscripcion, url: string, etiqueta?: string): Promise<{ ok: boolean; status: number; error?: string }> {
  configurar();
  try {
    const r = await webpush.sendNotification(
      { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
      JSON.stringify({ ...MENSAJE_NEUTRO, url, tag: etiqueta }),
      { TTL: 60 * 60 * 24, urgency: 'high' },
    );
    return { ok: true, status: r.statusCode };
  } catch (e) {
    const err = e as { statusCode?: number; message: string };
    return { ok: false, status: err.statusCode ?? 0, error: err.message.slice(0, 200) };
  }
}
