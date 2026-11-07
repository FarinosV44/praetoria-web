import type { Metadata } from 'next';
import Link from 'next/link';
import { Cabecera, enlaceCon, FiltroSelector, Filtros, FiltroTexto, Paginacion, Resultados, textoOpcion, Vacio, Vistas } from '@/portal/components/despacho';
import { comoUsuario } from '@/portal/lib/db';
import { requerirPersonal } from '@/portal/lib/sesion';
import { fecha } from '@/portal/lib/textos';

export const metadata: Metadata = { title: 'Clientes' };

const POR_PAGINA = 50;
const TIPOS: [string, string][] = [['', 'Todos'], ['particular', 'Particular'], ['empresa', 'Empresa'], ['sin', 'Perfil sin completar']];
const VERIFICADO: [string, string][] = [['', 'Indiferente'], ['si', 'Correo verificado'], ['no', 'Sin verificar']];
const VISTAS: Record<string, { t: string; w: string }> = {
  todos: { t: 'Todos', w: 'true' },
  expediente: { t: 'Con expediente', w: 'exists (select 1 from portal.expedientes e where e.cliente_id = us.id)' },
  solicitud: { t: 'Solo solicitudes', w: `exists (select 1 from portal.solicitudes s where s.cliente_id = us.id and s.estado <> 'borrador') and not exists (select 1 from portal.expedientes e where e.cliente_id = us.id)` },
  sin: { t: 'Sin actividad', w: `not exists (select 1 from portal.solicitudes s where s.cliente_id = us.id and s.estado <> 'borrador')` },
};

export default async function Clientes({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const u = await requerirPersonal();
  const p = await searchParams;
  const q = (p.q ?? '').trim().slice(0, 100);
  const tipo = TIPOS.some(([k]) => k === p.tipo) ? p.tipo! : '';
  const verificado = VERIFICADO.some(([k]) => k === p.verificado) ? p.verificado! : '';
  const vista = p.vista && VISTAS[p.vista] ? p.vista : 'todos';
  const pagina = Math.max(1, Number(p.pagina) || 1);
  const { filas, total } = await comoUsuario(u.id, async (tx) => {
    const desde = `from identidad."user" us left join portal.perfiles pf on pf.user_id = us.id
      where not exists (select 1 from portal.personal p where p.user_id = us.id) and ${VISTAS[vista]!.w}
        and ($1 = '' or us.name ilike '%' || $1 || '%' or us.email ilike '%' || $1 || '%' or coalesce(pf.empresa, '') ilike '%' || $1 || '%')
        ${tipo === 'sin' ? 'and pf.tipo is null' : tipo ? `and pf.tipo = '${tipo}'` : ''}
        ${verificado === 'si' ? 'and us."emailVerified"' : verificado === 'no' ? 'and not us."emailVerified"' : ''}`;
    const total = (await tx.query(`select count(*)::int n ${desde}`, [q])).rows[0].n as number;
    const filas = (await tx.query(`
      select us.id, us.name, us.email, us."emailVerified" verificado, us."createdAt" alta, pf.tipo, pf.empresa,
        (select count(*) from portal.solicitudes s where s.cliente_id = us.id and s.estado <> 'borrador')::int solicitudes,
        (select count(*) from portal.expedientes e where e.cliente_id = us.id)::int expedientes
      ${desde} order by us."createdAt" desc limit ${POR_PAGINA} offset ${(pagina - 1) * POR_PAGINA}`, [q])).rows;
    return { filas, total };
  });
  const BASE = '/admin/clientes/';
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const actuales = { q: q || undefined, tipo: tipo || undefined, verificado: verificado || undefined, vista: vista === 'todos' ? undefined : vista };
  const enlace = (c: Record<string, string | undefined>) => enlaceCon(BASE, actuales, c);
  const activos = [
    q ? { texto: `Buscar: ${q}`, href: enlace({ q: undefined }) } : null,
    tipo ? { texto: `Tipo: ${textoOpcion(TIPOS, tipo)}`, href: enlace({ tipo: undefined }) } : null,
    verificado ? { texto: textoOpcion(VERIFICADO, verificado), href: enlace({ verificado: undefined }) } : null,
  ].filter((x): x is { texto: string; href: string } => !!x);
  return (
    <div className="grid gap-4">
      <Cabecera titulo="Clientes registrados" entradilla="Registrarse no supone una relación profesional: solo las solicitudes aceptadas abren expediente."
        acciones={<Link href="/admin/clientes/nuevo/" className="btn btn-primario">+ Nuevo cliente</Link>} />
      <Vistas etiqueta="Vistas de clientes" visible="Vistas rápidas" items={Object.entries(VISTAS).map(([k, v]) => ({ texto: v.t, href: enlace({ vista: k === 'todos' ? undefined : k }), activo: k === vista }))} />
      <Filtros accion={BASE} etiqueta="Buscar y filtrar clientes" columnas={4} ocultos={{ vista: actuales.vista }} activos={activos} limpiar={enlaceCon(BASE, { vista: actuales.vista })}
        basicos={<>
          <FiltroTexto nombre="q" etiqueta="Buscar clientes" valor={q} ayuda="Nombre, correo o empresa" ancho />
          <FiltroSelector nombre="tipo" etiqueta="Tipo" valor={tipo} opciones={TIPOS} />
          <FiltroSelector nombre="verificado" etiqueta="Correo" valor={verificado} opciones={VERIFICADO} />
        </>} />
      <Resultados total={total} pagina={pagina} paginas={paginas} nombre={['cliente', 'clientes']} />
      {filas.length === 0 ? <Vacio titulo="No hay clientes con estos filtros" accion={activos.length || vista !== 'todos' ? <Link href={BASE} className="btn btn-secundario">Ver todos</Link> : <Link href="/admin/clientes/nuevo/" className="btn btn-primario">+ Nuevo cliente</Link>}>{activos.length ? 'Prueba a quitar algún filtro.' : null}</Vacio> : (
        <div className="tabla-marco">
          <table className="tabla tabla-apilada">
            <caption className="sr-only">Clientes registrados</caption>
            <thead><tr><th>Nombre</th><th>Correo</th><th>Tipo</th><th>Alta</th><th className="num">Solicitudes</th><th className="num">Expedientes</th></tr></thead>
            <tbody>
              {filas.map((c) => (
                <tr key={c.id}>
                  <td data-e="Nombre"><Link href={`/admin/clientes/${c.id}/`}>{c.name}</Link></td>
                  <td data-e="Correo">{c.email}{c.verificado ? '' : <> <span className="chip chip-aviso">Sin verificar</span></>}</td>
                  <td data-e="Tipo">{c.tipo === 'empresa' ? `Empresa: ${c.empresa}` : c.tipo ? 'Particular' : <span className="ayuda">Perfil sin completar</span>}</td>
                  <td data-e="Alta" className="text-sm whitespace-nowrap">{fecha(c.alta)}</td>
                  <td data-e="Solicitudes" className="num">{c.solicitudes}</td><td data-e="Expedientes" className="num">{c.expedientes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Paginacion pagina={pagina} paginas={paginas} href={(n) => enlace({ pagina: n > 1 ? String(n) : undefined })} />
    </div>
  );
}
