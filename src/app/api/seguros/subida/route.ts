import { usuarioApi } from '@/seguros/lib/auth/servidor';
import { recibirSubida } from '@/seguros/lib/datos/subidas';
import { maxBytes } from '@/seguros/lib/datos/documentos';
import { Invalido, NoEncontrado } from '@/seguros/lib/errores';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (cuerpo: object, status: number) => Response.json(cuerpo, { status, headers: { 'Cache-Control': 'no-store' } });

/**
 * Recibe un archivo del gestor de seguros con una autorización de un solo uso emitida por
 * prepararSubidas. Solo superadministración, mismo origen y tamaño máximo; el archivo no queda registrado
 * hasta que confirmarSubidas valida su tipo real y su hash.
 */
// Defensa CSRF además de SameSite: la petición debe venir de una página del propio portal. Con la política
// «no-referrer» del portal los navegadores envían «Origin: null» en PUT, por eso vale también Sec-Fetch-Site.
function mismoOrigen(req: Request) {
  const sitio = req.headers.get('sec-fetch-site');
  if (sitio) return sitio === 'same-origin';
  return !!process.env.PORTAL_ORIGIN && req.headers.get('origin') === process.env.PORTAL_ORIGIN;
}

export async function PUT(req: Request) {
  if (!mismoOrigen(req)) return json({ error: 'Origen no permitido.' }, 403);
  const u = await usuarioApi();
  if (!u) return json({ error: 'No encontrado.' }, 404);
  const clave = new URL(req.url).searchParams.get('clave') ?? '';
  const declarado = Number(req.headers.get('content-length') ?? 0);
  if (declarado > maxBytes()) return json({ error: 'El archivo es demasiado grande.' }, 413);
  const datos = Buffer.from(await req.arrayBuffer());
  try {
    await recibirSubida(u, clave, datos, (req.headers.get('content-type') ?? 'application/octet-stream').slice(0, 100));
    return json({ ok: true }, 200);
  } catch (e) {
    if (e instanceof NoEncontrado) return json({ error: 'La autorización de subida no es válida o ha caducado.' }, 404);
    if (e instanceof Invalido) return json({ error: Object.values(e.campos)[0] ?? e.message }, 400);
    console.error('[seguros/subida]', (e as Error).message);
    return json({ error: 'No se ha podido guardar el archivo.' }, 500);
  }
}
