import Link from 'next/link';
import type { MiTrabajo as Datos } from '@/portal/lib/equipo';
import { fechaHora } from '@/portal/lib/agenda';
import { Panel } from './despacho';

const enlace = (sid: string | null) => (sid ? `/admin/expedientes/${sid}/` : '/admin/agenda/');

/** «Mi trabajo» (#81): qué me toca, dónde continuar y qué está bloqueado. Cada fila lleva al asunto. */
export function MiTrabajo({ d }: { d: Datos }) {
  return (
    <section className="grid gap-3" aria-labelledby="mi-trabajo">
      <h2 id="mi-trabajo" className="seccion-titulo">Mi trabajo</h2>
      <div className="rejilla-paneles">
        <Panel id="hoy" titulo="Para hoy y vencido" vacio="Nada pendiente para hoy." n={d.hoy.length}>
          {d.hoy.map((t) => <li key={t.id}>{t.vencida ? <><span className="chip chip-peligro">Vencida</span> </> : null}<Link href={enlace(t.sid)}>{t.titulo}</Link><span className="linea-2">{fechaHora(t.inicio)}{t.asunto ? ` · ${t.asunto}` : ''}</span></li>)}
        </Panel>
        <Panel id="asuntos" titulo="Mis expedientes" vacio="No tienes asuntos asignados." n={d.asuntos.length}>
          {d.asuntos.map((a) => <li key={a.id}><Link href={enlace(a.id)} className="font-semibold">{a.titulo}</Link> · {a.cliente}<span className="linea-2">{a.papel}{a.ultimo ? ` · último movimiento ${fechaHora(a.ultimo)}` : ''}</span></li>)}
        </Panel>
        <Panel id="proximas" titulo="Próximas fechas (14 días)" vacio="Sin fechas próximas." n={d.proximas.length}>
          {d.proximas.map((t) => <li key={t.id}><Link href={enlace(t.sid)}>{t.titulo}</Link>{t.tipo === 'plazo' && !t.verificado ? <> <span className="chip chip-aviso">Plazo sin verificar</span></> : null}<span className="linea-2">{fechaHora(t.inicio)}{t.asunto ? ` · ${t.asunto}` : ''}</span></li>)}
        </Panel>
        <Panel id="mensajes" titulo="Mensajes del cliente sin contestar" vacio="Ninguno." n={d.sin_responder.length}>
          {d.sin_responder.map((m) => <li key={m.sid}><Link href={enlace(m.sid)}>{m.asunto}</Link><span className="linea-2">Desde {fechaHora(m.at)}</span></li>)}
        </Panel>
        <Panel id="revisar" titulo="Documentos por revisar" vacio="Nada por revisar." n={d.por_revisar.length}>
          {d.por_revisar.map((x) => <li key={x.sid}><Link href={enlace(x.sid)}>{x.asunto}</Link><span className="linea-2">{x.n} por revisar</span></li>)}
        </Panel>
        <Panel id="movimientos" titulo="Últimos movimientos de otros" vacio="Sin novedades esta semana." n={d.movimientos.length}>
          {d.movimientos.map((m, i) => <li key={i}><Link href={enlace(m.sid)}>{m.asunto}</Link><span className="linea-2">{m.texto} · {fechaHora(m.at)}</span></li>)}
        </Panel>
        {d.sin_responsable.length ? (
          <Panel id="sin-responsable" titulo="Solicitudes sin responsable" vacio="" n={d.sin_responsable.length}>
            {d.sin_responsable.map((s) => <li key={s.sid}><Link href={`/admin/solicitudes/${s.sid}/`}>{s.asunto}</Link></li>)}
          </Panel>
        ) : null}
      </div>
    </section>
  );
}
