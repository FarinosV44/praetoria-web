import { poolApp } from '@/portal/lib/db';
import { ejecutarCicloAvisos } from '@/portal/lib/avisos-core';
import { claveCronValida } from '@/portal/lib/cron-clave';
import { purgarPapelera } from '@/portal/lib/papelera';
import { cicloSeguros } from '@/seguros/lib/tarea-portal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const autorizada = (r: Request) => claveCronValida(r.headers.get('x-cron-clave'), process.env.CRON_CLAVE);
// 404 indistinguible de una ruta inexistente: no se revela que el motor de avisos está aquí.
const noExiste = () => new Response('Not Found', { status: 404 });

// La llama la tarea cron de Hostinger cada minuto (Hostinger no mantiene procesos ni temporizadores
// permanentes). Solo devuelve recuentos: nunca datos personales.
export async function POST(req: Request) {
  if (!autorizada(req)) return noExiste();
  const resultado = { ...(await ejecutarCicloAvisos(poolApp())), papelera: await purgarPapelera(poolApp()).catch(() => ({ purgados: 0, fallos: -1 })) };
  // Gestor de seguros (/admin/seguros): un fallo suyo nunca detiene los avisos del despacho.
  const seguros = await cicloSeguros(poolApp()).catch((e: Error) => ({ error: e.message.slice(0, 200) }));
  console.log(JSON.stringify({ ...resultado, seguros }));
  return Response.json({ ...resultado, seguros });
}

// TEMPORAL: para averiguar qué cabecera de IP fija la CDN de Hostinger y poder configurar TRUSTED_IP_HEADER.
// Se retira en cuanto se haya comprobado en el alojamiento.
export async function GET(req: Request) {
  if (!autorizada(req)) return noExiste();
  const candidatas = ['x-forwarded-for', 'x-real-ip', 'cf-connecting-ip', 'true-client-ip', 'x-client-ip', 'x-hcdn-client-ip', 'forwarded'];
  return Response.json(Object.fromEntries(candidatas.map((c) => [c, req.headers.get(c)])));
}
