import { headers } from 'next/headers';
import { auth } from '@/portal/lib/auth';
import { comoUsuario } from '@/portal/lib/db';
import { UUID } from '@/portal/lib/datos';
import { elegirEstilo, estilosDisponibles } from '@/portal/lib/estilos';
import { aDocx, aPdf, estructurar } from '@/portal/lib/render';

export const runtime = 'nodejs';

// Vista previa de un estilo con un texto de muestra claramente ficticio (no es un escrito del despacho).
const MUESTRA = `AL JUZGADO (TEXTO DE MUESTRA FICTICIO)

Este documento solo sirve para ver el formato del estilo: no contiene ningún escrito real ni datos de clientes.

HECHOS

1. Primer apartado de muestra para comprobar la numeración, la sangría y el interlineado del estilo elegido.

2. Segundo apartado de muestra, algo más largo, para comprobar cómo se justifica el texto y cómo se reparte en varias líneas dentro de los márgenes configurados.

FUNDAMENTOS DE DERECHO

1. Apartado de muestra de los fundamentos.

SUPLICO

Texto de muestra del suplico.

OTROSÍ DIGO

Texto de muestra del otrosí.`;

export async function GET(req: Request) {
  const sesion = await auth.api.getSession({ headers: await headers() });
  if (!sesion) return new Response('No autorizado', { status: 401 });
  const u = new URL(req.url);
  const id = u.searchParams.get('estilo'), formato = u.searchParams.get('formato') === 'docx' ? 'docx' : 'pdf';
  const r = await comoUsuario(sesion.user.id, async (tx) => {
    const lista = await estilosDisponibles(tx);
    return lista.length && id && UUID.test(id) && lista.some((e) => e.id === id) ? elegirEstilo(lista, id) : null;
  });
  if (!r) return new Response('No encontrado', { status: 404 });
  const datos = formato === 'pdf' ? await aPdf(estructurar(MUESTRA), r.estilo, `Muestra · ${r.nombre}`) : await aDocx(estructurar(MUESTRA), r.estilo, `Muestra · ${r.nombre}`);
  return new Response(new Uint8Array(datos), { headers: {
    'content-type': formato === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'content-disposition': `${formato === 'pdf' ? 'inline' : 'attachment'}; filename="muestra-estilo.${formato}"`, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'self'" } });
}
