import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AsistenteIA, type MensajeIA } from '@/portal/components/AsistenteIA';
import { comoUsuario } from '@/portal/lib/db';
import { UUID } from '@/portal/lib/datos';
import { env } from '@/portal/lib/env';
import { requerirPersonal } from '@/portal/lib/sesion';
import { estilosDisponibles } from '@/portal/lib/estilos';

export const metadata: Metadata = { title: 'Asistente del expediente' };

export default async function Asistente({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ hilo?: string }> }) {
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
    const mensajes = hilo ? (await tx.query(`select m.id, m.rol, m.texto, m.citas, m.limites, m.created_at at, p.nombre_visible autor from portal.ia_mensajes m
      join portal.personal p on p.user_id = m.autor_id where m.hilo_id = $1 and m.solicitud_id = $2 order by m.created_at`, [hilo, id])).rows : [];
    const estilos = (await estilosDisponibles(tx)).map((e) => ({ id: e.id, nombre: e.nombre }));
    return { c, hilos, hilo, estilos, mensajes: mensajes.map((m) => ({ ...m, at: new Date(m.at).toISOString() })) as MensajeIA[] };
  });
  if (!d) notFound();
  return (
    <div className="expediente">
      <aside className="expediente-lateral" aria-label="Conversaciones">
        <p className="text-sm mb-2"><Link href={`/admin/expedientes/${id}/`}>← Volver al expediente</Link></p>
        <p className="mb-2"><Link href="?" className="btn btn-secundario" style={{ minHeight: 34 }}>+ Nueva conversación</Link></p>
        <ul className="grid gap-1 text-sm">
          {d.hilos.map((h) => <li key={h.id}><Link href={`?hilo=${h.id}`} className={`block rounded px-2 py-1 no-underline truncate ${h.id === d.hilo ? 'activo' : ''}`}>{h.titulo}</Link></li>)}
        </ul>
      </aside>
      <section className="expediente-central">
        <header className="expediente-cabecera">
          <p className="ayuda text-sm">{d.c.cliente} · solo con lo que consta en este expediente</p>
          <h1 className="subtitulo" style={{ marginBottom: 0 }}>Asistente · {d.c.titulo}</h1>
        </header>
        {env.iaClave ? <AsistenteIA key={d.hilo ?? 'nuevo'} solicitud={id} hilo={d.hilo} mensajes={d.mensajes} estilos={d.estilos} />
          : <p className="aviso">El asistente de IA no está configurado en este servidor.</p>}
      </section>
    </div>
  );
}
