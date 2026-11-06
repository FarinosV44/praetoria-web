import type { Metadata } from 'next';
import Link from 'next/link';
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
  return (
    <div className="grid gap-5">
      <section className="grid gap-3">
        <form action="/admin/buscar/" className="flex gap-2">
          <input name="q" type="search" placeholder="Buscar cliente, NIF, referencia, asunto o documento" aria-label="Buscar" className="border rounded-md p-3 flex-1 min-w-0" />
          <button className="btn btn-primario">Buscar</button>
          <Link href="/admin/clientes/nuevo/" className="btn btn-secundario">+ Cliente</Link>
        </form>
        {rec.length ? (
          <div className="flex flex-wrap gap-2" aria-label="Expedientes recientes">
            {rec.map((r) => <Link key={r.id} href={`/admin/expedientes/${r.id}/`} className="chip chip-neutro no-underline">{r.cliente} · {r.titulo}</Link>)}
          </div>
        ) : null}
      </section>
      <section className="panel-resumen" aria-label="Resumen del despacho">
        <div><span className="panel-cifra">{cuentas.expedientes}</span><span className="ayuda">expedientes abiertos</span></div>
        <div data-aviso={panel.vencidos.length ? 'si' : undefined}><span className="panel-cifra">{panel.vencidos.length}</span><span className="ayuda">plazos vencidos</span></div>
        <div><span className="panel-cifra">{panel.sinVerificar.length}</span><span className="ayuda">plazos sin verificar</span></div>
        <div><span className="panel-cifra">{cuentas.faltan}</span><span className="ayuda">con documentación pendiente</span></div>
      </section>
      {panel.vencidos.length ? (
        <section className="aviso" aria-label="Plazos vencidos" data-alerta="vencidos">
          <strong>Plazos vencidos sin completar</strong>
          <ul className="text-sm mt-1">{panel.vencidos.map((p) => <li key={p.id}><Link href={`/admin/expedientes/${p.sid}/?vista=plazos`}>{p.titulo}</Link> · {fecha(p.inicio)}<span className="ayuda"> · {p.asunto}</span></li>)}</ul>
        </section>
      ) : null}
      <MiTrabajo d={trabajo} />
      <section className="grid md:grid-cols-3 gap-3" aria-label="Escritos e inteligencia artificial">
        <div className="card" data-bloque="plazos-sin-verificar">
          <h3 className="font-semibold mb-2">Plazos por verificar</h3>
          {panel.sinVerificar.length ? <ul className="grid gap-1 text-sm">{panel.sinVerificar.map((p) => <li key={p.id}><Link href={`/admin/expedientes/${p.sid}/?vista=plazos`}>{p.titulo}</Link> · {fecha(p.inicio)}<span className="ayuda"> · {p.asunto}</span></li>)}</ul> : <p className="ayuda text-sm">Ningún plazo pendiente de verificar.</p>}
          {panel.propuestas ? <p className="text-sm mt-2"><strong>{panel.propuestas}</strong> propuesta{panel.propuestas > 1 ? 's' : ''} de la IA por revisar en los expedientes.</p> : null}
        </div>
        <div className="card" data-bloque="borradores">
          <h3 className="font-semibold mb-2">Borradores recientes</h3>
          {panel.borradores.length ? <ul className="grid gap-1 text-sm">{panel.borradores.map((b) => <li key={b.id}><Link href={`/admin/expedientes/${b.sid}/escritos/${b.id}/`}>{b.titulo}</Link> · v{b.version}<span className="ayuda"> · {b.asunto}</span></li>)}</ul> : <p className="ayuda text-sm">Aún no hay borradores. <Link href="/admin/ia/nuevo/">Crear un escrito</Link></p>}
        </div>
        <div className="card" data-bloque="actividad-ia">
          <h3 className="font-semibold mb-2">Actividad de la IA</h3>
          {panel.actividad.length ? <ul className="grid gap-1 text-sm">{panel.actividad.map((a) => <li key={a.id}>{a.sid ? <Link href={`/admin/expedientes/${a.sid}/asistente/`}>{a.texto}</Link> : a.texto}<span className="ayuda"> · {a.estado === 'error' ? 'con error' : a.estado === 'en_curso' ? 'en curso' : fecha(a.at)}</span></li>)}</ul> : <p className="ayuda text-sm">Sin actividad reciente.</p>}
          {panel.errores ? <p className="text-sm mt-2">⚠️ {panel.errores} documento{panel.errores > 1 ? 's' : ''} sin indexar por error.</p> : null}
        </div>
      </section>
      <h1 className="titulo">Bandeja</h1>
      <nav aria-label="Vistas" className="flex flex-wrap gap-2">
        {Object.entries(vistas).map(([k, d]) => (
          <Link key={k} href={`?vista=${k}`} className={`chip ${k === v ? 'chip-info' : 'chip-neutro'} no-underline`} aria-current={k === v ? 'page' : undefined}>
            {d.titulo} ({cuentas[k]})
          </Link>
        ))}
      </nav>
      <section className="card overflow-x-auto">
        <h2 className="subtitulo">{vista.titulo}</h2>
        {filas.length === 0 ? <p className="ayuda">No hay nada en esta vista.</p> : (
          <table className="tabla">
            <thead><tr><th>Referencia</th><th>Cliente</th><th>Asunto</th><th>Estado</th><th>Documentos</th><th>Responsable</th><th>Enviada</th></tr></thead>
            <tbody>
              {filas.map((s) => (
                <tr key={s.id}>
                  <td><Link href={`/admin/expedientes/${s.id}/`} className="font-semibold">{s.expediente_ref ?? s.referencia}</Link>{s.urgencia === 'urgente' ? <> <span className="chip chip-aviso">Urgente</span></> : null}</td>
                  <td>{s.cliente_nombre}<br /><span className="ayuda">{s.cliente_email}</span></td>
                  <td>{s.tipo_nombre}</td>
                  <td><ChipSolicitud estado={s.estado} /></td>
                  <td className="text-sm">{s.por_revisar} por revisar · {s.pendientes_oblig} faltan · {s.subsanar} a subsanar</td>
                  <td>{s.responsable ?? <span className="ayuda">Sin asignar</span>}</td>
                  <td className="text-sm">{s.enviada_at ? fecha(s.enviada_at) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
