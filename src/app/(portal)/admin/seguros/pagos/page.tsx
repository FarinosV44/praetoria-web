import type { Metadata } from 'next';
import Link from 'next/link';
import { exigirUsuario } from '@/seguros/lib/auth/servidor';
import { listarTitulares } from '@/seguros/lib/datos/titulares';
import { prevision, totalesPorMes, type Previsto } from '@/seguros/lib/datos/recibos';
import { deCentimos, formatoImporte, aCentimos } from '@/seguros/lib/dinero';
import { fechaMedia, hoyMadrid } from '@/seguros/lib/fechas';

export const metadata: Metadata = { title: 'Previsión de pagos' };

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const textoMes = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
const euros = (c: number) => formatoImporte(deCentimos(c));
const TIPO: Record<Previsto['tipo'], { texto: string; clase: string }> = {
  pagado: { texto: 'Pagado', clase: 'vigente' }, confirmado: { texto: 'Recibo', clase: 'proxima' }, estimado: { texto: 'Estimado', clase: 'neutro' },
};

export default async function Pagos({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const u = await exigirUsuario();
  const b = await searchParams;
  const titulares = await listarTitulares(u);
  const titular = titulares.some((t) => t.id === b.titular) ? b.titular! : null;
  const vista = b.vista === 'calendario' ? 'calendario' : 'lista';
  const hoy = hoyMadrid();
  const desde = /^\d{4}-\d{2}$/.test(b.desde ?? '') ? b.desde! : hoy.slice(0, 7);
  const items = await prevision(u, { desde, meses: 12, titularId: titular });
  const totales = totalesPorMes(items);
  const mesActual = totales.find((t) => t.mes === hoy.slice(0, 7));
  const suma = (t: { pagado: number; confirmado: number; estimado: number }) => t.pagado + t.confirmado + t.estimado;
  const anio = hoy.slice(0, 4);
  const delAnio = totales.filter((t) => t.mes.startsWith(anio)).reduce((a, t) => a + suma(t), 0);
  // Los 3 meses naturales siguientes al actual (no los 3 primeros meses que tengan algún pago).
  const sig = (n: number) => new Date(Date.UTC(Number(hoy.slice(0, 4)), Number(hoy.slice(5, 7)) - 1 + n, 1)).toISOString().slice(0, 7);
  const tresMeses = new Set([sig(1), sig(2), sig(3)]);
  const tres = totales.filter((t) => tresMeses.has(t.mes)).reduce((a, t) => a + suma(t), 0);
  const total12 = totales.reduce((a, t) => a + suma(t), 0);
  const enlace = (cambios: Record<string, string | null>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ titular, vista, desde: desde === hoy.slice(0, 7) ? null : desde, ...cambios })) if (v) p.set(k, v);
    return `/admin/seguros/pagos/${p.size ? `?${p}` : ''}`;
  };
  const meses = Array.from({ length: 12 }, (_, i) => { const d = new Date(Date.UTC(Number(desde.slice(0, 4)), Number(desde.slice(5, 7)) - 1 + i, 1)); return d.toISOString().slice(0, 7); });

  return (
    <>
      <div className="migas"><Link href="/admin/seguros/">← Pólizas</Link></div>
      <div className="encabezado"><div>
        <h1>Previsión de pagos</h1>
        <p className="secundario pequeno">Pagos acreditados, recibos emitidos y estimaciones de los próximos 12 meses. Una estimación se calcula con la periodicidad y el último importe conocido: lleva solo el mes, nunca un día inventado, y no se cuenta si ya hay un recibo de ese periodo.</p>
      </div></div>

      <section className="resumen" aria-label="Totales">
        <div className="tarjeta cifra-clave cifra-clave--principal"><span className="cifra-clave__etq">Este mes</span><span className="cifra-clave__valor">{euros(mesActual ? suma(mesActual) : 0)}</span>
          <span className="cifra-clave__nota">{mesActual ? `${euros(mesActual.pagado)} pagado · ${euros(mesActual.confirmado)} en recibos · ${euros(mesActual.estimado)} estimado` : 'Nada previsto'}</span></div>
        <div className="tarjeta cifra-clave"><span className="cifra-clave__etq">Próximos 3 meses</span><span className="cifra-clave__valor">{euros(tres)}</span></div>
        <div className="tarjeta cifra-clave"><span className="cifra-clave__etq">Resto de {anio}</span><span className="cifra-clave__valor">{euros(delAnio)}</span><span className="cifra-clave__nota">desde {textoMes(desde)}</span></div>
        <div className="tarjeta cifra-clave"><span className="cifra-clave__etq">12 meses</span><span className="cifra-clave__valor">{euros(total12)}</span></div>
      </section>

      <form className="filtros" method="get" aria-label="Filtrar previsión" style={{ marginBottom: 'var(--e-4)' }}>
        <div className="campo"><label htmlFor="titular-p">Titular</label>
          <select id="titular-p" name="titular" defaultValue={titular ?? ''}><option value="">Todos</option>{titulares.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select></div>
        <div className="campo"><label htmlFor="desde-p">Desde</label><input id="desde-p" type="month" name="desde" defaultValue={desde} /></div>
        <input type="hidden" name="vista" value={vista} />
        <button className="boton boton--oscuro" type="submit" style={{ alignSelf: 'flex-end' }}>Aplicar</button>
        <nav className="segmentos" aria-label="Vista" style={{ alignSelf: 'flex-end', marginLeft: 'auto' }}>
          <Link href={enlace({ vista: 'lista' })} aria-current={vista === 'lista' ? 'true' : undefined}>Listado</Link>
          <Link href={enlace({ vista: 'calendario' })} aria-current={vista === 'calendario' ? 'true' : undefined}>Calendario</Link>
        </nav>
      </form>

      {items.length === 0 ? <div className="tarjeta vacio"><h2>Sin pagos previstos</h2><p>Sube los recibos o completa la periodicidad e importe de las pólizas.</p></div>
        : vista === 'calendario' ? (
          <div className="calendario-pagos">
            {meses.map((m) => {
              const del = items.filter((i) => i.mes === m);
              const t = totales.find((x) => x.mes === m);
              return (
                <section key={m} className="tarjeta tarjeta--pad" aria-label={textoMes(m)}>
                  <h2 style={{ fontSize: 'var(--texto-m)', display: 'flex', justifyContent: 'space-between', gap: 8 }}><span>{textoMes(m)}</span><span className="cifra">{euros(t ? suma(t) : 0)}</span></h2>
                  {del.length === 0 ? <p className="pequeno secundario">Sin pagos</p> : (
                    <ul className="lista-puntos pequeno" style={{ marginTop: 'var(--e-2)' }}>
                      {del.map((i, n) => <li key={n}><strong>{i.fecha ? i.fecha.slice(8) : '—'}</strong> {i.poliza} · {formatoImporte(i.importe, i.moneda)} <span className={`estado estado--${TIPO[i.tipo].clase}`}>{TIPO[i.tipo].texto}</span></li>)}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        ) : (
          <div className="tarjeta">
            <table className="tabla">
              <caption className="sr">Pagos previstos por mes</caption>
              <thead><tr><th scope="col">Fecha</th><th scope="col">Seguro y titular</th><th scope="col">Origen</th><th scope="col" className="num">Importe</th></tr></thead>
              {totales.map((t) => (
                <tbody key={t.mes}>
                  <tr className="fila-grupo"><th colSpan={3} scope="rowgroup">{textoMes(t.mes)}<span className="linea-2"> · {euros(t.pagado)} pagado · {euros(t.confirmado)} en recibos · {euros(t.estimado)} estimado</span></th><th className="num cifra">{euros(suma(t))}</th></tr>
                  {items.filter((i) => i.mes === t.mes).map((i, n) => (
                    <tr key={n}>
                      <td>{i.fecha ? fechaMedia(i.fecha) : <span className="pendiente">Día sin confirmar</span>}</td>
                      <td><Link href={`/admin/seguros/polizas/${i.poliza_id}?pestana=recibos`}>{i.poliza}</Link><span className="linea-2" style={{ display: 'block' }}>{i.titular} · {i.ramo} · {i.aseguradora}</span></td>
                      <td><span className={`estado estado--${TIPO[i.tipo].clase}`}>{TIPO[i.tipo].texto}</span><span className="linea-2" style={{ display: 'block' }}>{i.base}</span></td>
                      <td className="num cifra">{formatoImporte(i.importe, i.moneda)}</td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        )}
      <p className="pequeno secundario" style={{ marginTop: 'var(--e-3)' }}>Total de las estimaciones: {euros(items.filter((i) => i.tipo === 'estimado').reduce((a, i) => a + aCentimos(i.importe), 0))}. Se sustituyen solas cuando llega el recibo real.</p>
    </>
  );
}
