import type { Metadata } from 'next';
import Link from 'next/link';
import { Cabecera, enlaceCon, FiltroSelector, Filtros, FiltroTexto, Resultados, textoOpcion, Vacio, Vistas } from '@/portal/components/despacho';
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
  verificar: { t: 'Plazos sin verificar', w: `e.estado = 'pendiente' and e.tipo = 'plazo' and e.plazo_verificado_at is null` },
  sin_responsable: { t: 'Responsable sin acceso', w: `e.estado = 'pendiente' and not exists (select 1 from portal.personal p where p.user_id = e.propietario_id and p.activo)` },
  todos: { t: 'Todos', w: `true` },
} as const;
type Vista = keyof typeof vistas;

export default async function Agenda({ searchParams }: { searchParams: Promise<{ vista?: string; ok?: string; error?: string; q?: string; tipo?: string }> }) {
  const u = await requerirPersonal();
  const q = await searchParams;
  const v: Vista = (q.vista && q.vista in vistas ? q.vista : 'semana') as Vista;
  const texto = (q.q ?? '').trim().slice(0, 100);
  const tipo = q.tipo && q.tipo in TIPO_ETIQUETA ? q.tipo : '';
  const { eventos, asuntos } = await comoUsuario(u.id, async (tx) => ({
    eventos: (await tx.query(`select e.*, s.referencia, x.referencia exp_ref,
        (select count(*) from portal.agenda_avisos a where a.evento_id = e.id and a.estado = 'programado')::int avisos_pend
      from portal.agenda_eventos e left join portal.solicitudes s on s.id = e.solicitud_id left join portal.expedientes x on x.solicitud_id = e.solicitud_id
      where ${vistas[v].w} and ($1 = '' or e.titulo ilike '%' || $1 || '%' or coalesce(x.referencia, s.referencia, '') ilike '%' || $1 || '%') and ($2 = '' or e.tipo = $2) order by e.inicio limit 300`, [texto, tipo])).rows,
    asuntos: (await tx.query(`select s.id, coalesce(x.referencia || ' · ' || x.titulo, s.referencia || ' · ' || coalesce(t.nombre, '')) texto
      from portal.solicitudes s left join portal.expedientes x on x.solicitud_id = s.id left join portal.tipos_asunto t on t.id = s.tipo_asunto_id
      where s.estado in ('enviada', 'en_revision', 'aceptada') order by (x.id is null), coalesce(x.abierto_at, s.enviada_at) desc limit 200`)).rows,
  }));
  const hoy = partesMadrid(new Date()).fecha;
  const BASE = '/admin/agenda/';
  const actuales = { vista: v === 'semana' ? undefined : v, q: texto || undefined, tipo: tipo || undefined };
  const enlace = (c: Record<string, string | undefined>) => enlaceCon(BASE, actuales, c);
  const opcionesTipo: [string, string][] = [['', 'Todos'], ...Object.entries(TIPO_ETIQUETA).map(([k, t]): [string, string] => [k, t as string])];
  const activos = [
    texto ? { texto: `Buscar: ${texto}`, href: enlace({ q: undefined }) } : null,
    tipo ? { texto: `Tipo: ${textoOpcion(opcionesTipo, tipo)}`, href: enlace({ tipo: undefined }) } : null,
  ].filter((x): x is { texto: string; href: string } => !!x);
  return (
    <div className="grid gap-4">
      <Cabecera titulo="Agenda" entradilla="Plazos, citas y tareas del despacho, con sus avisos." acciones={<Link href="/admin/avisos/" className="btn btn-secundario">Avisos</Link>} />
      {q.ok ? <p className="exito" role="status">{q.ok}</p> : null}
      {q.error ? <p className="error" role="alert">{q.error}</p> : null}
      <details className="card" open={!eventos.length && !activos.length}>
        <summary className="subtitulo cursor-pointer">Nuevo evento</summary>
        <div className="mt-3"><FormEvento e={{ fecha: hoy, hora: '10:00' }} accion={crearEvento} asuntos={asuntos} boton="Guardar y programar avisos" /></div>
      </details>
      <Vistas etiqueta="Vistas de la agenda" items={Object.entries(vistas).map(([k, d]) => ({ texto: d.t, href: enlace({ vista: k === 'semana' ? undefined : k }), activo: k === v }))} />
      <Filtros accion={BASE} etiqueta="Buscar en la agenda" columnas={3} ocultos={{ vista: actuales.vista }} activos={activos} limpiar={enlaceCon(BASE, { vista: actuales.vista })}
        basicos={<>
          <FiltroTexto nombre="q" etiqueta="Buscar eventos" valor={texto} ayuda="Título o referencia del expediente" ancho />
          <FiltroSelector nombre="tipo" etiqueta="Tipo de evento" valor={tipo} opciones={opcionesTipo} />
        </>} />
      <Resultados total={eventos.length} nombre={['evento', 'eventos']} />
      {eventos.length === 0 ? <Vacio titulo={`${vistas[v].t}: sin eventos`}>No hay eventos en esta vista.</Vacio> : (
        <div className="tabla-marco">
          <table className="tabla tabla-apilada">
            <caption className="sr-only">{vistas[v].t}</caption>
            <thead><tr><th>Fecha</th><th>Evento</th><th>Tipo</th><th>Expediente</th><th>Situación</th><th>Avisos</th><th><span className="sr-only">Acción</span></th></tr></thead>
            <tbody>
              {eventos.map((e) => (
                <tr key={e.id} data-evento={e.titulo}>
                  <td data-e="Fecha" className="text-sm whitespace-nowrap">{fechaHora(e.inicio, !e.todo_el_dia)}{e.todo_el_dia ? <span className="ref">Todo el día</span> : null}</td>
                  <td data-e="Evento"><Link href={`/admin/agenda/${e.id}/`}>{e.titulo}</Link>{e.repeticion !== 'ninguna' ? <span className="ref">Se repite ({e.repeticion})</span> : null}</td>
                  <td data-e="Tipo" className="text-sm">{TIPO_ETIQUETA[e.tipo]}</td>
                  <td data-e="Expediente" className="text-sm">{e.solicitud_id ? <Link href={`/admin/expedientes/${e.solicitud_id}/`}>{e.exp_ref ?? e.referencia}</Link> : <span className="ayuda">—</span>}</td>
                  <td data-e="Situación"><div className="flex flex-wrap gap-1">
                    {e.tipo === 'plazo' ? <span className={`chip ${e.plazo_verificado_at ? 'chip-ok' : 'chip-aviso'}`}>{e.plazo_verificado_at ? 'Fecha verificada' : 'Fecha pendiente de verificar'}</span> : null}
                    {e.estado !== 'pendiente' ? <span className="chip chip-neutro">{e.estado === 'completado' ? 'Completado' : 'Cancelado'}</span> : null}
                    {e.prioridad === 'alta' ? <span className="chip chip-aviso">Prioridad alta</span> : null}
                    {e.estado === 'pendiente' && e.tipo !== 'plazo' && e.prioridad !== 'alta' ? <span className="ayuda">Pendiente</span> : null}
                  </div></td>
                  <td data-e="Avisos" className="text-sm whitespace-nowrap">{e.avisos_pend} programados</td>
                  <td data-e="" className="text-right">{e.estado === 'pendiente' ? (
                    <form action={cambiarEstado}>
                      <input type="hidden" name="id" value={e.id} /><input type="hidden" name="estado" value="completado" />
                      <input type="hidden" name="destino" value={`/admin/agenda/?vista=${v}`} />
                      <button className="btn btn-secundario" style={{ minHeight: 32 }}>Completada</button>
                    </form>
                  ) : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
