import { personalApi } from '@/portal/lib/api-personal';
import { UUID } from '@/portal/lib/datos';
import { flujoEjecucion, leerEjecucion } from '@/portal/lib/ejecuciones';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Estado de una ejecución. Con ?flujo=1 y si sigue viva en este servidor, eventos en directo; si no, el estado guardado (RLS).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await personalApi();
  if ('error' in s) return s.error;
  const { id } = await params;
  if (!UUID.test(id)) return new Response('No encontrado', { status: 404 });
  if (new URL(req.url).searchParams.get('flujo') === '1') {
    const f = flujoEjecucion(id, s.uid);
    if (f) return f;
  }
  const e = await leerEjecucion(s.uid, id);
  if (!e) return new Response('No encontrado', { status: 404 });
  return Response.json({ estado: e.estado, progreso: e.progreso, parcial: e.parcial, resultado: e.resultado, error: e.error, modelo: e.modelo, proveedor: e.proveedor, interrumpida: e.interrumpida }, { headers: { 'cache-control': 'no-store' } });
}
