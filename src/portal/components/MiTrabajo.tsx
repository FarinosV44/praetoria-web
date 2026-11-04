import Link from 'next/link';
import type { MiTrabajo as Datos } from '@/portal/lib/equipo';
import { fechaHora } from '@/portal/lib/agenda';

const enlace = (sid: string | null) => (sid ? `/admin/expedientes/${sid}/` : '/admin/agenda/');

function Bloque({ titulo, vacio, n, children, id }: { titulo: string; vacio: string; n: number; children: React.ReactNode; id: string }) {
  return (
    <section className="card" aria-labelledby={`mt-${id}`} data-bloque={id}>
      <h3 id={`mt-${id}`} className="font-semibold mb-2">{titulo} {n ? <span className="ayuda">({n})</span> : null}</h3>
      {n ? <ul className="grid gap-1 text-sm">{children}</ul> : <p className="ayuda text-sm">{vacio}</p>}
    </section>
  );
}

/** «Mi trabajo» (#81): qué me toca, dónde continuar y qué está bloqueado. Cada fila lleva al asunto. */
export function MiTrabajo({ d }: { d: Datos }) {
  return (
    <section className="grid gap-3" aria-label="Mi trabajo">
      <h2 className="subtitulo" style={{ marginBottom: 0 }}>Mi trabajo</h2>
      <div className="grid md:grid-cols-2 gap-3">
        <Bloque id="hoy" titulo="Para hoy y vencido" vacio="Nada pendiente para hoy." n={d.hoy.length}>
          {d.hoy.map((t) => <li key={t.id}><Link href={enlace(t.sid)}>{t.vencida ? '⚠️ ' : ''}{t.titulo}</Link> · {fechaHora(t.inicio)}{t.asunto ? <span className="ayuda"> · {t.asunto}</span> : null}</li>)}
        </Bloque>
        <Bloque id="asuntos" titulo="Mis expedientes" vacio="No tienes asuntos asignados." n={d.asuntos.length}>
          {d.asuntos.map((a) => <li key={a.id}><Link href={enlace(a.id)} className="font-semibold">{a.titulo}</Link> · {a.cliente}<span className="ayuda"> · {a.papel}{a.ultimo ? ` · último movimiento ${fechaHora(a.ultimo)}` : ''}</span></li>)}
        </Bloque>
        <Bloque id="proximas" titulo="Próximas fechas (14 días)" vacio="Sin fechas próximas." n={d.proximas.length}>
          {d.proximas.map((t) => <li key={t.id}><Link href={enlace(t.sid)}>{t.titulo}</Link> · {fechaHora(t.inicio)}{t.tipo === 'plazo' && !t.verificado ? <strong> · plazo sin verificar</strong> : null}{t.asunto ? <span className="ayuda"> · {t.asunto}</span> : null}</li>)}
        </Bloque>
        <Bloque id="mensajes" titulo="Mensajes del cliente sin contestar" vacio="Ninguno." n={d.sin_responder.length}>
          {d.sin_responder.map((m) => <li key={m.sid}><Link href={enlace(m.sid)}>{m.asunto}</Link> · desde {fechaHora(m.at)}</li>)}
        </Bloque>
        <Bloque id="revisar" titulo="Documentos por revisar" vacio="Nada por revisar." n={d.por_revisar.length}>
          {d.por_revisar.map((x) => <li key={x.sid}><Link href={enlace(x.sid)}>{x.asunto}</Link> · {x.n}</li>)}
        </Bloque>
        <Bloque id="movimientos" titulo="Últimos movimientos de otros" vacio="Sin novedades esta semana." n={d.movimientos.length}>
          {d.movimientos.map((m, i) => <li key={i}><Link href={enlace(m.sid)}>{m.asunto}</Link> · {m.texto} · {fechaHora(m.at)}</li>)}
        </Bloque>
        {d.sin_responsable.length ? (
          <Bloque id="sin-responsable" titulo="Solicitudes sin responsable" vacio="" n={d.sin_responsable.length}>
            {d.sin_responsable.map((s) => <li key={s.sid}><Link href={`/admin/solicitudes/${s.sid}/`}>{s.asunto}</Link></li>)}
          </Bloque>
        ) : null}
      </div>
    </section>
  );
}
