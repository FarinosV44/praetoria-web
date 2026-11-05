import type { Metadata } from 'next';
import Link from 'next/link';
import { Importar } from '@/seguros/components/importar';
import { iaConfigurada } from '@/seguros/lib/ia/proveedor';
import { exigirUsuario } from '@/seguros/lib/auth/servidor';
import { panel, type Filtros as TFiltros, type FilaPanel } from '@/seguros/lib/datos/panel';
import { listarTitulares } from '@/seguros/lib/datos/titulares';
import { deCentimos, formatoImporte, textoPeriodicidad } from '@/seguros/lib/dinero';
import { fechaMedia } from '@/seguros/lib/fechas';
import { IconoRamo, IconoMas } from '@/seguros/components/iconos';
import { Dias, Estado, Revisar } from '@/seguros/components/estado';

export const metadata: Metadata = { title: 'Pólizas' };

type Busqueda = Record<string, string | undefined>;

const ESTADOS: { valor: NonNullable<TFiltros['estado']>; texto: string }[] = [
  { valor: 'todos', texto: 'Activas' },
  { valor: 'proximas', texto: 'Vencen este mes' },
  { valor: 'vencidas', texto: 'Vencidas' },
  { valor: 'sin_fecha', texto: 'Sin fecha confirmada' },
  { valor: 'negociacion', texto: 'En negociación' },
  { valor: 'revisar', texto: 'Por revisar' },
  { valor: 'anuladas', texto: 'Anuladas o sustituidas' },
  { valor: 'archivadas', texto: 'Archivadas' },
];

function leerFiltros(b: Busqueda): TFiltros {
  const v = <T extends string>(x: string | undefined, permitidos: readonly T[]) => (permitidos.includes(x as T) ? (x as T) : undefined);
  return {
    ambito: v(b.ambito, ['todos', 'empresas', 'particulares'] as const),
    titular: b.titular || undefined,
    ramo: b.ramo || undefined,
    aseguradora: b.aseguradora || undefined,
    estado: v(b.estado, ESTADOS.map((e) => e.valor)),
    q: b.q?.slice(0, 100) || undefined,
    orden: v(b.orden, ['vencimiento', 'coste', 'titular'] as const),
  };
}

const conParametros = (b: Busqueda, cambios: Busqueda) => {
  const p = new URLSearchParams();
  for (const [k, val] of Object.entries({ ...b, ...cambios })) if (val) p.set(k, val);
  const s = p.toString();
  return s ? `/admin/seguros/?${s}` : '/admin/seguros/';
};

