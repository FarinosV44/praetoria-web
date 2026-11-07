import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AsistenteIA, type MensajeIA } from '@/portal/components/AsistenteIA';
import { comoUsuario } from '@/portal/lib/db';
import { UUID } from '@/portal/lib/datos';
import { env } from '@/portal/lib/env';
import { requerirPersonal } from '@/portal/lib/sesion';
import { estilosDisponibles } from '@/portal/lib/estilos';
import { opcionesIA } from '@/portal/lib/ia-opciones';
import { Migas } from '@/portal/components/NavDespacho';

export const metadata: Metadata = { title: 'Asistente del expediente' };

export default async function Asistente({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ hilo?: string; modo?: string }> }) {
  const u = await requerirPersonal();
  const { id } = await params;
  const q = await searchParams;
  if (!UUID.test(id)) notFound();
  const d = await comoUsuario(u.id, async (tx) => {
    const c = (await tx.query(`select coalesce(e.titulo, t.nombre, s.referencia) titulo, us.name cliente from portal.solicitudes s
      join identidad."user" us on us.id = s.cliente_id left join portal.expedientes e on e.solicitud_id = s.id
      left join portal.tipos_asunto t on t.id = s.tipo_asunto_id where s.id = $1 and portal.personal_ve(s.id)`, [id])).rows[0];
    if (!c) return null;
    const hilos = (await tx.query(`select id, titulo, created_at from portal.ia_hilos where solicitud_id = $1 order by created_at desc limit 30`, [id])).rows;
    const hilo = q.hilo && UUID.test(q.hilo) && hilos.some((h) => h.id === q.hilo) ? q.hilo : null;
    const mensajes = hilo ? (await tx.query(`select m.id, m.rol, m.texto, m.citas, m.limites, m.created_at at, p.nombre_visible autor, m.modelo, m.modo, m.coste_usd,
        case when v.id is null then null else jsonb_build_object('escrito', v.escrito_id, 'version', v.version, 'titulo', e.titulo, 'modelos', v.modelos, 'avisos', v.avisos) end borrador
      from portal.ia_mensajes m join portal.personal p on p.user_id = m.autor_id
      left join portal.escrito_versiones v on v.mensaje_id = m.id left join portal.escritos e on e.id = v.escrito_id
      where m.hilo_id = $1 and m.solicitud_id = $2 order by m.created_at`, [hilo, id])).rows : [];
    const escrito = hilo ? (await tx.query(`select e.id, e.titulo, v.version, v.modelos from portal.escritos e
      join lateral (select version, modelos from portal.escrito_versiones x where x.escrito_id = e.id order by version desc limit 1) v on true
      where e.hilo_id = $1 and e.solicitud_id = $2`, [hilo, id])).rows[0] ?? null : null;
    const estilos = (await estilosDisponibles(tx)).map((e) => ({ id: e.id, nombre: e.nombre }));
    // Si se recarga con una respuesta en marcha, se retoma en lugar de perderla.
    const reanudar = hilo ? (await tx.query(`select id from portal.ia_ejecuciones where hilo_id = $1 and tipo = 'chat' and estado = 'en_curso' and latido_at > now() - interval '3 minutes' order by created_at desc limit 1`, [hilo])).rows[0]?.id as string | undefined : undefined;
    return { c, hilos, hilo, estilos, reanudar: reanudar ?? null, opciones: await opcionesIA(tx), escrito: escrito ? { id: escrito.id, titulo: escrito.titulo, version: escrito.version,
      modelos: (escrito.modelos as { version_id: string; titulo: string; etiqueta: string }[]).map((m) => ({ version_id: m.version_id, titulo: m.titulo, etiqueta: m.etiqueta })) } : null, mensajes: mensajes.map((m) => ({ ...m, at: new Date(m.at).toISOString() })) as MensajeIA[] };
  });
  if (!d) notFound();
  const modo = q.modo === 'redactar' || (q.modo !== 'preguntar' && d.escrito) ? 'redactar' : 'preguntar';
  return (
    <div className="expediente">
      <aside className="expediente-lateral" aria-label="Conversaciones">
        <Migas items={[{ texto: 'Expedientes', href: '/admin/expedientes/' }, { texto: d.c.titulo, href: `/admin/expedientes/${id}/` }, { texto: 'Asistente' }]} />
        <p className="mb-2"><Link href="?" className="btn btn-secundario" style={{ minHeight: 34 }}>+ Nueva conversación</Link></p>
        <p className="mb-2"><Link href="?modo=redactar" className="btn btn-secundario" style={{ minHeight: 34 }}>Nuevo escrito</Link></p>
        <ul className="grid gap-1 text-sm">
          {d.hilos.map((h) => <li key={h.id}><Link href={`?hilo=${h.id}`} className={`block rounded px-2 py-1 no-underline truncate ${h.id === d.hilo ? 'activo' : ''}`}>{h.titulo}</Link></li>)}
        </ul>
      </aside>
      <section className="expediente-central">
        <header className="expediente-cabecera">
          <p className="ayuda text-sm">{d.c.cliente} · solo con lo que consta en este expediente</p>
          <h1 className="subtitulo" style={{ marginBottom: 0 }}>Asistente · {d.c.titulo}</h1>
        </header>
        {env.iaClave ? <AsistenteIA key={`${d.hilo ?? 'nuevo'}-${modo}`} solicitud={id} hilo={d.hilo} mensajes={d.mensajes} estilos={d.estilos} modo={modo} escrito={d.escrito} opciones={d.opciones} reanudar={d.reanudar} />
          : <p className="aviso">El asistente de IA no está configurado en este servidor.</p>}
      </section>
    </div>
  );
}
