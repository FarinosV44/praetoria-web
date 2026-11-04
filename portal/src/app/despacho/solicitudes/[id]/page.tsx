import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChipRequisito, ChipSolicitud, tamano } from '@/components/ui';
import { Mensajes } from '@/components/Mensajes';
import { enviarMensaje } from '@/app/(cliente)/mensajes/acciones';
import { comoUsuario } from '@/lib/db';
import { eventos, mensajes, requisitos, UUID } from '@/lib/datos';
import { requerirPersonal } from '@/lib/sesion';
import { estadoDocumento, fecha, textoEvento } from '@/lib/textos';
import * as A from '../../acciones';

export const metadata: Metadata = { title: 'Solicitud · Despacho' };

export default async function DetalleDespacho({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const u = await requerirPersonal();
  const { id } = await params;
  const q = await searchParams;
  if (!UUID.test(id)) notFound();
  const d = await comoUsuario(u.id, async (tx) => {
    const s = (await tx.query(`select s.*, t.nombre tipo_nombre, us.name cliente_nombre, us.email cliente_email, us."createdAt" cliente_alta,
        pf.tipo cliente_tipo, pf.empresa, pf.cargo, pf.telefono, e.id expediente_id, e.referencia expediente_ref, e.titulo expediente_titulo
      from portal.solicitudes s join identidad."user" us on us.id = s.cliente_id left join portal.perfiles pf on pf.user_id = s.cliente_id
      left join portal.tipos_asunto t on t.id = s.tipo_asunto_id left join portal.expedientes e on e.solicitud_id = s.id where s.id = $1`, [id])).rows[0];
    if (!s) return null;
    const otras = (await tx.query(`select id, referencia, estado from portal.solicitudes where cliente_id = $1 and id <> $2 and estado <> 'borrador'`, [s.cliente_id, id])).rows;
    const personal = (await tx.query(`select user_id, nombre_visible from portal.personal where activo order by nombre_visible`)).rows;
    const notas = (await tx.query(`select n.texto, n.created_at, p.nombre_visible autor from portal.notas_internas n join portal.personal p on p.user_id = n.autor_id
      where n.solicitud_id = $1 order by n.created_at desc`, [id])).rows;
    return { s, otras, personal, notas, reqs: await requisitos(tx, id), msgs: await mensajes(tx, id), evs: await eventos(tx, id) };
  });
  if (!d) notFound();
  const { s } = d;
  const decidible = ['enviada', 'en_revision'].includes(s.estado);
  const H = ({ n }: { n?: string }) => <input type="hidden" name="solicitud" value={n ?? id} />;

  return (
    <div className="grid gap-5">
      <p><Link href="/despacho/">← Bandeja</Link></p>
      {q.ok ? <p className="exito" role="status">{q.ok}</p> : null}
      {q.error ? <p className="error" role="alert">{q.error}</p> : null}
      <div className="fila">
        <div>
          <p className="ayuda">{s.expediente_ref ? `Expediente ${s.expediente_ref} · ` : ''}Solicitud {s.referencia}{s.urgencia === 'urgente' ? ' · URGENTE' : ''}</p>
          <h1 className="titulo">{s.expediente_titulo ?? s.tipo_nombre}</h1>
        </div>
        <ChipSolicitud estado={s.estado} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="grid gap-5 content-start">
          <section className="card">
            <h2 className="subtitulo">Datos de la solicitud</h2>
            <dl className="grid gap-2">
              <div><dt className="etiqueta">Cliente</dt><dd>{s.cliente_nombre} · {s.cliente_email}{s.cliente_tipo === 'empresa' ? ` · ${s.empresa}${s.cargo ? ` (${s.cargo})` : ''}` : ''}{s.telefono ? ` · ${s.telefono}` : ''}</dd></div>
              <div><dt className="etiqueta">Qué ha pasado</dt><dd className="whitespace-pre-wrap">{s.descripcion}</dd></div>
              <div><dt className="etiqueta">Fechas indicadas</dt><dd>{s.fechas || '—'}</dd></div>
              <div><dt className="etiqueta">Localidad</dt><dd>{s.localidad || '—'}</dd></div>
              <div><dt className="etiqueta">Otra parte (conflictos)</dt><dd>{s.contraparte || '—'}</dd></div>
              <div><dt className="etiqueta">Contacto preferido</dt><dd>{s.contacto_preferido}</dd></div>
              <div><dt className="etiqueta">Enviada</dt><dd>{s.enviada_at ? fecha(s.enviada_at) : '—'}</dd></div>
              {d.otras.length ? <div><dt className="etiqueta">Otras solicitudes del cliente</dt><dd>{d.otras.map((o) => <Link key={o.id} href={`/despacho/solicitudes/${o.id}/`} className="mr-3">{o.referencia}</Link>)}</dd></div> : null}
            </dl>
          </section>

          <section className="card" id="documentacion">
            <h2 className="subtitulo">Documentación</h2>
            <ul className="grid gap-4">
              {d.reqs.map((r) => (
                <li key={r.id} className="card" style={{ margin: 0 }} data-requisito={r.titulo}>
                  <div className="fila"><strong>{r.titulo}{r.obligatorio ? '' : ' (opcional)'}{r.solicitado_por ? ' · añadido por el despacho' : ''}</strong><ChipRequisito estado={r.estado} /></div>
                  <p className="ayuda">{r.explicacion}</p>
                  {r.comentario ? <p className="nota mt-2 text-sm">Visible al cliente: {r.comentario}</p> : null}
                  {r.documentos.length ? (
                    <ul className="grid gap-3 mt-3">
                      {r.documentos.map((doc) => (
                        <li key={doc.id} className="grid gap-2" style={{ borderTop: '1px solid var(--color-line)', paddingTop: 8 }} data-documento={doc.nombre_original}>
                          <div className="fila text-sm">
                            <a href={`/api/documentos/${doc.id}/`} className="font-semibold">{doc.nombre_original}</a>
                            <span>v{doc.version} · {tamano(doc.tamano)} · {fecha(doc.subido_at)} · <strong>{estadoDocumento[doc.estado]}</strong></span>
                          </div>
                          {doc.analisis === 'no_analizado' ? <p className="ayuda text-xs">Sin análisis antivirus (no configurado en este entorno).</p> : null}
                          {doc.motivo ? <p className="ayuda text-sm">Motivo: {doc.motivo}</p> : null}
                          {doc.estado === 'pendiente' && s.estado !== 'no_aceptada' ? (
                            <div className="grid gap-2 sm:grid-cols-2">
                              <form action={A.revisarDocumento}><H /><input type="hidden" name="documento" value={doc.id} /><input type="hidden" name="decision" value="valido" />
                                <button className="btn btn-secundario w-full">Validar documento</button></form>
                              <form action={A.revisarDocumento} className="flex gap-2"><H /><input type="hidden" name="documento" value={doc.id} /><input type="hidden" name="decision" value="rechazado" />
                                <label className="sr-only" htmlFor={`m-${doc.id}`}>Motivo de la subsanación</label>
                                <input id={`m-${doc.id}`} name="motivo" placeholder="Qué debe corregir el cliente" className="flex-1 min-w-0 border rounded-md px-2" style={{ borderColor: 'var(--color-line)' }} />
                                <button className="btn btn-secundario">Pedir subsanación</button></form>
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : <p className="ayuda mt-2 text-sm">Sin documentos aportados.</p>}
                  <details className="mt-3">
                    <summary className="text-sm font-semibold cursor-pointer">Cambiar estado de este documento</summary>
                    <form action={A.estadoRequisito} className="grid gap-2 mt-2">
                      <H /><input type="hidden" name="requisito" value={r.id} />
                      <select name="estado" defaultValue={r.estado} className="border rounded-md p-2" aria-label="Estado">
                        <option value="pendiente">Pendiente de aportar</option><option value="en_revision">En revisión</option>
                        <option value="validado">Documento validado</option><option value="subsanacion">Necesita subsanación</option>
                        <option value="no_aplicable">No aplicable</option>
                      </select>
                      <input name="comentario" placeholder="Comentario visible para el cliente (opcional)" className="border rounded-md p-2" aria-label="Comentario para el cliente" />
                      <button className="btn btn-secundario">Guardar</button>
                    </form>
                  </details>
                </li>
              ))}
            </ul>
            {s.estado !== 'no_aceptada' ? (
              <details className="mt-4">
                <summary className="font-semibold cursor-pointer">Pedir un documento más</summary>
                <form action={A.anadirRequisito} className="grid gap-2 mt-3">
                  <H />
                  <div className="campo"><label htmlFor="nr-t">Documento</label><input id="nr-t" name="titulo" required maxLength={160} /></div>
                  <div className="campo"><label htmlFor="nr-e">Por qué lo necesitamos (lo verá el cliente)</label><textarea id="nr-e" name="explicacion" required maxLength={600} rows={2} /></div>
                  <label className="flex gap-2"><input type="checkbox" name="obligatorio" defaultChecked /> Obligatorio</label>
                  <label className="flex gap-2"><input type="checkbox" name="multiple" /> Admite varios archivos</label>
                  <button className="btn btn-primario">Pedir documento</button>
                </form>
              </details>
            ) : null}
          </section>

          <section className="card" id="mensajes">
            <h2 className="subtitulo">Mensajes con el cliente</h2>
            <Mensajes mensajes={d.msgs} solicitudId={id} accion={enviarMensaje} propio="despacho" />
          </section>
        </div>

        <aside className="grid gap-5 content-start">
          <section className="card">
            <h2 className="subtitulo">Decisión</h2>
            {s.estado === 'enviada' ? <form action={A.marcarEnRevision} className="mb-3"><H /><button className="btn btn-secundario w-full">Marcar en revisión</button></form> : null}
            {s.conflictos_revisados_at ? <p className="exito text-sm mb-3">Conflictos revisados el {fecha(s.conflictos_revisados_at)}.</p> : decidible ? (
              <form action={A.registrarConflictos} className="grid gap-2 mb-4">
                <H />
                <p className="text-sm">Antes de aceptar, comprueba si el despacho representa o ha representado a la otra parte.</p>
                <textarea name="nota" rows={2} placeholder="Nota interna (opcional)" className="border rounded-md p-2" aria-label="Nota de conflictos" />
                <label className="flex gap-2 text-sm"><input type="checkbox" name="confirmo" /> He revisado los posibles conflictos de intereses</label>
                <button className="btn btn-secundario">Registrar revisión</button>
              </form>
            ) : null}
            {decidible ? (
              <>
                <form action={A.convertirEnExpediente} className="grid gap-2 mb-4">
                  <H />
                  <div className="campo"><label htmlFor="ce-t">Título del expediente</label><input id="ce-t" name="titulo" defaultValue={`${s.tipo_nombre ?? 'Asunto'} · ${s.cliente_nombre}`} maxLength={200} /></div>
                  <div className="campo"><label htmlFor="ce-r">Responsable</label>
                    <select id="ce-r" name="responsable" defaultValue={s.responsable_id ?? u.id}>{d.personal.map((p) => <option key={p.user_id} value={p.user_id}>{p.nombre_visible}</option>)}</select></div>
                  <button className="btn btn-primario" disabled={!s.conflictos_revisados_at}>Aceptar y abrir expediente</button>
                </form>
                <form action={A.noAceptar} className="grid gap-2">
                  <H />
                  <div className="campo"><label htmlFor="na-m">Motivo (lo verá el cliente)</label><textarea id="na-m" name="motivo" rows={2} maxLength={1000} /></div>
                  <button className="btn btn-secundario">No aceptar la solicitud</button>
                </form>
              </>
            ) : null}
          </section>
          <section className="card">
            <h2 className="subtitulo">Responsable</h2>
            <form action={A.asignarResponsable} className="flex gap-2">
              <H />
              <select name="responsable" defaultValue={s.responsable_id ?? ''} className="flex-1 border rounded-md p-2" aria-label="Responsable">
                <option value="" disabled>Sin asignar</option>
                {d.personal.map((p) => <option key={p.user_id} value={p.user_id}>{p.nombre_visible}</option>)}
              </select>
              <button className="btn btn-secundario">Asignar</button>
            </form>
          </section>
          <section className="card">
            <h2 className="subtitulo">Nota de estado para el cliente</h2>
            <p className="ayuda text-sm mb-2">Solo lo que el despacho quiera comunicar. No describas el pronóstico del asunto.</p>
            <form action={A.publicarEstado} className="grid gap-2">
              <H /><textarea name="texto" rows={3} maxLength={600} defaultValue={s.estado_visible ?? ''} className="border rounded-md p-2" aria-label="Nota visible para el cliente" />
              <button className="btn btn-secundario">Publicar</button>
            </form>
          </section>
          <section className="card">
            <h2 className="subtitulo">Notas internas</h2>
            <p className="ayuda text-sm mb-2">El cliente nunca las ve.</p>
            <form action={A.notaInterna} className="grid gap-2 mb-3"><H /><textarea name="texto" rows={2} maxLength={4000} className="border rounded-md p-2" aria-label="Nota interna" /><button className="btn btn-secundario">Guardar nota</button></form>
            <ul className="grid gap-2 text-sm">{d.notas.map((n, i) => <li key={i}><span className="ayuda">{n.autor} · {fecha(n.created_at)}</span><br />{n.texto}</li>)}</ul>
          </section>
          <section className="card">
            <h2 className="subtitulo">Historial y auditoría</h2>
            <ol className="grid gap-2 text-sm max-h-[420px] overflow-y-auto">
              {d.evs.map((e) => <li key={e.id}><span className="ayuda">{fecha(e.happened_at)} · {e.actor ?? 'Sistema'}{e.visible_cliente ? '' : ' · interno'}</span><br />{textoEvento(e.tipo, e.detalle)}</li>)}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}
