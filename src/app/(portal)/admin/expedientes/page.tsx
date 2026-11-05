import type { Metadata } from 'next';
import Link from 'next/link';
import { comoUsuario } from '@/portal/lib/db';
import { requerirPersonal } from '@/portal/lib/sesion';
import { fecha } from '@/portal/lib/textos';

export const metadata: Metadata = { title: 'Expedientes' };

type Fila = { sid: string; referencia: string; titulo: string; estado: 'activo' | 'cerrado'; abierto_at: Date; cerrado_at: Date | null;
  cliente_id: string; cliente: string; empresa: string | null; asunto: string | null; responsable: string | null; docs: number; borradores: number;
  proxima: Date | null; ultimo: Date | null };

const ESTADOS: Record<string, { t: string; sql: string }> = {
  abiertos: { t: 'Abiertos', sql: `e.estado = 'activo'` }, cerrados: { t: 'Cerrados', sql: `e.estado = 'cerrado'` }, todos: { t: 'Todos', sql: 'true' },
};
const AGRUPAR: Record<string, string> = { cliente: 'Por cliente', asunto: 'Por tipo de asunto', no: 'Sin agrupar' };

/** Expedientes del despacho (los que esa persona puede ver por asignación), abiertos o cerrados, agrupados. */
export default async function Expedientes({ searchParams }: { searchParams: Promise<{ estado?: string; agrupar?: string; q?: string }> }) {
  const u = await requerirPersonal();
  const p = await searchParams;
  const estado = p.estado && ESTADOS[p.estado] ? p.estado : 'abiertos';
  const agrupar = p.agrupar && AGRUPAR[p.agrupar] ? p.agrupar : 'cliente';
  const q = (p.q ?? '').trim().slice(0, 100);
  const { filas, cuentas } = await comoUsuario(u.id, async (tx) => {
    const filas = (await tx.query(`
      select s.id sid, e.referencia, e.titulo, e.estado::text estado, e.abierto_at, e.cerrado_at, e.cliente_id, us.name cliente, pf.empresa,
        t.nombre asunto, p.nombre_visible responsable,
        (select count(*) from portal.documentos d where d.solicitud_id = s.id)::int docs,
        (select count(*) from portal.escritos w where w.solicitud_id = s.id)::int borradores,
        (select min(a.inicio) from portal.agenda_eventos a where a.solicitud_id = s.id and a.estado = 'pendiente' and a.inicio >= now()) proxima,
        greatest((select max(happened_at) from portal.eventos v where v.solicitud_id = s.id), (select max(created_at) from portal.notas_internas n where n.solicitud_id = s.id)) ultimo
      from portal.expedientes e join portal.solicitudes s on s.id = e.solicitud_id join identidad."user" us on us.id = e.cliente_id
      left join portal.perfiles pf on pf.user_id = e.cliente_id left join portal.tipos_asunto t on t.id = coalesce(e.tipo_asunto_id, s.tipo_asunto_id)
      left join portal.personal p on p.user_id = e.responsable_id
      where portal.personal_ve(s.id) and ${ESTADOS[estado]!.sql}
        and ($1 = '' or e.titulo ilike '%' || $1 || '%' or us.name ilike '%' || $1 || '%' or e.referencia ilike '%' || $1 || '%' or coalesce(pf.empresa, '') ilike '%' || $1 || '%')
      order by ${agrupar === 'cliente' ? 'us.name, ' : agrupar === 'asunto' ? 't.nombre nulls last, ' : ''}coalesce(e.cerrado_at, e.abierto_at) desc
      limit 500`, [q])).rows as Fila[];
    const cuentas = (await tx.query(`select count(*) filter (where e.estado = 'activo')::int abiertos, count(*) filter (where e.estado = 'cerrado')::int cerrados
      from portal.expedientes e where portal.personal_ve(e.solicitud_id)`)).rows[0] as { abiertos: number; cerrados: number };
    return { filas, cuentas };
  });

  const grupos = new Map<string, { titulo: string; enlace?: string; filas: Fila[] }>();
  for (const f of filas) {
    const k = agrupar === 'cliente' ? f.cliente_id : agrupar === 'asunto' ? f.asunto ?? '—' : 'todos';
    const titulo = agrupar === 'cliente' ? `${f.cliente}${f.empresa ? ` · ${f.empresa}` : ''}` : agrupar === 'asunto' ? f.asunto ?? 'Sin tipo de asunto' : '';
    if (!grupos.has(k)) grupos.set(k, { titulo, enlace: agrupar === 'cliente' ? `/admin/clientes/${f.cliente_id}/` : undefined, filas: [] });
    grupos.get(k)!.filas.push(f);
  }
  const enlace = (c: Partial<{ estado: string; agrupar: string }>) => {
    const s = new URLSearchParams({ estado: c.estado ?? estado, agrupar: c.agrupar ?? agrupar, ...(q ? { q } : {}) });
    return `?${s.toString()}`;
  };

  return (
    <div className="grid gap-4">
      <div className="fila"><h1 className="titulo">Expedientes</h1><span className="flex gap-2"><Link href="/admin/expedientes/nuevo/" className="btn btn-primario">+ Abrir expediente</Link><Link href="/admin/clientes/nuevo/" className="btn btn-secundario">+ Nuevo cliente</Link></span></div>
      <nav className="flex flex-wrap gap-2 items-center" aria-label="Filtrar expedientes">
        {Object.entries(ESTADOS).map(([k, v]) => (
          <Link key={k} href={enlace({ estado: k })} aria-current={k === estado ? 'page' : undefined} className={`chip ${k === estado ? 'chip-info' : 'chip-neutro'} no-underline`}>
            {v.t}{k === 'abiertos' ? ` (${cuentas.abiertos})` : k === 'cerrados' ? ` (${cuentas.cerrados})` : ` (${cuentas.abiertos + cuentas.cerrados})`}
          </Link>
        ))}
        <span className="ayuda text-sm ml-2">Agrupar:</span>
        {Object.entries(AGRUPAR).map(([k, v]) => (
          <Link key={k} href={enlace({ agrupar: k })} aria-current={k === agrupar ? 'page' : undefined} className={`chip ${k === agrupar ? 'chip-info' : 'chip-neutro'} no-underline`}>{v}</Link>
        ))}
        <form className="ml-auto flex gap-2" role="search">
          <input type="hidden" name="estado" value={estado} /><input type="hidden" name="agrupar" value={agrupar} />
          <input name="q" type="search" defaultValue={q} placeholder="Cliente, asunto o referencia" aria-label="Buscar expedientes" className="border rounded-md p-2" />
        </form>
      </nav>
      {filas.length === 0 ? <p className="ayuda" data-sin-expedientes>No hay expedientes {estado === 'cerrados' ? 'cerrados' : estado === 'abiertos' ? 'abiertos' : ''}{q ? ` que coincidan con «${q}»` : ''}.</p> : null}
      {[...grupos.values()].map((g, i) => (
        <section key={i} className="card overflow-x-auto" data-grupo={g.titulo || 'todos'}>
          {g.titulo ? <h2 className="subtitulo" style={{ marginBottom: 8 }}>{g.enlace ? <Link href={g.enlace}>{g.titulo}</Link> : g.titulo} <span className="ayuda text-sm">· {g.filas.length}</span></h2> : null}
          <table className="tabla">
            <thead><tr><th>Expediente</th>{agrupar !== 'cliente' ? <th>Cliente</th> : null}{agrupar !== 'asunto' ? <th>Asunto</th> : null}<th>Responsable</th><th>Estado</th><th>Próxima fecha</th><th>Docs</th><th>Último movimiento</th></tr></thead>
            <tbody>
              {g.filas.map((f) => (
                <tr key={f.sid} data-expediente={f.titulo}>
                  <td><Link href={`/admin/expedientes/${f.sid}/`} className="font-semibold">{f.titulo}</Link><span className="ayuda block text-xs">{f.referencia}</span></td>
                  {agrupar !== 'cliente' ? <td><Link href={`/admin/clientes/${f.cliente_id}/`}>{f.cliente}</Link></td> : null}
                  {agrupar !== 'asunto' ? <td>{f.asunto ?? <span className="ayuda">—</span>}</td> : null}
                  <td>{f.responsable ?? <span className="ayuda">sin asignar</span>}</td>
                  <td>{f.estado === 'activo' ? <span className="chip chip-ok">Abierto</span> : <span className="chip chip-neutro" title={f.cerrado_at ? `Cerrado el ${fecha(f.cerrado_at)}` : undefined}>Cerrado{f.cerrado_at ? ` · ${fecha(f.cerrado_at)}` : ''}</span>}</td>
                  <td className="text-sm">{f.proxima ? fecha(f.proxima) : '—'}</td>
                  <td>{f.docs}{f.borradores ? <span className="ayuda text-xs"> · ✍️ {f.borradores}</span> : null}</td>
                  <td className="text-sm">{fecha(f.ultimo ?? f.abierto_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
