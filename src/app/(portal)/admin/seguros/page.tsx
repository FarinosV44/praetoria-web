import type { Metadata } from 'next';
import Link from 'next/link';
import { Cabecera, FiltroSelector, Filtros as TarjetaFiltros, FiltroTexto, Kpi, RejillaKpi, Vistas, enlaceCon, textoOpcion } from '@/portal/components/despacho';
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
    orden: v(b.orden, ['vencimiento', 'coste', 'titular', 'cobro'] as const),
    agrupar: v(b.agrupar, ['titular', 'ramo'] as const),
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
    <div className="grid gap-4">
      <Cabecera seccion="Seguros" titulo="Pólizas" entradilla={`${filas.length} ${filas.length === 1 ? 'póliza' : 'pólizas'}${hayFiltros ? ' con estos filtros' : ''}`}
        acciones={<>
          <a className="btn btn-secundario solo-escritorio" href={`/api/seguros/exportar/polizas${f.titular ? `?titular=${f.titular}` : ''}`}>Exportar CSV</a>
          <Link className="btn btn-secundario" href="/admin/seguros/pagos/">Previsión de pagos</Link>
          <Link className="btn btn-secundario solo-escritorio" href={`/admin/seguros/polizas/nueva${f.titular ? `?titular=${f.titular}` : ''}`}>Añadir a mano</Link>
          <Link className="btn btn-primario" href="/admin/seguros/importar/"><IconoMas /> Subir pólizas</Link>
        </>} />

      <RejillaKpi etiqueta="Resumen">
        <Kpi etiqueta={`Gasto anual activo${hayFiltros ? ' (filtrado)' : ''}`}
          valor={<>{totalPrincipal ? formatoImporte(deCentimos(totalPrincipal.centimos), totalPrincipal.moneda) : '—'}{resumen.totales.slice(1).map((t) => <span key={t.moneda} className="cifra"> + {formatoImporte(deCentimos(t.centimos), t.moneda)}</span>)}</>}
          nota={`${resumen.conImporte} de ${resumen.activas} pólizas con importe${resumen.totales.some((t) => t.estimado) ? ' · incluye estimados' : ''}`} />
        <Kpi etiqueta="Vencen este mes" valor={resumen.proximas} nota="Para renegociar a tiempo" tono={resumen.proximas ? 'aviso' : undefined} href={conParametros(b, { estado: 'proximas' })} />
        <Kpi etiqueta={resumen.vencidas ? 'Vencidas sin renovar' : 'Sin fecha confirmada'} valor={resumen.vencidas || resumen.sinFecha} nota={resumen.vencidas ? `y ${resumen.sinFecha} sin fecha` : 'Revisa sus documentos'} tono={resumen.vencidas ? 'alerta' : undefined} href={conParametros(b, { estado: resumen.vencidas ? 'vencidas' : 'sin_fecha' })} />
        <Kpi etiqueta="Por revisar" valor={resumen.revisar} nota="Datos sin confirmar" href={conParametros(b, { estado: 'revisar' })} />
      </RejillaKpi>

      <Vistas etiqueta="Tipo de titular" visible="Titular" items={([['todos', 'Todos'], ['empresas', 'Empresas'], ['particulares', 'Particulares']] as const).map(([v, t]) => ({ texto: t, href: conParametros(b, { ambito: v === 'todos' ? undefined : v, titular: undefined }), activo: (f.ambito ?? 'todos') === v }))} />

      <Filtros f={f} b={b} titulares={titulares} opciones={opciones} />

      {filas.length === 0 ? (
        <div className="tarjeta vacio">
          <h2>{hayFiltros ? 'No hay pólizas con estos filtros' : 'Todavía no hay pólizas'}</h2>
          <p>{hayFiltros ? 'Prueba a quitar algún filtro.' : 'Sube los documentos de tus pólizas: la IA guarda sus datos sin que tengas que escribir nada.'}</p>
          {!hayFiltros && <Link className="boton boton--principal" href="/admin/seguros/importar/"><IconoMas /> Subir pólizas</Link>}
        </div>
      ) : (
        <>
          <div className="tabla-marco solo-escritorio">
            <table className="tabla">
              <caption className="sr">Pólizas: titular, tipo de seguro, importe y vencimiento</caption>
              <thead>
                <tr>
                  <th scope="col">Titular y seguro</th>
                  <th scope="col">Aseguradora</th>
                  <th scope="col" className="num">Importe</th>
                  <th scope="col">Próximo cobro</th>
                  <th scope="col">Vencimiento y oposición</th>
                  <th scope="col">Situación</th>
                </tr>
              </thead>
              {grupos(filas, f.agrupar).map(([g, fs]) => (
                <tbody key={g || 'todas'}>
                  {g && <tr className="fila-grupo"><th colSpan={6} scope="rowgroup">{g} <span className="linea-2">· {fs.length}</span></th></tr>}
                  {fs.map((p) => <FilaTabla key={p.id} p={p} volver={volver} />)}
                </tbody>
              ))}
            </table>
          </div>
          {grupos(filas, f.agrupar).map(([g, fs]) => (
            <section key={g || 'todas'} aria-label={g || 'Pólizas'}>
              {g && <h2 className="titulo-grupo solo-movil">{g}</h2>}
              <ul className="lista-tarjetas" aria-label={g ? `Pólizas de ${g}` : 'Pólizas'}>
                {fs.map((p) => <TarjetaPoliza key={p.id} p={p} volver={volver} />)}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  );
}

function grupos(filas: FilaPanel[], agrupar?: 'titular' | 'ramo'): [string, FilaPanel[]][] {
  if (!agrupar) return [['', filas]];
  const m = new Map<string, FilaPanel[]>();
  for (const p of filas) {
    const k = agrupar === 'titular' ? `${p.titular_nombre} · ${p.titular_tipo === 'empresa' ? 'Empresa' : 'Particular'}` : p.ramo_nombre;
    m.set(k, [...(m.get(k) ?? []), p]);
  }
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es'));
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const textoMes = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

function ProximoCobro({ p }: { p: FilaPanel }) {
  const c = p.proximo_cobro;
  if (!c) return <span className="pendiente">Sin previsión</span>;
  return (
    <>
      <span className="cifra">{formatoImporte(c.importe, p.moneda)}</span>
      <span className="linea-2" style={{ display: 'block' }}>{c.fecha ? `cobro ${fechaMedia(c.fecha)}` : `${textoMes(c.mes)} · estimado`}</span>
    </>
  );
}

function VtoOposicion({ p }: { p: FilaPanel }) {
  return (
    <>
      {p.fin ? <span className="vto">{fechaMedia(p.fin)}</span> : <span className="pendiente">Vencimiento pendiente</span>}
      <span style={{ display: 'block' }}><Dias dias={p.dias} /></span>
      <span className="linea-2" style={{ display: 'block' }}>{p.plazo_oposicion ? `Oposición hasta ${fechaMedia(p.plazo_oposicion)}${p.plazo_oposicion_confirmado ? '' : ' (sin comprobar)'}` : 'Oposición: no registrada'}</span>
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
  if (!p.periodicidad && !p.importe_recibo) return null;
  return (
    <>
      <span className="linea-2" style={{ display: 'block' }}>
        {textoPeriodicidad(p.periodicidad) || 'periodicidad pendiente'}
        {/* El recibo solo se repite si no coincide con el importe anual (pago fraccionado o sin coste anual) */}
        {p.importe_recibo && (p.periodicidad !== 'anual' || !p.coste) ? <> · recibo <span className="cifra">{formatoImporte(p.importe_recibo, p.moneda)}</span></> : null}
      </span>
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
      <td className="num"><ImporteAnual p={p} /><Recibo p={p} /></td>
      <td><ProximoCobro p={p} /></td>
      <td><VtoOposicion p={p} /></td>
      <td>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Estado situacion={p.situacion} />
          {!p.datos_confirmados && <Revisar />}
          {p.avisos_pendientes > 0 && <Link className="estado estado--vencida" href="/admin/seguros/avisos/">{p.avisos_pendientes} {p.avisos_pendientes === 1 ? 'aviso' : 'avisos'}</Link>}
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
          <dt>Próximo cobro</dt>
          <dd><ProximoCobro p={p} /></dd>
        </div>
        <div>
          <dt>Vencimiento</dt>
          <dd><VtoOposicion p={p} /></dd>
        </div>
      </dl>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Estado situacion={p.situacion} />
        {!p.datos_confirmados && <Revisar />}
        {p.avisos_pendientes > 0 && <span className="estado estado--vencida">{p.avisos_pendientes} {p.avisos_pendientes === 1 ? 'aviso' : 'avisos'}</span>}
        {p.periodicidad && <span className="estado estado--neutro">{textoPeriodicidad(p.periodicidad)}{p.importe_recibo ? ` · ${formatoImporte(p.importe_recibo, p.moneda)}` : ''}</span>}
      </div>
    </li>
  );
}

type Opciones = Awaited<ReturnType<typeof panel>>['opciones'];
type ListaTitulares = Awaited<ReturnType<typeof listarTitulares>>;

/** Tarjeta de filtros común del despacho (formulario GET: atrás y recargar conservan la vista). */
function Filtros({ f, b, titulares, opciones }: { f: TFiltros; b: Busqueda; titulares: ListaTitulares; opciones: Opciones }) {
  const BASE = '/admin/seguros/';
  const sitio: [string, string][] = ESTADOS.map((e) => [e.valor, e.texto]);
  const ORDEN: [string, string][] = [['vencimiento', 'Vencimiento'], ['coste', 'Coste anual'], ['cobro', 'Próximo cobro'], ['titular', 'Titular']];
  const AGRUPAR: [string, string][] = [['', 'Sin agrupar'], ['titular', 'Por titular'], ['ramo', 'Por tipo de seguro']];
  const opTit: [string, string][] = [['', 'Todos'], ...titulares.filter((t) => !f.ambito || f.ambito === 'todos' || (f.ambito === 'empresas') === (t.tipo === 'empresa')).map((t): [string, string] => [t.id, t.nombre])];
  const opRamo: [string, string][] = [['', 'Todos'], ...opciones.ramos.map((r): [string, string] => [r.clave, r.nombre])];
  const opAseg: [string, string][] = [['', 'Todas'], ...opciones.aseguradoras.map((a): [string, string] => [a, a])];
  const quitar = (c: Busqueda) => enlaceCon(BASE, b, c);
  const activos = [
    f.q ? { texto: `Buscar: ${f.q}`, href: quitar({ q: undefined }) } : null,
    f.titular ? { texto: `Titular: ${textoOpcion(opTit, f.titular)}`, href: quitar({ titular: undefined }) } : null,
    f.ramo ? { texto: `Seguro: ${textoOpcion(opRamo, f.ramo)}`, href: quitar({ ramo: undefined }) } : null,
    f.aseguradora ? { texto: `Aseguradora: ${f.aseguradora}`, href: quitar({ aseguradora: undefined }) } : null,
    f.estado && f.estado !== 'todos' ? { texto: `Situación: ${textoOpcion(sitio, f.estado)}`, href: quitar({ estado: undefined }) } : null,
    f.orden && f.orden !== 'vencimiento' ? { texto: `Orden: ${textoOpcion(ORDEN, f.orden)}`, href: quitar({ orden: undefined }) } : null,
    f.agrupar ? { texto: textoOpcion(AGRUPAR, f.agrupar), href: quitar({ agrupar: undefined }) } : null,
  ].filter((x): x is { texto: string; href: string } => !!x);
  const nAvanzados = (f.orden && f.orden !== 'vencimiento' ? 1 : 0) + (f.agrupar ? 1 : 0);
  return (
    <TarjetaFiltros accion={BASE} etiqueta="Filtrar pólizas" columnas={5} ocultos={{ ambito: f.ambito }} activos={activos} limpiar={enlaceCon(BASE, { ambito: f.ambito })} nAvanzados={nAvanzados}
      basicos={<>
        <FiltroTexto nombre="q" etiqueta="Buscar" valor={f.q} ayuda="Póliza, matrícula, inmueble…" />
        <FiltroSelector nombre="titular" etiqueta="Titular" valor={f.titular} opciones={opTit} />
        <FiltroSelector nombre="ramo" etiqueta="Tipo de seguro" valor={f.ramo} opciones={opRamo} />
        <FiltroSelector nombre="aseguradora" etiqueta="Aseguradora" valor={f.aseguradora} opciones={opAseg} />
        <FiltroSelector nombre="estado" etiqueta="Situación" valor={f.estado ?? 'todos'} opciones={sitio} />
      </>}
      avanzados={<>
        <FiltroSelector nombre="orden" etiqueta="Ordenar por" valor={f.orden ?? 'vencimiento'} opciones={ORDEN} />
        <FiltroSelector nombre="agrupar" etiqueta="Agrupar" valor={f.agrupar} opciones={AGRUPAR} />
      </>} />
  );
}
