import type { Metadata } from 'next';
import Link from 'next/link';
import { ChipSolicitud } from '@/components/ui';
import { comoUsuario } from '@/lib/db';
import { requerirPersonal } from '@/lib/sesion';
import { fecha } from '@/lib/textos';

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
  const { filas, cuentas } = await comoUsuario(u.id, async (tx) => {
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
    return { filas, cuentas };
  });
  return (
    <div className="grid gap-5">
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
                  <td><Link href={`/despacho/solicitudes/${s.id}/`} className="font-semibold">{s.expediente_ref ?? s.referencia}</Link>{s.urgencia === 'urgente' ? <> <span className="chip chip-aviso">Urgente</span></> : null}</td>
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