export default async function Panel({ searchParams }: { searchParams: Promise<Busqueda> }) {
  const u = await exigirUsuario();
  const b = await searchParams;
  const f = leerFiltros(b);
  const [{ filas, resumen, opciones }, titulares] = await Promise.all([panel(u, f), listarTitulares(u)]);
  const volver = encodeURIComponent(conParametros(b, {}));
  const hayFiltros = !!(f.titular || f.ramo || f.aseguradora || (f.estado && f.estado !== 'todos') || f.q || (f.ambito && f.ambito !== 'todos'));
  const totalPrincipal = resumen.totales[0];

  if (titulares.length === 0) {
    return (
      <>
        <div className="encabezado"><div>
          <h1>Sube tus pólizas</h1>
          <p className="secundario pequeno">No hace falta escribir nada: la IA lee cada documento, crea el titular y la póliza con sus fechas, prima y coberturas, y busca en internet el teléfono de siniestros si no figura.</p>
        </div></div>
        {iaConfigurada()
          ? <Importar titulares={[]} />
          : <div className="aviso aviso--atencion" style={{ display: 'block' }}>Lectura automática sin configurar (falta <code>ANTHROPIC_API_KEY</code>). Puedes <Link href="/admin/seguros/titulares/nuevo">crear un titular</Link> y añadir las pólizas a mano.</div>}
      </>
    );
  }

  return (
    <>
      <div className="encabezado">
        <div>
          <h1>Pólizas</h1>
          <p className="secundario pequeno">{filas.length} {filas.length === 1 ? 'póliza' : 'pólizas'}{hayFiltros ? ' con estos filtros' : ''}</p>
        </div>
        <div className="acciones">
          <a className="boton boton--sutil solo-escritorio" href={`/api/seguros/exportar/polizas${f.titular ? `?titular=${f.titular}` : ''}`}>Exportar CSV</a>
          <Link className="boton boton--sutil solo-escritorio" href={`/admin/seguros/polizas/nueva${f.titular ? `?titular=${f.titular}` : ''}`}>Añadir a mano</Link>
          <Link className="boton boton--principal" href="/admin/seguros/importar/"><IconoMas /> Subir pólizas</Link>
        </div>
      </div>

      <section className="resumen" aria-label="Resumen">
        <div className="tarjeta cifra-clave cifra-clave--principal">
          <span className="cifra-clave__etq">Gasto anual activo{hayFiltros ? ' (filtrado)' : ''}</span>
          <span className="cifra-clave__valor">
            {totalPrincipal ? formatoImporte(deCentimos(totalPrincipal.centimos), totalPrincipal.moneda) : '—'}
          </span>
          {resumen.totales.slice(1).map((t) => (
            <span key={t.moneda} className="cifra-clave__nota cifra">+ {formatoImporte(deCentimos(t.centimos), t.moneda)}</span>
          ))}
          <span className="cifra-clave__nota">
            {resumen.conImporte} de {resumen.activas} pólizas con importe
            {resumen.totales.some((t) => t.estimado) ? ' · incluye importes estimados a partir del recibo' : ''}
          </span>
        </div>
        <Link className="tarjeta cifra-clave" href={conParametros(b, { estado: 'proximas' })}>
          <span className="cifra-clave__etq">Vencen este mes</span>
          <span className="cifra-clave__valor">{resumen.proximas}</span>
          <span className="cifra-clave__nota">Para renegociar a tiempo</span>
        </Link>
        <Link className="tarjeta cifra-clave" href={conParametros(b, { estado: resumen.vencidas ? 'vencidas' : 'sin_fecha' })}>
          <span className="cifra-clave__etq">{resumen.vencidas ? 'Vencidas sin renovar' : 'Sin fecha confirmada'}</span>
          <span className="cifra-clave__valor">{resumen.vencidas || resumen.sinFecha}</span>
          <span className="cifra-clave__nota">{resumen.vencidas ? `y ${resumen.sinFecha} sin fecha` : 'Revisa sus documentos'}</span>
        </Link>
        <Link className="tarjeta cifra-clave" href={conParametros(b, { estado: 'revisar' })}>
          <span className="cifra-clave__etq">Por revisar</span>
          <span className="cifra-clave__valor">{resumen.revisar}</span>
          <span className="cifra-clave__nota">Datos sin confirmar</span>
        </Link>
      </section>

      <nav className="segmentos" aria-label="Tipo de titular" style={{ marginBottom: 'var(--e-4)' }}>
        {([['todos', 'Todos'], ['empresas', 'Empresas'], ['particulares', 'Particulares']] as const).map(([v, t]) => (
          <Link key={v} href={conParametros(b, { ambito: v === 'todos' ? undefined : v, titular: undefined })} aria-current={(f.ambito ?? 'todos') === v ? 'true' : undefined}>{t}</Link>
        ))}
      </nav>

      <Filtros f={f} titulares={titulares} opciones={opciones} hayFiltros={hayFiltros} />

      {filas.length === 0 ? (
        <div className="tarjeta vacio">
          <h2>{hayFiltros ? 'No hay pólizas con estos filtros' : 'Todavía no hay pólizas'}</h2>
          <p>{hayFiltros ? 'Prueba a quitar algún filtro.' : 'Añade la primera póliza a mano; después podrás adjuntar sus documentos.'}</p>
          <Link className="boton boton--principal" href="/admin/seguros/polizas/nueva"><IconoMas /> Añadir póliza</Link>
        </div>
      ) : (
        <>
          <div className="tarjeta solo-escritorio">
            <table className="tabla">
              <caption className="sr">Pólizas: titular, tipo de seguro, importe y vencimiento</caption>
              <thead>
                <tr>
                  <th scope="col">Titular y seguro</th>
                  <th scope="col">Aseguradora</th>
                  <th scope="col" className="num">Prima anual</th>
                  <th scope="col" className="num">Recibo</th>
                  <th scope="col">Vencimiento</th>
                  <th scope="col">Situación</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((p) => <FilaTabla key={p.id} p={p} volver={volver} />)}
              </tbody>
            </table>
          </div>
          <ul className="lista-tarjetas" aria-label="Pólizas">
            {filas.map((p) => <TarjetaPoliza key={p.id} p={p} volver={volver} />)}
          </ul>
        </>
      )}
    </>
  );
}

