import { z } from 'zod';
import { personalApi, origenOk } from '@/portal/lib/api-personal';
import { iniciarChat } from '@/portal/lib/chat';
import { MODELO_VALIDO } from '@/portal/lib/ia-modelos';
import { iaDisponible } from '@/portal/lib/ia-proveedores';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const NO_CACHE = { 'cache-control': 'no-store' };
const fallo = (status: number, error: string) => Response.json({ error }, { status, headers: NO_CACHE });

const Peticion = z.object({
  solicitud: z.uuid().nullable(), hilo: z.uuid().nullable(), texto: z.string().trim().min(3).max(8000),
  modo: z.enum(['rapido', 'equilibrado', 'maximo']).optional(), proveedor: z.enum(['anthropic', 'openai']).optional(), modelo: z.string().regex(MODELO_VALIDO).optional(),
  adjuntos: z.array(z.object({ nombre: z.string().max(200), texto: z.string().max(100_000) })).max(5).optional(),
});

// Inicia una consulta al Copiloto. Devuelve el identificador de la ejecución; la respuesta se sigue en /api/ia/ejecuciones/[id].
export async function POST(req: Request) {
  if (!(await origenOk())) return fallo(403, 'Origen no permitido.');
  const s = await personalApi();
  if ('error' in s) return s.error;
  if (!iaDisponible()) return fallo(503, 'El asistente de IA no está configurado en este servidor.');
  const d = Peticion.safeParse(await req.json().catch(() => null));
  if (!d.success) return fallo(400, 'Escribe tu pregunta (entre 3 y 8.000 caracteres).');
  const { solicitud, hilo, texto, modo, proveedor, modelo, adjuntos } = d.data;
  try {
    return Response.json(await iniciarChat({ uid: s.uid, solicitud, hilo, texto, adjuntos, pedido: { modo, proveedor, modelo } }), { headers: NO_CACHE });
  } catch (e) {
    const m = (e as Error).message ?? '';
    // Sin distinguir «no existe» de «no es tuyo»: no se revela la existencia de asuntos ajenos.
    if (/row-level|42501|Sin permiso|Asunto no encontrado|no pertenece/.test(m)) return fallo(404, 'No tienes acceso a este asunto.');
    console.error(`chat IA: ${(e as Error).name}`);
    return fallo(500, 'No se ha podido preparar la consulta.');
  }
}
