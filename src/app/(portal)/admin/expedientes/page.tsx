import type { Metadata } from 'next';
import Link from 'next/link';
import { Cabecera, enlaceCon, FiltroSelector, Filtros, FiltroTexto, Paginacion, Resultados, textoOpcion, Vacio, Vistas } from '@/portal/components/despacho';
import { comoUsuario } from '@/portal/lib/db';
import { requerirPersonal } from '@/portal/lib/sesion';
import { fecha } from '@/portal/lib/textos';

export const metadata: Metadata = { title: 'Expedientes' };

type Fila = { sid: string; referencia: string; titulo: string; estado: 'activo' | 'cerrado'; abierto_at: Date; cerrado_at: Date | null;
  cliente_id: string; cliente: string; empresa: string | null; asunto: string | null; responsable: string | null; docs: number; borradores: number;
  proxima: Date | null; ultimo: Date | null };

const POR_PAGINA = 50;
const ESTADOS: Record<string, { t: string; sql: string }> = {
  abiertos: { t: 'Abiertos', sql: `e.estado = 'activo'` }, cerrados: { t: 'Cerrados', sql: `e.estado = 'cerrado'` }, todos: { t: 'Todos', sql: 'true' },
};
const AGRUPAR: [string, string][] = [['cliente', 'Por cliente'], ['asunto', 'Por tipo de asunto'], ['no', 'Sin agrupar']];
const PROXIMA: [string, string][] = [['', 'Cualquiera'], ['7', 'En los próximos 7 días'], ['30', 'En los próximos 30 días'], ['sin', 'Sin fecha próxima']];
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Expedientes del despacho (los que esa persona puede ver por asignación), abiertos o cerrados, agrupados y filtrados. */
export default async function Expedientes({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const u = await requerirPersonal();
  const p = await searchParams;
  const estado = p.estado && ESTADOS[p.estado] ? p.estado : 'abiertos';
  const agrupar = AGRUPAR.some(([k]) => k === p.agrupar) ? p.agrupar! : 'cliente';
  const q = (p.q ?? '').trim().slice(0, 100);
  const tipo = (p.tipo ?? '').slice(0, 80), responsable = (p.responsable ?? '').slice(0, 80);
  const proxima = PROXIMA.some(([k]) => k === p.proxima) ? p.proxima! : '';
  const desde = FECHA.test(p.desde ?? '') ? p.desde! : '', hasta = FECHA.test(p.hasta ?? '') ? p.hasta! : '';
  const pagina = Math.max(1, Number(p.pagina) || 1);
  const { filas, cuentas, total, tipos, personas } = await comoUsuario(u.id, async (tx) => {
    const desde_ = `from portal.expedientes e join portal.solicitudes s on s.id = e.solicitud_id join identidad."user" us on us.id = e.cliente_id
      left join portal.perfiles pf on pf.user_id = e.cliente_id left join portal.tipos_asunto t on t.id = coalesce(e.tipo_asunto_id, s.tipo_asunto_id)
      left join portal.personal p on p.user_id = e.responsable_id`;
    const proximaSql = `(select min(a.inicio) from portal.agenda_eventos a where a.solicitud_id = s.id and a.estado = 'pendiente' and a.inicio >= now())`;
    const donde = `portal.personal_ve(s.id) and ${ESTADOS[estado]!.sql}
      and ($1 = '' or e.titulo ilike '%' || $1 || '%' or us.name ilike '%' || $1 || '%' or e.referencia ilike '%' || $1 || '%' or coalesce(pf.empresa, '') ilike '%' || $1 || '%')
      and ($2 = '' or t.id = $2) and ($3 = '' or p.user_id::text = $3)
      and ($4::text = '' or e.abierto_at >= nullif($4::text, '')::date) and ($5::text = '' or e.abierto_at < nullif($5::text, '')::date + 1)
      ${proxima === 'sin' ? `and ${proximaSql} is null` : proxima ? `and ${proximaSql} < now() + interval '${proxima === '7' ? 7 : 30} days'` : ''}`;
    const params = [q, tipo, responsable, desde, hasta];
    const total = (await tx.query(`select count(*)::int n ${desde_} where ${donde}`, params)).rows[0].n as number;
    const filas = (await tx.query(`
      select s.id sid, e.referencia, e.titulo, e.estado::text estado, e.abierto_at, e.cerrado_at, e.cliente_id, us.name cliente, pf.empresa,
        t.nombre asunto, p.nombre_visible responsable,
        (select count(*) from portal.documentos d where d.solicitud_id = s.id)::int docs,
        (select count(*) from portal.escritos w where w.solicitud_id = s.id)::int borradores,
        ${proximaSql} proxima,
        greatest((select max(happened_at) from portal.eventos v where v.solicitud_id = s.id), (select max(created_at) from portal.notas_internas n where n.solicitud_id = s.id)) ultimo
      ${desde_} where ${donde}
      order by ${agrupar === 'cliente' ? 'us.name, ' : agrupar === 'asunto' ? 't.nombre nulls last, ' : ''}coalesce(e.cerrado_at, e.abierto_at) desc
      limit ${POR_PAGINA} offset ${(pagina - 1) * POR_PAGINA}`, params)).rows as Fila[];
    const cuentas = (await tx.query(`select count(*) filter (where e.estado = 'activo')::int abiertos, count(*) filter (where e.estado = 'cerrado')::int cerrados
      from portal.expedientes e where portal.personal_ve(e.solicitud_id)`)).rows[0] as { abiertos: number; cerrados: number };
    const tipos = (await tx.query(`select id, nombre from portal.tipos_asunto order by orden`)).rows as { id: string; nombre: string }[];
    const personas = (await tx.query(`select user_id::text id, nombre_visible nombre from portal.personal where activo order by nombre_visible`)).rows as { id: string; nombre: string }[];
    return { filas, cuentas, total, tipos, personas };
  });

  const grupos = new Map<string, { titulo: string; enlace?: string; filas: Fila[] }>();
  for (const f of filas) {
    const k = agrupar === 'cliente' ? f.cliente_id : agrupar === 'asunto' ? f.asunto ?? '—' : 'todos';
    const titulo = agrupar === 'cliente' ? `${f.cliente}${f.empresa ? ` · ${f.empresa}` : ''}` : agrupar === 'asunto' ? f.asunto ?? 'Sin tipo de asunto' : '';
    if (!grupos.has(k)) grupos.set(k, { titulo, enlace: agrupar === 'cliente' ? `/admin/clientes/${f.cliente_id}/` : undefined, filas: [] });
    grupos.get(k)!.filas.push(f);
  }
  const BASE = '/admin/expedientes/';
  const actuales = { estado: estado === 'abiertos' ? undefined : estado, agrupar: agrupar === 'cliente' ? undefined : agrupar, q: q || undefined, tipo: tipo || undefined, responsable: responsable || undefined, proxima: proxima || undefined, desde: desde || undefined, hasta: hasta || undefined };
  const enlace = (c: Record<string, string | undefined>) => enlaceCon(BASE, actuales, c);
  const opcionesTipo: [string, string][] = [['', 'Todos'], ...tipos.map((t): [string, string] => [t.id, t.nombre])];
  const opcionesResp: [string, string][] = [['', 'Cualquiera'], ...personas.map((x): [string, string] => [x.id, x.nombre])];
  const activos = [
    q ? { texto: `Buscar: ${q}`, href: enlace({ q: undefined }) } : null,
    tipo ? { texto: `Tipo: ${textoOpcion(opcionesTipo, tipo)}`, href: enlace({ tipo: undefined }) } : null,
    responsable ? { texto: `Responsable: ${textoOpcion(opcionesResp, responsable)}`, href: enlace({ responsable: undefined }) } : null,
    proxima ? { texto: `Próxima fecha: ${textoOpcion(PROXIMA, proxima)}`, href: enlace({ proxima: undefined }) } : null,
    desde ? { texto: `Abierto desde ${desde.split('-').reverse().join('/')}`, href: enlace({ desde: undefined }) } : null,
    hasta ? { texto: `Abierto hasta ${hasta.split('-').reverse().join('/')}`, href: enlace({ hasta: undefined }) } : null,
  ].filter((x): x is { texto: string; href: string } => !!x);
  const columnas = 7 - (agrupar === 'cliente' || agrupar === 'asunto' ? 1 : 0) + 1;

  return (
    <div className="grid gap-4">
      <Cabecera titulo="Expedientes" entradilla="Encuentra un asunto, comprueba su situación y entra a trabajar en él."
        acciones={<><Link href="/admin/clientes/nuevo/" className="btn btn-secundario">+ Nuevo cliente</Link><Link href="/admin/expedientes/nuevo/" className="btn btn-primario">+ Abrir expediente</Link></>} />
      <Vistas etiqueta="Filtrar expedientes" items={Object.entries(ESTADOS).map(([k, v]) => ({
        texto: v.t, href: enlace({ estado: k === 'abiertos' ? undefined : k }), activo: k === estado,
        n: k === 'abiertos' ? cuentas.abiertos : k === 'cerrados' ? cuentas.cerrados : cuentas.abiertos + cuentas.cerrados,
      }))} />
      <Filtros accion={BASE} etiqueta="Buscar y filtrar expedientes" columnas={5} limpiar={enlaceCon(BASE, { estado: actuales.estado, agrupar: actuales.agrupar })} activos={activos}
        ocultos={{ estado: actuales.estado }} nAvanzados={(desde ? 1 : 0) + (hasta ? 1 : 0)}
        basicos={<>
          <FiltroTexto nombre="q" etiqueta="Buscar expedientes" valor={q} ayuda="Cliente, asunto o referencia" />
          <FiltroSelector nombre="tipo" etiqueta="Tipo de asunto" valor={tipo} opciones={opcionesTipo} />
          <FiltroSelector nombre="responsable" etiqueta="Responsable" valor={responsable} opciones={opcionesResp} />
          <FiltroSelector nombre="proxima" etiqueta="Próxima fecha" valor={proxima} opciones={PROXIMA} />
          <FiltroSelector nombre="agrupar" etiqueta="Agrupar" valor={agrupar} opciones={AGRUPAR} />
        </>}
        avanzados={<>
          <FiltroTexto nombre="desde" etiqueta="Abierto desde" tipo="date" valor={desde} />
          <FiltroTexto nombre="hasta" etiqueta="Abierto hasta" tipo="date" valor={hasta} />
        </>} />
      <Resultados total={total} pagina={pagina} paginas={Math.max(1, Math.ceil(total / POR_PAGINA))} nombre={['expediente', 'expedientes']} />
      {filas.length === 0 ? (
        <div data-sin-expedientes><Vacio titulo={`No hay expedientes ${estado === 'cerrados' ? 'cerrados' : estado === 'abiertos' ? 'abiertos' : ''}${q ? ` que coincidan con «${q}»` : ''}`}>
          {activos.length ? 'Prueba a quitar algún filtro.' : 'Cuando aceptes una solicitud o abras un expediente aparecerá aquí.'}
        </Vacio></div>
      ) : (
        <div className="tabla-marco">
          <table className="tabla tabla-apilada">
            <caption className="sr-only">Expedientes</caption>
            <thead><tr><th>Expediente</th>{agrupar !== 'cliente' ? <th>Cliente</th> : null}{agrupar !== 'asunto' ? <th>Asunto</th> : null}<th>Responsable</th><th>Estado</th><th>Próxima fecha</th><th>Docs</th><th>Último movimiento</th></tr></thead>
            {[...grupos.values()].map((g, i) => (
              <tbody key={i} data-grupo={g.titulo || 'todos'}>
                {g.titulo ? <tr className="fila-grupo"><th colSpan={columnas} scope="rowgroup">{g.enlace ? <Link href={g.enlace}>{g.titulo}</Link> : g.titulo} <span className="ayuda font-normal">· {g.filas.length}</span></th></tr> : null}
                {g.filas.map((f) => (
                  <tr key={f.sid} data-expediente={f.titulo}>
                    <td data-e="Expediente"><Link href={`/admin/expedientes/${f.sid}/`}>{f.titulo}</Link><span className="ref">{f.referencia}</span></td>
                    {agrupar !== 'cliente' ? <td data-e="Cliente"><Link href={`/admin/clientes/${f.cliente_id}/`}>{f.cliente}</Link></td> : null}
                    {agrupar !== 'asunto' ? <td data-e="Asunto">{f.asunto ?? <span className="ayuda">—</span>}</td> : null}
                    <td data-e="Responsable">{f.responsable ?? <span className="ayuda">Sin asignar</span>}</td>
                    <td data-e="Estado">{f.estado === 'activo' ? <span className="chip chip-ok">Abierto</span> : <span className="chip chip-neutro" title={f.cerrado_at ? `Cerrado el ${fecha(f.cerrado_at)}` : undefined}>Cerrado{f.cerrado_at ? ` · ${fecha(f.cerrado_at)}` : ''}</span>}</td>
                    <td data-e="Próxima fecha" className="text-sm whitespace-nowrap">{f.proxima ? fecha(f.proxima) : '—'}</td>
                    <td data-e="Documentos" className="whitespace-nowrap">{f.docs}{f.borradores ? <span className="ayuda text-xs"> · {f.borradores} {f.borradores === 1 ? 'escrito' : 'escritos'}</span> : null}</td>
                    <td data-e="Último movimiento" className="text-sm whitespace-nowrap">{fecha(f.ultimo ?? f.abierto_at)}</td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      )}
      <Paginacion pagina={pagina} paginas={Math.max(1, Math.ceil(total / POR_PAGINA))} href={(n) => enlace({ pagina: n > 1 ? String(n) : undefined })} />
    </div>
  );
}
