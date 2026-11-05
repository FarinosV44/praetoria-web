// Servidor MCP público y de solo lectura (Streamable HTTP sin estado). Tarjeta: /.well-known/mcp/server-card.json
import { fuenteMcp } from '@/lib/agentes/contenido';
import { responderMcp } from '@/lib/agentes/mcp';

export const dynamic = 'force-dynamic';

const MAX_CUERPO = 16_000;
const CABECERAS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const errorRpc = (status: number, code: number, message: string) =>
  new Response(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code, message } }), { status, headers: CABECERAS });

/** La especificación de MCP exige validar Origin (ataques de DNS rebinding). Los clientes de servidor no lo envían. */
function origenPermitido(req: Request) {
  const origen = req.headers.get('origin');
  if (!origen) return true;
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  try {
    return new URL(origen).host === host;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  if (!origenPermitido(req)) return errorRpc(403, -32000, 'Origen no permitido');
  const cuerpo = await req.text();
  if (cuerpo.length > MAX_CUERPO) return errorRpc(413, -32600, 'Petición demasiado grande');
  let mensaje: unknown;
  try {
    mensaje = JSON.parse(cuerpo);
  } catch {
    return errorRpc(400, -32700, 'JSON no válido');
  }
  const respuesta = responderMcp(mensaje, fuenteMcp);
  if (!respuesta) return new Response(null, { status: 202, headers: { 'Cache-Control': 'no-store' } });
  return new Response(JSON.stringify(respuesta), { headers: CABECERAS });
}

// Sin estado: ni flujo SSE ni sesiones que cerrar
const noAdmitido = () => new Response(null, { status: 405, headers: { Allow: 'POST', 'Cache-Control': 'no-store' } });
export const GET = noAdmitido;
export const DELETE = noAdmitido;
