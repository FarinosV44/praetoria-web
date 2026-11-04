import { comoUsuario } from '@/portal/lib/db';
import { origenOk, personalApi } from '@/portal/lib/api-personal';
import { enviarPush } from '@/portal/lib/push-core';

export const runtime = 'nodejs';

// Envía un aviso de prueba (texto neutro) a todos los dispositivos activos del profesional.
export async function POST() {
  if (!(await origenOk())) return new Response('Origen no permitido', { status: 403 });
  const p = await personalApi();
  if ('error' in p) return p.error;
  const subs = await comoUsuario(p.uid, async (tx) => (await tx.query(
    'select id, endpoint, p256dh, auth from portal.push_suscripciones where user_id = $1 and revocada_at is null', [p.uid])).rows);
  let ok = 0;
  for (const s of subs) {
    const r = await enviarPush(s, '/admin/avisos/', 'prueba');
    if (r.ok) ok++;
    else if (r.status === 404 || r.status === 410) {
      await comoUsuario(p.uid, (tx) => tx.query('update portal.push_suscripciones set revocada_at = now() where id = $1', [s.id]));
    }
  }
  return Response.json({ dispositivos: subs.length, entregados: ok });
}
