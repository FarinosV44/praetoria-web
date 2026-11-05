import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { exigirUsuario } from '@/seguros/lib/auth/servidor';
import { compararOferta, datosActuales, ESTADOS_RENOVACION, evolucion, obtenerRenovacion } from '@/seguros/lib/datos/renovaciones';
import { NoEncontrado } from '@/seguros/lib/errores';
import { deCentimos, formatoImporte, PERIODICIDADES, textoPeriodicidad } from '@/seguros/lib/dinero';
import { diasEntre, fechaLarga, fechaMedia, hoyMadrid, sumarAnios } from '@/seguros/lib/fechas';
import { Area, Campo, CampoArchivo, Casilla, Enviar, Formulario, Importe, Radios, Selector } from '@/seguros/components/formulario';
import { BotonCopiar } from '@/seguros/components/copiar';
import { accionBorrador, accionDecision, accionEstado, accionNota, accionOferta, accionTarea } from '../acciones';

export const metadata: Metadata = { title: 'Renegociación' };

const GRAVEDAD = { mejor: 'vigente', peor: 'vencida', revisar: 'proxima' } as const;

export default async function Renovacion({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await exigirUsuario();
  const r = await obtenerRenovacion(u, id).catch((e) => { if (e instanceof NoEncontrado) notFound(); throw e; });
  const ev = evolucion(r.historico);
  const actual = datosActuales(r.anualidad);
  const cerrada = ['renovada', 'sustituida', 'baja'].includes(r.estado);
  const hoy = hoyMadrid();
  const m = r.poliza.moneda;
  const borradores = r.notas.filter((n) => n.tipo === 'borrador');

  return (
    <>
      <div className="migas"><Link href={`/admin/seguros/polizas/${r.poliza.id}`}>← {r.poliza.nombre}</Link></div>
      <div className="ficha-cab">
        <div>
          <span className="tpoliza__titular">{r.poliza.titular} · {r.poliza.ramo}</span>
          <h1>Renegociación: {r.poliza.nombre}</h1>
          <p className="secundario">{r.poliza.aseguradora} · vence el {r.anualidad.fin ? `${fechaLarga(r.anualidad.fin)} (${diasEntre(hoy, r.anualidad.fin) >= 0 ? `en ${diasEntre(hoy, r.anualidad.fin)} días` : 'vencida'})` : '[vencimiento pendiente]'}</p>
          <div style={{ display: 'flex', gap: 6, marginTop: 'var(--e-2)', flexWrap: 'wrap' }}>
            <span className={`estado estado--${cerrada ? 'vigente' : 'proxima'}`}>{ESTADOS_RENOVACION[r.estado]}</span>
            {r.anualidad.plazo_oposicion && (
              <span className={`estado estado--${r.anualidad.plazo_oposicion_confirmado ? 'vencida' : 'neutro'}`}>
                Límite de oposición: {fechaMedia(r.anualidad.plazo_oposicion)}{r.anualidad.plazo_oposicion_confirmado ? '' : ' (sin comprobar)'}
              </span>
            )}
          </div>
          {r.anualidad.plazo_oposicion_confirmado && <p className="pequeno secundario" style={{ marginTop: 4 }}>Fuente: {r.anualidad.plazo_oposicion_fuente}. Posponer tareas no cambia esta fecha.</p>}
        </div>
        {r.nueva_poliza_id && <Link className="boton boton--oscuro" href={`/admin/seguros/polizas/${r.nueva_poliza_id}`}>Ver la póliza nueva</Link>}
      </div>

      <div className="dos-columnas">
        <div style={{ display: 'grid', gap: 'var(--e-5)' }}>
          <section className="tarjeta tarjeta--pad" aria-labelledby="t-hist">
            <h2 id="t-hist" style={{ marginBottom: 'var(--e-3)' }}>Evolución de la prima</h2>
            <table className="tabla">
              <thead><tr><th scope="col">Anualidad</th><th scope="col" className="num">Coste anual</th><th scope="col" className="num">Variación</th></tr></thead>
              <tbody>
                {ev.map((x) => (
                  <tr key={x.id}>
                    <td>{fechaMedia(x.inicio) || '¿?'} – {fechaMedia(x.fin) || '¿?'}{x.id === r.anualidad.id ? <span className="estado estado--neutro" style={{ marginLeft: 6 }}>Esta</span> : null}</td>
                    <td className="num">{x.coste ? <span className="importe">{formatoImporte(deCentimos(x.coste.centimos), m)}{x.coste.tipo === 'estimado' ? '*' : ''}</span> : <span className="pendiente">Pendiente</span>}</td>
                    <td className="num cifra">{x.diferencia !== null ? `${x.diferencia >= 0 ? '+' : '−'}${formatoImporte(deCentimos(Math.abs(x.diferencia)), m)} (${x.porcentaje! >= 0 ? '+' : ''}${x.porcentaje!.toFixed(1).replace('.', ',')} %)` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {ev.some((x) => x.coste?.tipo === 'estimado') && <p className="pequeno secundario" style={{ marginTop: 'var(--e-2)' }}>* Estimado a partir del recibo.</p>}
            <p className="pequeno" style={{ marginTop: 'var(--e-3)' }}>
              {r.siniestros.length === 0 ? 'Sin siniestros registrados en este periodo.' : <>Siniestros en este periodo: {r.siniestros.map((s) => <Link key={s.id} href={`/admin/seguros/siniestros/${s.id}`} style={{ marginRight: 8 }}>{s.titulo}</Link>)}</>}
            </p>
          </section>

          <section className="tarjeta tarjeta--pad" aria-labelledby="t-comp">
            <h2 id="t-comp" style={{ marginBottom: 'var(--e-2)' }}>Comparación de ofertas</h2>
            <p className="pequeno secundario" style={{ marginBottom: 'var(--e-3)' }}>Más barata no significa equivalente: revisa garantías, franquicias y exclusiones. Lo que no consta se marca como desconocido.</p>
            {r.ofertas.length === 0 ? <p className="secundario">Aún no hay ofertas registradas.</p> : (
              <div className="desplazable">
                <table className="comparacion">
                  <thead>
                    <tr><th scope="col"></th><th scope="col">Actual · {r.poliza.aseguradora}</th>{r.ofertas.map((o) => <th key={o.id} scope="col">{o.aseguradora}{o.es_renovacion_actual ? ' (renovación)' : ''}{o.elegida ? ' ✓' : ''}</th>)}</tr>
                  </thead>
                  <tbody>
                    <tr><th scope="row">Prima anual</th><td className="importe">{actual.prima !== null ? formatoImporte(actual.prima, m) : 'Desconocida'}</td>{r.ofertas.map((o) => <td key={o.id} className="importe">{o.prima_anual ? formatoImporte(o.prima_anual, m) : 'Desconocida'}</td>)}</tr>
                    <tr><th scope="row">Impuestos y gastos</th><td>—</td>{r.ofertas.map((o) => <td key={o.id}>{o.impuestos_gastos ?? 'Desconocido'}</td>)}</tr>
                    <tr><th scope="row">Garantías</th><td style={{ whiteSpace: 'pre-wrap' }}>{actual.garantias ?? 'No consta'}</td>{r.ofertas.map((o) => <td key={o.id} style={{ whiteSpace: 'pre-wrap' }}>{o.garantias ?? 'Desconocidas'}</td>)}</tr>
                    <tr><th scope="row">Capitales</th><td>—</td>{r.ofertas.map((o) => <td key={o.id} style={{ whiteSpace: 'pre-wrap' }}>{o.capitales ?? 'Desconocidos'}</td>)}</tr>
                    <tr><th scope="row">Franquicias</th><td style={{ whiteSpace: 'pre-wrap' }}>{actual.franquicias ?? 'No consta'}</td>{r.ofertas.map((o) => <td key={o.id} style={{ whiteSpace: 'pre-wrap' }}>{o.franquicias ?? 'Desconocidas'}</td>)}</tr>
                    <tr><th scope="row">Exclusiones</th><td style={{ whiteSpace: 'pre-wrap' }}>{actual.exclusiones ?? 'No consta'}</td>{r.ofertas.map((o) => <td key={o.id} style={{ whiteSpace: 'pre-wrap' }}>{o.exclusiones ?? 'Desconocidas'}</td>)}</tr>
                    <tr><th scope="row">Vigencia</th><td>{fechaMedia(r.anualidad.inicio)} – {fechaMedia(r.anualidad.fin)}</td>{r.ofertas.map((o) => <td key={o.id}>{o.vigencia ?? 'Desconocida'}</td>)}</tr>
                    <tr><th scope="row">Diferencias</th><td></td>{r.ofertas.map((o) => <td key={o.id}><div style={{ display: 'grid', gap: 4 }}>{compararOferta(o, actual).map((d, i) => <span key={i} className={`estado estado--${GRAVEDAD[d.gravedad]}`} style={{ whiteSpace: 'normal' }}>{d.texto}</span>)}</div></td>)}</tr>
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {!cerrada && (
            <section className="tarjeta tarjeta--pad" aria-labelledby="t-dec">
              <h2 id="t-dec" style={{ marginBottom: 'var(--e-3)' }}>Registrar la decisión</h2>
              <Formulario accion={accionDecision.bind(null, id)} aria="Registrar la decisión">
                <Radios nombre="decision" etiqueta="Decisión" defecto="renovar" opciones={[
                  { valor: 'renovar', texto: 'Renovar con la misma compañía' }, { valor: 'sustituir', texto: 'Cambiar de compañía' }, { valor: 'baja', texto: 'Baja confirmada' },
                ]} />
                {r.ofertas.length > 0 && <Selector nombre="oferta_id" etiqueta="Oferta elegida" vacio="Ninguna" opciones={r.ofertas.map((o) => ({ valor: o.id, texto: `${o.aseguradora}${o.prima_anual ? ` · ${formatoImporte(o.prima_anual, m)}` : ''}` }))} />}
                <div className="rejilla">
                  <Campo nombre="inicio" etiqueta="Inicio de la nueva anualidad" tipo="date" defecto={r.anualidad.fin} />
                  <Campo nombre="fin" etiqueta="Vencimiento" tipo="date" defecto={r.anualidad.fin ? sumarAnios(r.anualidad.fin, 1) : undefined} />
                  <Importe nombre="prima_anual" etiqueta="Prima anual" />
                  <Selector nombre="periodicidad" etiqueta="Forma de pago" defecto={r.anualidad.periodicidad ?? ''} vacio="Pendiente" opciones={PERIODICIDADES.map((x) => ({ valor: x.valor, texto: x.texto }))} />
                  <Importe nombre="importe_recibo" etiqueta="Importe de cada recibo" />
                  <Campo nombre="aseguradora_nueva" etiqueta="Nueva aseguradora (si cambias)" />
                  <Campo nombre="numero_nuevo" etiqueta="Nº de la nueva póliza" />
                </div>
                <p className="pequeno secundario">Renovar crea una anualidad nueva y conserva la anterior con sus documentos. Cambiar de compañía crea una póliza nueva enlazada. Los avisos se recalculan al momento. No se envía nada a la aseguradora.</p>
                <div><Enviar>Registrar decisión</Enviar></div>
              </Formulario>
            </section>
          )}
        </div>

        <aside style={{ display: 'grid', gap: 'var(--e-5)', alignContent: 'start' }}>
          {!cerrada && (
            <div className="tarjeta tarjeta--pad">
              <h2 style={{ marginBottom: 'var(--e-3)' }}>Estado</h2>
              <Formulario accion={accionEstado.bind(null, id)} aria="Estado de la renegociación">
                <Selector nombre="estado" etiqueta="Estado" defecto={r.estado} opciones={(['pendiente', 'contactado', 'ofertas', 'decision'] as const).map((k) => ({ valor: k, texto: ESTADOS_RENOVACION[k] }))} />
                <Campo nombre="interlocutor" etiqueta="Interlocutor" defecto={r.interlocutor ?? r.poliza.mediador} />
                <div><Enviar className="boton">Guardar</Enviar></div>
              </Formulario>
            </div>
          )}
          {!cerrada && (
            <div className="tarjeta tarjeta--pad">
              <h2 style={{ marginBottom: 'var(--e-3)' }}>Añadir oferta</h2>
              <Formulario accion={accionOferta.bind(null, id)} encType="multipart/form-data" aria="Añadir oferta">
                <Campo nombre="aseguradora" etiqueta="Aseguradora" requerido />
                <Casilla nombre="es_renovacion_actual" etiqueta="Es la propuesta de renovación de la compañía actual" />
                <Importe nombre="prima_anual" etiqueta="Prima anual" />
                <Campo nombre="impuestos_gastos" etiqueta="Impuestos y gastos" />
                <Area nombre="garantias" etiqueta="Garantías (una por línea)" filas={3} />
                <Area nombre="capitales" etiqueta="Capitales" filas={2} />
                <Area nombre="franquicias" etiqueta="Franquicias" filas={2} />
                <Area nombre="exclusiones" etiqueta="Exclusiones (una por línea)" filas={3} />
                <Campo nombre="vigencia" etiqueta="Vigencia" />
                <CampoArchivo nombre="archivo" etiqueta="Documento de la oferta (opcional)" accept="application/pdf,image/*" />
                <div><Enviar>Guardar oferta</Enviar></div>
              </Formulario>
            </div>
          )}
          <div className="tarjeta tarjeta--pad" id="notas">
            <h2 style={{ marginBottom: 'var(--e-3)' }}>Notas, tareas y borrador</h2>
            <form action={accionBorrador.bind(null, id)} style={{ marginBottom: 'var(--e-3)' }}>
              <button className="boton boton--peq" type="submit">Preparar borrador para el mediador</button>
              <p className="pequeno secundario" style={{ marginTop: 4 }}>Solo con datos confirmados. No cambia el estado ni los avisos.</p>
            </form>
            {borradores[0] && (
              <div style={{ marginBottom: 'var(--e-4)' }}>
                <div className="acciones" style={{ justifyContent: 'space-between', marginBottom: 6 }}><strong className="pequeno">Último borrador</strong><BotonCopiar texto={borradores[0].texto} /></div>
                <textarea className="borrador" style={{ minHeight: 220 }} defaultValue={borradores[0].texto} aria-label="Borrador para el mediador" />
              </div>
            )}
            {!cerrada && (
              <Formulario accion={accionNota.bind(null, id)} aria="Añadir nota o tarea">
                <Selector nombre="tipo" etiqueta="Tipo" defecto="nota" opciones={[{ valor: 'nota', texto: 'Nota' }, { valor: 'tarea', texto: 'Tarea' }, { valor: 'comunicacion', texto: 'Comunicación' }]} />
                <Area nombre="texto" etiqueta="Texto" filas={2} />
                <Campo nombre="fecha_tarea" etiqueta="Fecha (tareas)" tipo="date" />
                <div><Enviar className="boton">Añadir</Enviar></div>
              </Formulario>
            )}
            <ul className="lista-simple" style={{ marginTop: 'var(--e-3)' }}>
              {r.notas.filter((n) => n.tipo !== 'borrador').map((n) => (
                <li key={n.id} style={{ display: 'block' }}>
                  <p className="pequeno secundario">{new Date(n.creado_en).toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' })} · {{ nota: 'Nota', tarea: 'Tarea', comunicacion: 'Comunicación', estado: 'Estado' }[n.tipo]}{n.autor ? ` · ${n.autor}` : ''}{n.fecha_tarea ? ` · para el ${fechaMedia(n.fecha_tarea)}` : ''}</p>
                  <p style={{ whiteSpace: 'pre-wrap', textDecoration: n.hecha ? 'line-through' : undefined }}>{n.texto}</p>
                  {n.tipo === 'tarea' && <form action={accionTarea.bind(null, n.id, !n.hecha)}><button className="enlace pequeno" type="submit">{n.hecha ? 'Marcar pendiente' : 'Marcar hecha'}</button></form>}
                </li>
              ))}
            </ul>
          </div>
          <p className="pequeno secundario">Recibo actual: {r.anualidad.importe_recibo ? formatoImporte(r.anualidad.importe_recibo, m) : 'pendiente'} · {textoPeriodicidad(r.anualidad.periodicidad) || 'forma de pago pendiente'}</p>
        </aside>
      </div>
    </>
  );
}
