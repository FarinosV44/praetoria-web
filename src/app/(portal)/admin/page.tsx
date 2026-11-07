import type { Metadata } from 'next';
import Link from 'next/link';
import { Cabecera, Kpi, Panel, RejillaKpi, Vacio, Vistas } from '@/portal/components/despacho';
import { ChipSolicitud } from '@/portal/components/ui';
import { comoUsuario } from '@/portal/lib/db';
import { recientes } from '@/portal/lib/expediente';
import { miTrabajo } from '@/portal/lib/equipo';
import { MiTrabajo } from '@/portal/components/MiTrabajo';
import { panelInicio } from '@/portal/lib/panel';
import { requerirPersonal } from '@/portal/lib/sesion';
import { fecha } from '@/portal/lib/textos';

export const metadata: Metadata = { title: 'Bandeja del despacho' };

const vistas = {
  nuevas: { titulo: 'Solicitudes nuevas', where: `s.estado = 'enviada'` },
  revision: { titulo: 'En revisión', where: `s.estado = 'en_revision'` },
  validar: { titulo: 'Documentos por validar', where: `por_revisar > 0` },
  faltan: { titulo: 'Falta documentación', where: `pendientes_oblig > 0 and s.estado in ('enviada','en_revision','aceptada')` },
  subsanar: { titulo: 'Pendiente de subsanar', where: `subsanar > 0` },
  expedientes: { titulo: 'Expedientes abiertos', where: `s.estado = 'aceptada'` },
} as const;
type Vista = keyof typeof vistas;

