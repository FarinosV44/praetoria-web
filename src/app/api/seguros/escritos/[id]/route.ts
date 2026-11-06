import { usuarioApi } from '@/seguros/lib/auth/servidor';
import { obtenerEscrito } from '@/seguros/lib/datos/escritos';
import { auditar } from '@/seguros/lib/auditoria';
import { NoEncontrado } from '@/seguros/lib/errores';
import { aDocx, estructurar, ESTILO_BASE } from '@/portal/lib/render';

export const dynamic = 'force-dynamic';

const noEncontrado = () => new Response('No encontrado', { status: 404, headers: { 'Cache-Control': 'no-store' } });

/** Descarga una versión de un escrito (Word o texto) tras comprobar el permiso sobre su seguro. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await usuarioApi();
  if (!u) return noEncontrado();
  let e;
  try {
    e = await obtenerEscrito(u, id);
  } catch (err) {
    if (err instanceof NoEncontrado) return noEncontrado();
    throw err;
  }
  const sp = new URL(req.url).searchParams;
  const pedida = Number(sp.get('v'));
  const v = e.versiones.find((x) => x.version === pedida) ?? e.versiones[0];
  if (!v) return noEncontrado();
  const formato = sp.get('formato') === 'txt' ? 'txt' : 'docx';
  const base = `${e.titulo} v${v.version}`.replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 120);
  const nombre = `${base}.${formato}`;
  const cuerpo = formato === 'txt' ? Buffer.from(v.texto, 'utf8') : await aDocx(estructurar(v.texto), ESTILO_BASE, e.titulo);
  await auditar(u.id, 'escrito_descargado', 'escrito', e.id, e.titular, { version: v.version, formato });
  const ascii = nombre.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '');
  return new Response(new Uint8Array(cuerpo), {
    headers: {
      'Content-Type': formato === 'txt' ? 'text/plain; charset=utf-8' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nombre)}`,
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
