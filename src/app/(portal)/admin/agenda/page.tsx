import type { Metadata } from 'next';
import Link from 'next/link';
import { FormEvento } from '@/portal/components/FormEvento';
import { comoUsuario } from '@/portal/lib/db';
import { requerirPersonal } from '@/portal/lib/sesion';
import { fechaHora, partesMadrid, TIPO_ETIQUETA } from '@/portal/lib/agenda';
import { cambiarEstado, crearEvento } from './acciones';

export const metadata: Metadata = { title: 'Agenda' };

const vistas = {
  hoy: { t: 'Hoy', w: `e.estado = 'pendiente' and (e.inicio at time zone 'Europe/Madrid')::date = (now() at time zone 'Europe/Madrid')::date` },
  semana: { t: 'Próximos 7 días', w: `e.estado = 'pendiente' and e.inicio >= date_trunc('day', now() at time zone 'Europe/Madrid') at time zone 'Europe/Madrid' and e.inicio < now() + interval '7 days'` },
  mes: { t: 'Próximos 31 días', w: `e.estado = 'pendiente' and e.inicio >= date_trunc('day', now() at time zone 'Europe/Madrid') at time zone 'Europe/Madrid' and e.inicio < now() + interval '31 days'` },
  vencidos: { t: 'Vencidos sin completar', w: `e.estado = 'pendiente' and e.repeticion = 'ninguna' and e.inicio < date_trunc('day', now() at time zone 'Europe/Madrid') at time zone 'Europe/Madrid'` },
  todos: { t: 'Todos', w: `true` },
} as const;
type Vista = keyof typeof vistas;

export default async function Agenda({ searchParams }: { searchParams: Promise<{ vista?: string; ok?: string; error?: string }> }) {
  const u = await requerirPersonal();
  const q = await searchParams;
  const v: Vista = (q.vista && q.vista in vistas ? q.vista : 'semana') as Vista;
  const { eventos, asuntos } = await comoUsuario(u.id, async (tx) => ({
    eventos: (await tx.query(`select e.*, s.referencia, x.referencia exp_ref,
        (select count(*) from portal.agenda_avisos a where a.evento_id = e.id and a.estado = 'programado')::int avisos_pend
      from portal.agenda_eventos e left join portal.solicitudes s on s.id = e.solicitud_id left join portal.expedientes x on x.solicitud_id = e.solicitud_id
      where ${vistas[v].w} order by e.inicio limit 300`)).rows,
    asuntos: (await tx.query(`select s.id, coalesce(x.referencia || ' · ' || x.titulo, s.referencia || ' · ' || coalesce(t.nombre, '')) texto
      from portal.solicitudes s left join portal.expedientes x on x.solicitud_id = s.id left join portal.tipos_asunto t on t.id = s.tipo_asunto_id
      where s.estado in ('enviada', 'en_revision', 'aceptada') order by (x.id is null), coalesce(x.abierto_at, s.enviada_at) desc limit 200`)).rows,
  }));
  const hoy = partesMadrid(new Date()).fecha;
  return (
    <div className="grid gap-5">
      <div className="fila"><h1 className="titulo">Agenda</h1><Link href="/admin/avisos/" className="btn btn-secundario">Avisos</Link></div>
      {q.ok ? <p className="exito" role="status">{q.ok}</p> : null}
      {q.error ? <p className="error" role="alert">{q.error}</p> : null}
      <details className="card" open={!eventos.length}>
        <summary className="subtitulo cursor-pointer">Nuevo evento</summary>
        <div className="mt-3"><FormEvento e={{ fecha: hoy, hora: '10:00' }} accion={crearEvento} asuntos={asuntos} boton="Guardar y programar avisos" /></div>
      </details>
      <nav aria-label="Vistas de la agenda" className="flex flex-wrap gap-2">
        {Object.entries(vistas).map(([k, d]) => (
          <Link key={k} href={`?vista=${k}`} className={`chip ${k === v ? 'chip-info' : 'chip-neutro'} no-underline`} aria-current={k === v ? 'page' : undefined}>{d.t}</Link>
        ))}
      </nav>
      <section className="card">
        <h2 className="subtitulo">{vistas[v].t}</h2>
        {eventos.length === 0 ? <p className="ayuda">No hay eventos en esta vista.</p> : (
          <ul className="grid gap-3">
            {eventos.map((e) => (
              <li key={e.id} className="fila" style={{ borderTop: '1px solid var(--color-line)', paddingTop: 10 }} data-evento={e.titulo}>
                <div>
                  <Link href={`/admin/agenda/${e.id}/`} className="font-semibold">{e.titulo}</Link>
                  <p className="ayuda text-sm">
                    {fechaHora(e.inicio, !e.todo_el_dia)}{e.todo_el_dia ? ' · todo el día' : ''} · {TIPO_ETIQUETA[e.tipo]}
                    {e.repeticion !== 'ninguna' ? ` · se repite (${e.repeticion})` : ''}{e.exp_ref ?? e.referencia ? ` · ${e.exp_ref ?? e.referencia}` : ''}
                    {` · ${e.avisos_pend} avisos programados`}
                  </p>
                  {e.tipo === 'plazo' ? <span className={`chip ${e.plazo_verificado_at ? 'chip-ok' : 'chip-aviso'}`}>{e.plazo_verificado_at ? 'Fecha verificada' : 'Fecha pendiente de verificar'}</span> : null}
                  {e.estado !== 'pendiente' ? <span className="chip chip-neutro">{e.estado === 'completado' ? 'Completado' : 'Cancelado'}</span> : null}
                  {e.prioridad === 'alta' ? <span className="chip chip-aviso ml-1">Prioridad alta</span> : null}
                </div>
                {e.estado === 'pendiente' ? (
                  <form action={cambiarEstado}>
                    <input type="hidden" name="id" value={e.id} /><input type="hidden" name="estado" value="completado" />
                    <input type="hidden" name="destino" value={`/admin/agenda/?vista=${v}`} />
                    <button className="btn btn-secundario" style={{ minHeight: 38 }}>Completada</button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