export default async function Bandeja({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const u = await requerirPersonal();
  const v = ((await searchParams).vista ?? 'nuevas') as Vista;
  const vista = vistas[v] ?? vistas.nuevas;
  const { filas, cuentas, rec, trabajo, panel } = await comoUsuario(u.id, async (tx) => {
    const base = `with x as (
      select s.*, t.nombre tipo_nombre, us.name cliente_nombre, us.email cliente_email, e.referencia expediente_ref, p.nombre_visible responsable,
        (select count(*) from portal.documentos d where d.solicitud_id = s.id and d.estado = 'pendiente')::int por_revisar,
        (select count(*) from portal.requisitos r where r.solicitud_id = s.id and r.obligatorio and r.estado in ('pendiente','subsanacion'))::int pendientes_oblig,
        (select count(*) from portal.requisitos r where r.solicitud_id = s.id and r.estado = 'subsanacion')::int subsanar
      from portal.solicitudes s join identidad."user" us on us.id = s.cliente_id
      left join portal.tipos_asunto t on t.id = s.tipo_asunto_id left join portal.expedientes e on e.solicitud_id = s.id
      left join portal.personal p on p.user_id = s.responsable_id
      where s.estado <> 'borrador')`;
    const filas = (await tx.query(`${base} select * from x s where ${vista.where} order by s.urgencia = 'urgente' desc, s.enviada_at limit 200`)).rows;
    const cuentas: Record<string, number> = {};
    for (const [k, def] of Object.entries(vistas)) cuentas[k] = (await tx.query(`${base} select count(*)::int n from x s where ${def.where}`)).rows[0].n;
    return { filas, cuentas, rec: await recientes(tx, u.id), trabajo: await miTrabajo(tx, u.id), panel: await panelInicio(tx, u.id) };
  });
  const kpi = (k: Vista) => `?vista=${k}#bandeja`;
  const docs = (s: { por_revisar: number; pendientes_oblig: number; subsanar: number }) => [s.por_revisar ? `${s.por_revisar} por revisar` : '', s.pendientes_oblig ? `${s.pendientes_oblig} faltan` : '', s.subsanar ? `${s.subsanar} a subsanar` : ''].filter(Boolean).join(' · ') || 'Al día';
  return (
    <div className="grid gap-5">
      <Cabecera titulo="Bandeja del despacho" entradilla="Lo que está pendiente hoy: plazos, solicitudes y documentación."
        acciones={<><Link href="/admin/clientes/nuevo/" className="btn btn-secundario">+ Cliente</Link><Link href="/admin/expedientes/nuevo/" className="btn btn-primario">+ Abrir expediente</Link></>} />
      {rec.length ? (
        <nav className="vistas" aria-label="Expedientes recientes">
          <span className="vistas-etiqueta">Recientes</span>
          {rec.map((r) => <Link key={r.id} href={`/admin/expedientes/${r.id}/`} className="vista">{r.cliente} · {r.titulo}</Link>)}
        </nav>
      ) : null}
      <RejillaKpi etiqueta="Resumen del despacho">
        <Kpi etiqueta="Plazos vencidos" valor={panel.vencidos.length} nota={panel.vencidos.length ? 'Requieren atención' : 'Ninguno'} tono={panel.vencidos.length ? 'alerta' : undefined} href="/admin/agenda/?vista=vencidos" />
        <Kpi etiqueta="Plazos sin verificar" valor={panel.sinVerificar.length} nota="Fecha por comprobar" tono={panel.sinVerificar.length ? 'aviso' : undefined} href="/admin/agenda/?vista=verificar" />
        <Kpi etiqueta="Solicitudes nuevas" valor={cuentas.nuevas} nota="Por revisar" href={kpi('nuevas')} />
        <Kpi etiqueta="En revisión" valor={cuentas.revision} nota="Solicitudes en curso" href={kpi('revision')} />
        <Kpi etiqueta="Expedientes abiertos" valor={cuentas.expedientes} nota="En tramitación" href="/admin/expedientes/" />
        <Kpi etiqueta="Documentos por validar" valor={cuentas.validar} nota="Asuntos con archivos nuevos" tono={cuentas.validar ? 'aviso' : undefined} href={kpi('validar')} />
        <Kpi etiqueta="Falta documentación" valor={cuentas.faltan} nota="Obligatoria sin aportar" href={kpi('faltan')} />
        <Kpi etiqueta="Pendiente de subsanar" valor={cuentas.subsanar} nota="Devuelta al cliente" href={kpi('subsanar')} />
      </RejillaKpi>
      {panel.vencidos.length ? (
        <section className="aviso aviso-alerta" aria-label="Plazos vencidos" data-alerta="vencidos">
          <strong>Plazos vencidos sin completar</strong>
          <ul className="text-sm mt-1">{panel.vencidos.map((p) => <li key={p.id}><Link href={`/admin/expedientes/${p.sid}/?vista=plazos`}>{p.titulo}</Link> · {fecha(p.inicio)}<span className="ayuda"> · {p.asunto}</span></li>)}</ul>
        </section>
      ) : null}
      <section id="bandeja" className="grid gap-3" aria-labelledby="bandeja-titulo" style={{ scrollMarginTop: 70 }}>
        <h2 id="bandeja-titulo" className="seccion-titulo">Bandeja</h2>
        <Vistas etiqueta="Vistas" items={Object.entries(vistas).map(([k, d]) => ({ texto: d.titulo, href: `?vista=${k}#bandeja`, activo: k === v, n: cuentas[k] }))} />
        {filas.length === 0 ? <Vacio titulo={`${vista.titulo}: nada pendiente`}>No hay nada en esta vista.</Vacio> : (
          <div className="tabla-marco">
            <table className="tabla tabla-apilada">
              <caption className="sr-only">{vista.titulo}</caption>
              <thead><tr><th>Referencia</th><th>Cliente</th><th>Asunto</th><th>Estado</th><th>Documentos</th><th>Responsable</th><th>Enviada</th></tr></thead>
              <tbody>
                {filas.map((s) => (
                  <tr key={s.id}>
                    <td data-e="Referencia"><Link href={`/admin/expedientes/${s.id}/`}>{s.expediente_ref ?? s.referencia}</Link>{s.urgencia === 'urgente' ? <> <span className="chip chip-peligro">Urgente</span></> : null}</td>
                    <td data-e="Cliente">{s.cliente_nombre}<span className="ref">{s.cliente_email}</span></td>
                    <td data-e="Asunto">{s.tipo_nombre}</td>
                    <td data-e="Estado"><ChipSolicitud estado={s.estado} /></td>
                    <td data-e="Documentos" className="text-sm">{docs(s)}</td>
                    <td data-e="Responsable">{s.responsable ?? <span className="ayuda">Sin asignar</span>}</td>
                    <td data-e="Enviada" className="text-sm whitespace-nowrap">{s.enviada_at ? fecha(s.enviada_at) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <MiTrabajo d={trabajo} />
      <section className="grid gap-3" aria-labelledby="ia-titulo">
        <h2 id="ia-titulo" className="seccion-titulo">Escritos e inteligencia artificial</h2>
        <div className="rejilla-paneles">
          <Panel id="plazos-sin-verificar" titulo="Plazos por verificar" n={panel.sinVerificar.length} vacio="Ningún plazo pendiente de verificar."
            pie={panel.propuestas ? <><strong>{panel.propuestas}</strong> propuesta{panel.propuestas > 1 ? 's' : ''} de la IA por revisar en los expedientes.</> : undefined}>
            {panel.sinVerificar.map((p) => <li key={p.id}><Link href={`/admin/expedientes/${p.sid}/?vista=plazos`}>{p.titulo}</Link> · {fecha(p.inicio)}<span className="linea-2">{p.asunto}</span></li>)}
          </Panel>
          <Panel id="borradores" titulo="Borradores recientes" n={panel.borradores.length} vacio={<>Aún no hay borradores. <Link href="/admin/ia/nuevo/">Crear un escrito</Link></>}>
            {panel.borradores.map((b) => <li key={b.id}><Link href={`/admin/expedientes/${b.sid}/escritos/${b.id}/`}>{b.titulo}</Link> · v{b.version}<span className="linea-2">{b.asunto}</span></li>)}
          </Panel>
          <Panel id="actividad-ia" titulo="Actividad de la IA" n={panel.actividad.length} vacio="Sin actividad reciente."
            pie={panel.errores ? <span className="chip chip-aviso">{panel.errores} documento{panel.errores > 1 ? 's' : ''} sin indexar por error</span> : undefined}>
            {panel.actividad.map((a) => <li key={a.id}>{a.sid ? <Link href={`/admin/expedientes/${a.sid}/asistente/`}>{a.texto}</Link> : a.texto}<span className="linea-2">{a.estado === 'error' ? 'Con error' : a.estado === 'en_curso' ? 'En curso' : fecha(a.at)}</span></li>)}
          </Panel>
        </div>
      </section>
    </div>
  );
}
