import { z } from 'zod';
import { analizarDocumento } from '@/portal/lib/analisis';
import { personalApi, origenOk } from '@/portal/lib/api-personal';
import { comoUsuario } from '@/portal/lib/db';
import { lanzarEjecucion } from '@/portal/lib/ejecuciones';
import { iaDisponible } from '@/portal/lib/ia-proveedores';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const fallo = (status: number, error: string) => Response.json({ error }, { status, headers: { 'cache-control': 'no-store' } });
const Peticion = z.object({ documento: z.uuid(), modo: z.enum(['rapido', 'equilibrado', 'maximo']).optional() });

export async function POST(req: Request) {
  if (!(await origenOk())) return fallo(403, 'Origen no permitido.');
  const s = await personalApi();
  if ('error' in s) return s.error;
  if (!iaDisponible()) return fallo(503, 'El asistente de IA no está configurado en este servidor.');
  const d = Peticion.safeParse(await req.json().catch(() => null));
  if (!d.success) return fallo(400, 'Documento no válido.');
  const doc = await comoUsuario(s.uid, async (tx) => (await tx.query('select solicitud_id, portal.personal_escribe(solicitud_id) escribe from portal.documentos where id = $1', [d.data.documento])).rows[0]);
  if (!doc?.escribe) return fallo(404, 'No tienes acceso a este documento.');
  const ejecucion = await lanzarEjecucion(s.uid, { tipo: 'analisis', solicitud: doc.solicitud_id, hilo: null, modo: d.data.modo ?? null }, (c) => analizarDocumento(s.uid, d.data.documento, d.data.modo, c));
  return Response.json({ ejecucion }, { headers: { 'cache-control': 'no-store' } });
}
