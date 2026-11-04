import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChipRequisito, ChipSolicitud, tamano } from '@/components/ui';
import { comoUsuario } from '@/lib/db';
import { UUID } from '@/lib/datos';
import { requerirPersonal } from '@/lib/sesion';
import { estadoDocumento, fecha } from '@/lib/textos';

export const metadata: Metadata = { title: 'Ficha de cliente' };

// Ficha única del cliente: datos, todas sus solicitudes y expedientes, y todos sus documentos por carpeta.
export default async function FichaCliente({ params }: { params: Promise<{ id: string }> }) {
  const u = await requerirPersonal();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const d = await comoUsuario(u.id, async (tx) => {
    const c = (await tx.query(`select us.id, us.name, us.email, us."emailVerified" verificado, us."createdAt" alta, pf.tipo, pf.empresa, pf.cargo, pf.telefono
      from identidad."user" us left join portal.perfiles pf on pf.user_id = us.id
      where us.id = $1 and not exists (select 1 from portal.personal p where p.user_id = us.id)`, [id])).rows[0];
    if (!c) return null;
    const asuntos = (await tx.query(`select s.id, s.referencia, s.estado, s.enviada_at, s.created_at, t.nombre tipo, x.id exp_id, x.referencia exp_ref, x.titulo exp_titulo,
        p.nombre_visible responsable,
        (select count(*) from portal.requisitos r where r.solicitud_id = s.id and r.obligatorio and r.estado in ('pendiente','subsanacion'))::int faltan,
        (select count(*) from portal.documentos dd where dd.solicitud_id = s.id and dd.estado = 'pendiente')::int por_revisar
      from portal.solicitudes s left join portal.tipos_asunto t on t.id = s.tipo_asunto_id left join portal.expedientes x on x.solicitud_id = s.id
      left join portal.personal p on p.user_id = s.responsable_id
      where s.cliente_id = $1 order by coalesce(s.enviada_at, s.created_at) desc`, [id])).rows;
    const docs = (await tx.query(`select d.id, d.nombre_original, d.version, d.tamano, d.subido_at, d.estado, d.mime, r.titulo requisito, r.carpeta, r.estado req_estado, d.solicitud_id
      from portal.documentos d join portal.requisitos r on r.id = d.requisito_id where d.cliente_id = $1 order by r.carpeta, r.titulo, d.version desc`, [id])).rows;
    return { c, asuntos, docs };
  });
  if (!d) notFound();
  const { c } = d;
  return (
    <div className="grid gap-5">
      <p><Link href="/despacho/clientes/">← Clientes</Link></p>
      <div>
        <h1 className="titulo">{c.name}</h1>
        <p className="ayuda">{c.email}{c.telefono ? ` · ${c.telefono}` : ''} · {c.tipo === 'empresa' ? `Empresa: ${c.empresa}${c.cargo ? ` (${c.cargo})` : ''}` : 'Particular'} · alta {fecha(c.alta)}{c.verificado ? '' : ' · correo sin verificar'}</p>
      </div>
      <section className="card overflow-x-auto">
        <h2 className="subtitulo">Asuntos ({d.asuntos.length})</h2>
        {d.asuntos.length === 0 ? <p className="ayuda">Este cliente aún no ha iniciado ninguna solicitud.</p> : (
          <table className="tabla">
            <thead><tr><th>Referencia</th><th>Asunto</th><th>Estado</th><th>Documentación</th><th>Responsable</th></tr></thead>
            <tbody>{d.asuntos.map((a) => (
              <tr key={a.id}>
                <td>{a.estado === 'borrador' ? a.referencia : <Link href={`/despacho/solicitudes/${a.id}/`} className="font-semibold">{a.exp_ref ?? a.referencia}</Link>}</td>
                <td>{a.exp_titulo ?? a.tipo ?? '—'}</td>
                <td><ChipSolicitud estado={a.estado} /></td>
                <td className="text-sm">{a.estado === 'borrador' ? 'Borrador del cliente' : `${a.por_revisar} por revisar · ${a.faltan} faltan`}</td>
                <td>{a.responsable ?? <span className="ayuda">Sin asignar</span>}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </section>
      <section className="card">
        <h2 className="subtitulo">Documentos ({d.docs.length})</h2>
        {d.docs.length === 0 ? <p className="ayuda">No ha aportado documentos.</p> : (
          <ul className="grid gap-2">
            {d.docs.map((x, i) => (
              <li key={x.id}>
                {i === 0 || d.docs[i - 1]!.carpeta !== x.carpeta ? <p className="chip chip-neutro mt-3 mb-1">📁 {x.carpeta}</p> : null}
                <div className="fila text-sm" style={{ borderTop: '1px solid var(--color-line)', paddingTop: 6 }}>
                  <span>
                    <a href={`/api/documentos/${x.id}/?ver=1`} target="_blank" rel="noopener" className="font-semibold">{x.nombre_original}</a>
                    {' · '}<a href={`/api/documentos/${x.id}/?descargar=1`}>Descargar</a>
                    <span className="ayuda"> · {x.requisito} · v{x.version} · {tamano(Number(x.tamano))} · {fecha(x.subido_at)}</span>
                  </span>
                  <span className="flex gap-2 items-center"><span className="text-sm">{estadoDocumento[x.estado]}</span><ChipRequisito estado={x.req_estado} />
                    <Link href={`/despacho/solicitudes/${x.solicitud_id}/#documentacion`} className="text-sm">Revisar</Link></span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
