import { headers } from 'next/headers';
import { auth } from '@/portal/lib/auth';
import { comoUsuario } from '@/portal/lib/db';
import { UUID } from '@/portal/lib/datos';
import { env } from '@/portal/lib/env';
import { elegirEstilo, estilosDisponibles } from '@/portal/lib/estilos';
import { aDocx, aPdf, estructurar } from '@/portal/lib/render';
import { personalSinMfa } from '@/portal/lib/sesion';

export const runtime = 'nodejs';

// Exporta un borrador a Word editable o PDF con un perfil de estilo (#97). El texto sale de una respuesta del
// asistente del expediente (con RLS) o del propio texto enviado por el profesional. Sale como BORRADOR.
export async function POST(req: Request) {
  const h = await headers();
  // Los botones de descarga son formularios normales y el panel envía «Referrer-Policy: no-referrer», así que el
  // navegador manda «Origin: null». Se admite solo si el propio navegador declara que la petición es del mismo origen
  // (Sec-Fetch-Site no lo puede falsear una página ajena).
  const origen = h.get('origin');
  const mismo = origen === env.origin || ((origen === null || origen === 'null') && h.get('sec-fetch-site') === 'same-origin');
  if (!mismo) return new Response('Origen no permitido', { status: 403 });
  const sesion = await auth.api.getSession({ headers: h });
  if (!sesion) return new Response('No autorizado', { status: 401 });
  if (await personalSinMfa(sesion.user.id, sesion.user.twoFactorEnabled)) return new Response('Activa el doble factor', { status: 403 });
  const f = await req.formData().catch(() => null);
  if (!f) return new Response('Petición no válida', { status: 400 });
  const formato = f.get('formato') === 'pdf' ? 'pdf' : 'docx';
  const mensaje = String(f.get('mensaje') ?? ''), estiloId = String(f.get('estilo') ?? '');
  const r = await comoUsuario(sesion.user.id, async (tx) => {
    const lista = await estilosDisponibles(tx);
    if (!(await tx.query(`select 1 where portal.bib_puede_subir() or portal.rol_actual() = 'lectura'`)).rowCount) return null;
    let texto = String(f.get('texto') ?? ''), titulo = String(f.get('titulo') ?? 'Borrador').slice(0, 120);
    const materia = String(f.get('materia') ?? '') || null;
    if (UUID.test(mensaje)) {
      const m = (await tx.query(`select m.texto, coalesce(e.titulo, s.referencia) titulo from portal.ia_mensajes m join portal.solicitudes s on s.id = m.solicitud_id
        left join portal.expedientes e on e.solicitud_id = s.id where m.id = $1 and m.rol = 'asistente'`, [mensaje])).rows[0];
      if (!m) return null;
      texto = m.texto; titulo = `Borrador · ${m.titulo}`;
    }
    let marca: string | null = null;
    const escrito = String(f.get('escrito') ?? ''), version = Number(f.get('version'));
    if (UUID.test(escrito) && Number.isInteger(version) && version > 0) {
      // Versión concreta de un borrador del expediente (#94): sale marcada como BORRADOR en cada página.
      const v = (await tx.query(`select v.texto, e.titulo from portal.escrito_versiones v join portal.escritos e on e.id = v.escrito_id
        where v.escrito_id = $1 and v.version = $2`, [escrito, version])).rows[0];
      if (!v) return null;
      texto = v.texto; titulo = `${v.titulo} v${version}`.slice(0, 120); marca = `BORRADOR · versión ${version} · pendiente de revisión`;
    }
    if (!texto.trim() || texto.length > 200000) return null;
    const elegido = elegirEstilo(lista, UUID.test(estiloId) ? estiloId : null, materia);
    if (marca) elegido.estilo = { ...elegido.estilo, encabezado: elegido.estilo.encabezado ? `${marca} — ${elegido.estilo.encabezado}` : marca };
    return { texto, titulo, ...elegido };
  });
  if (!r) return new Response('No encontrado', { status: 404 });
  const bloques = estructurar(r.texto);
  const datos = formato === 'pdf' ? await aPdf(bloques, r.estilo, r.titulo) : await aDocx(bloques, r.estilo, r.titulo);
  const nombre = encodeURIComponent(`${r.titulo.replace(/[^\p{L}\p{N} ._-]/gu, '').slice(0, 80) || 'borrador'} (BORRADOR).${formato}`);
  return new Response(new Uint8Array(datos), {
    headers: {
      'content-type': formato === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'content-disposition': `attachment; filename*=UTF-8''${nombre}`, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff',
      'x-estilo': encodeURIComponent(r.nombre),
    },
  });
}