function ImporteAnual({ p }: { p: FilaPanel }) {
  if (!p.coste) return <span className="pendiente">Pendiente</span>;
  return (
    <>
      <span className="importe">{formatoImporte(deCentimos(p.coste.centimos), p.moneda)}</span>
      {p.coste.tipo === 'estimado' && <span className="linea-2" style={{ display: 'block' }}>estimado</span>}
    </>
  );
}

function Recibo({ p }: { p: FilaPanel }) {
  if (!p.periodicidad && !p.importe_recibo) return <span className="pendiente">Pendiente</span>;
  return (
    <>
      {p.importe_recibo && <span className="cifra">{formatoImporte(p.importe_recibo, p.moneda)}</span>}
      <span className="linea-2" style={{ display: 'block' }}>{textoPeriodicidad(p.periodicidad) || 'periodicidad pendiente'}</span>
    </>
  );
}

function FilaTabla({ p, volver }: { p: FilaPanel; volver: string }) {
  return (
    <tr>
      <td>
        <div className="titular-ramo">
          <IconoRamo icono={p.ramo_icono} etiqueta={p.ramo_nombre} />
          <div>
            <span className="linea-2">{p.titular_nombre}</span>
            <Link className="fila-enlace" href={`/admin/seguros/polizas/${p.id}?volver=${volver}`} style={{ display: 'block' }}>{p.nombre}</Link>
            <span className="linea-2">{p.ramo_nombre}{p.riesgo ? ` · ${p.riesgo}` : ''}</span>
          </div>
        </div>
      </td>
      <td>{p.aseguradora}{p.numero && <span className="linea-2" style={{ display: 'block' }}>Nº {p.numero}</span>}</td>
      <td className="num"><ImporteAnual p={p} /></td>
      <td className="num"><Recibo p={p} /></td>
      <td>
        {p.fin ? <span className="vto">{fechaMedia(p.fin)}</span> : <span className="pendiente">Pendiente</span>}
        <span style={{ display: 'block' }}><Dias dias={p.dias} /></span>
      </td>
      <td>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Estado situacion={p.situacion} />
          {!p.datos_confirmados && <Revisar />}
        </div>
      </td>
    </tr>
  );
}

