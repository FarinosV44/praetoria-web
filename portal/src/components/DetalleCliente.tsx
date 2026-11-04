import Link from 'next/link';
import { ChipRequisito, ChipSolicitud, Progreso, tamano } from '@/components/ui';
import { Subidor } from '@/components/Subidor';
import { Mensajes } from '@/components/Mensajes';
import { enviarMensaje } from '@/app/(cliente)/mensajes/acciones';
import type { Evento, Mensaje, Requisito, ResumenSolicitud } from '@/lib/datos';
import { estadoDocumento, estadoSolicitud, fecha, textoEvento } from '@/lib/textos';

export function DetalleCliente({ s, reqs, msgs, evs, maxMb, enviada }: {
  s: ResumenSolicitud; reqs: Requisito[]; msgs: Mensaje[]; evs: Evento[]; maxMb: number; enviada?: boolean;
}) {
  const admite = ['enviada', 'en_revision', 'aceptada'].includes(s.estado);
  const visibles = reqs.filter((r) => r.estado !== 'no_aplicable');
  return (
    <div className="grid gap-5">
      {enviada ? <p className="exito" role="status">Solicitud enviada. La revisaremos y te avisaremos por correo cuando haya novedades.</p> : null}
      <div>
        <p className="ayuda">{s.expediente_ref ? `Expediente ${s.expediente_ref} · ` : ''}Solicitud {s.referencia}</p>
        <div className="fila"><h1 className="titulo">{s.expediente_titulo ?? s.tipo_nombre}</h1><ChipSolicitud estado={s.estado} /></div>
      </div>

      <section className="card" aria-labelledby="t-estado">
        <h2 id="t-estado" className="subtitulo">Estado</h2>
        <p>{estadoSolicitud[s.estado]?.explicacion}</p>
        {s.estado_visible ? <p className="nota mt-3"><strong>Nota del despacho:</strong> {s.estado_visible}</p> : null}
        {s.estado === 'no_aceptada' && s.motivo_no_aceptada ? <p className="nota mt-3">{s.motivo_no_aceptada}</p> : null}
      </section>

      {s.estado !== 'borrador' ? (
        <section className="card" id="documentacion" aria-labelledby="t-docs">
          <h2 id="t-docs" className="subtitulo">Documentación que necesitamos para estudiar tu asunto</h2>
          {visibles.length ? <div className="mb-4"><Progreso hechos={s.aportados} total={s.total} etiqueta="Documentación aportada" /></div> : null}
          <ul className="grid gap-4">
            {visibles.map((r) => {
              const actual = r.documentos[0];
              const puedeSubir = admite && !['validado', 'no_aplicable'].includes(r.estado);
              return (
                <li key={r.id} className="card" style={{ margin: 0 }} data-requisito={r.titulo}>
                  <div className="fila mb-1">
                    <h3 className="font-semibold">{r.titulo}{r.obligatorio ? '' : <span className="ayuda font-normal"> · si lo tienes</span>}</h3>
                    <ChipRequisito estado={r.estado} />
                  </div>
                  <p className="ayuda">{r.explicacion}</p>
                  {r.ejemplo ? <p className="ayuda">Ejemplo: {r.ejemplo}</p> : null}
                  {r.comentario ? <p className={`${r.estado === 'subsanacion' ? 'error' : 'nota'} mt-2`}><strong>Despacho:</strong> {r.comentario}</p> : null}
                  {r.documentos.length ? (
                    <ul className="mt-3 grid gap-1 text-sm">
                      {r.documentos.map((d) => (
                        <li key={d.id} className="fila" style={{ opacity: actual && d.id !== actual.id && !r.multiple ? 0.65 : 1 }}>
                          <a href={`/api/documentos/${d.id}/`}>{d.nombre_original}</a>
                          <span className="ayuda">v{d.version} · {tamano(d.tamano)} · {fecha(d.subido_at)} · {estadoDocumento[d.estado]}{d.motivo ? ` — ${d.motivo}` : ''}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {puedeSubir ? (
                    <div className="mt-3">
                      {r.estado === 'subsanacion' ? <p className="text-sm font-semibold mb-2">Sube una nueva versión. La anterior se conserva en el historial.</p> : null}
                      <Subidor requisitoId={r.id} multiple={r.multiple} maxMb={maxMb} titulo={r.titulo} />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <p className="card"><Link href={`/solicitudes/${s.id}/editar/`}>Continúa tu solicitud</Link> para enviarla al despacho.</p>
      )}

      {s.estado !== 'borrador' ? (
        <section className="card" id="mensajes" aria-labelledby="t-msg">
          <h2 id="t-msg" className="subtitulo">Mensajes con el despacho</h2>
          <Mensajes mensajes={msgs} solicitudId={s.id} accion={enviarMensaje} propio="cliente" />
        </section>
      ) : null}

      {evs.length ? (
        <section className="card" aria-labelledby="t-hist">
          <h2 id="t-hist" className="subtitulo">Historial</h2>
          <ol className="grid gap-2 text-sm">
            {evs.map((e) => <li key={e.id}><span className="ayuda">{fecha(e.happened_at)}</span> · {textoEvento(e.tipo, e.detalle)}</li>)}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
