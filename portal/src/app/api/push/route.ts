import { z } from 'zod';
import { comoUsuario } from '@/lib/db';
import { origenOk, personalApi } from '@/lib/api-personal';

export const runtime = 'nodejs';
const esquema = z.object({
  endpoint: z.string().url().startsWith('https://').max(1000),
  keys: z.object({ p256dh: z.string().min(40).max(200), auth: z.string().min(10).max(100) }),
});

// Registra (o reactiva) la suscripción push de este dispositivo para el profesional con sesión.
export async function POST(req: Request) {
  if (!(await origenOk())) return new Response('Origen no permitido', { status: 403 });
  const p = await personalApi();
  if ('error' in p) return p.error;
  const d = esquema.safeParse(await req.json().catch(() => null));
  if (!d.success) return new Response('Suscripción no válida', { status: 400 });
  const dispositivo = (req.headers.get('user-agent') ?? '').slice(0, 200);
  await comoUsuario(p.uid, async (tx) => {
    // Si el mismo endpoint estaba registrado por otro usuario, no se reasigna: se rechaza.
    const r = await tx.query(`insert into portal.push_suscripciones (user_id, endpoint, p256dh, auth, dispositivo) values ($1, $2, $3, $4, $5)
      on conflict (endpoint) do nothing`, [p.uid, d.data.endpoint, d.data.keys.p256dh, d.data.keys.auth, dispositivo]);
    if (!r.rowCount) {
      await tx.query(`update portal.push_suscripciones set p256dh = $3, auth = $4, dispositivo = $5, revocada_at = null where endpoint = $2 and user_id = $1`,
        [p.uid, d.data.endpoint, d.data.keys.p256dh, d.data.keys.auth, dispositivo]);
    }
  });
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!(await origenOk())) return new Response('Origen no permitido', { status: 403 });
  const p = await personalApi();
  if ('error' in p) return p.error;
  const body = await req.json().catch(() => null) as { endpoint?: string; id?: string } | null;
  await comoUsuario(p.uid, (tx) => tx.query(`update portal.push_suscripciones set revocada_at = now()
    where user_id = $1 and revocada_at is null and (endpoint = $2 or id::text = $3)`, [p.uid, body?.endpoint ?? '', body?.id ?? '']));
  return Response.json({ ok: true });
}