function TarjetaPoliza({ p, volver }: { p: FilaPanel; volver: string }) {
  return (
    <li className="tarjeta tpoliza">
      <div className="tpoliza__cab">
        <IconoRamo icono={p.ramo_icono} etiqueta={p.ramo_nombre} />
        <div>
          <span className="tpoliza__titular">{p.titular_nombre}</span>
          <Link className="tpoliza__nombre" href={`/admin/seguros/polizas/${p.id}?volver=${volver}`}>{p.nombre}</Link>
          <span className="linea-2">{p.ramo_nombre} · {p.aseguradora}</span>
        </div>
      </div>
      <dl className="tpoliza__datos">
        <div>
          <dt>Prima anual</dt>
          <dd><ImporteAnual p={p} /></dd>
        </div>
        <div>
          <dt>Vencimiento</dt>
          <dd>{p.fin ? <span className="vto">{fechaMedia(p.fin)}</span> : <span className="pendiente">Pendiente</span>} <Dias dias={p.dias} /></dd>
        </div>
      </dl>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Estado situacion={p.situacion} />
        {!p.datos_confirmados && <Revisar />}
        {p.periodicidad && <span className="estado estado--neutro">{textoPeriodicidad(p.periodicidad)}{p.importe_recibo ? ` · ${formatoImporte(p.importe_recibo, p.moneda)}` : ''}</span>}
      </div>
    </li>
  );
}

type Opciones = Awaited<ReturnType<typeof panel>>['opciones'];
type ListaTitulares = Awaited<ReturnType<typeof listarTitulares>>;

/** Filtros: barra visible en escritorio y panel plegable en móvil (mismo formulario GET, sin JavaScript). */
function Filtros({ f, titulares, opciones, hayFiltros }: { f: TFiltros; titulares: ListaTitulares; opciones: Opciones; hayFiltros: boolean }) {
  const campos = (
          <div className="filtros__campos">
            <label>Buscar
              <input type="search" name="q" defaultValue={f.q} placeholder="Póliza, matrícula, inmueble…" />
            </label>
            <label>Titular
              <select name="titular" defaultValue={f.titular ?? ''}>
                <option value="">Todos</option>
                {titulares.filter((t) => !f.ambito || f.ambito === 'todos' || (f.ambito === 'empresas') === (t.tipo === 'empresa')).map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            </label>
            <label>Tipo de seguro
              <select name="ramo" defaultValue={f.ramo ?? ''}>
                <option value="">Todos</option>
                {opciones.ramos.map((r) => <option key={r.clave} value={r.clave}>{r.nombre}</option>)}
              </select>
            </label>
            <label>Aseguradora
              <select name="aseguradora" defaultValue={f.aseguradora ?? ''}>
                <option value="">Todas</option>
                {opciones.aseguradoras.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
            <label>Situación
              <select name="estado" defaultValue={f.estado ?? 'todos'}>
                {ESTADOS.map((e) => <option key={e.valor} value={e.valor}>{e.texto}</option>)}
              </select>
            </label>
            <label>Ordenar por
              <select name="orden" defaultValue={f.orden ?? 'vencimiento'}>
                <option value="vencimiento">Vencimiento</option>
                <option value="coste">Coste anual</option>
                <option value="titular">Titular</option>
              </select>
            </label>
          </div>
  );
  const ocultos = f.ambito ? <input type="hidden" name="ambito" value={f.ambito} /> : null;
  const botones = (
    <div className="acciones">
      <button className="boton boton--oscuro" type="submit">Aplicar</button>
      {hayFiltros && <Link className="boton boton--sutil" href="/admin/seguros/">Quitar filtros</Link>}
    </div>
  );
  const activos = [f.titular, f.ramo, f.aseguradora, f.estado && f.estado !== 'todos' ? f.estado : null, f.q, f.orden && f.orden !== 'vencimiento' ? f.orden : null].filter(Boolean).length;
  return (
    <>
      <form className="filtros solo-escritorio" method="get" action="/admin/seguros/" role="search" aria-label="Filtrar pólizas">
        {ocultos}{campos}{botones}
      </form>
      <details className="filtros-movil tarjeta" open={activos > 0}>
        <summary>Buscar y filtrar{activos > 0 ? ` · ${activos} ${activos === 1 ? 'filtro activo' : 'filtros activos'}` : ''}</summary>
        <form className="filtros" method="get" action="/admin/seguros/" role="search" aria-label="Filtrar pólizas (móvil)">
          {ocultos}{campos}{botones}
        </form>
      </details>
    </>
  );
}
