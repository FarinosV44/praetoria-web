import type { Usuario } from '@/seguros/lib/auth/sesiones';
import { cronologia, condicionesEnFecha, DIRECCIONES, MEDIOS } from '@/seguros/lib/datos/expediente';
import { ESTADOS_RECIBO, listarRecibos, situacionPagos } from '@/seguros/lib/datos/recibos';
import { TIPOS_DOCUMENTO, type Documento } from '@/seguros/lib/datos/documentos';
import type { Anualidad } from '@/seguros/lib/datos/polizas';
import { esFecha, fechaMedia, hoyMadrid } from '@/seguros/lib/fechas';
import { formatoImporte, PERIODICIDADES, textoPeriodicidad } from '@/seguros/lib/dinero';
import { Area, Campo, Enviar, Formulario, Importe, Selector } from '@/seguros/components/formulario';
import {
  accionAnularModificacion, accionComunicacion, accionDocumento, accionEliminarComunicacion, accionEliminarNota, accionModificacion, accionNota, accionRecibo,
} from '../expediente-acciones';

const CLASES = [
  ['', 'Todo'], ['documento', 'Documentos'], ['comunicacion', 'Comunicaciones'], ['recibo', 'Recibos'], ['modificacion', 'Modificaciones'],
  ['periodo', 'Periodos'], ['siniestro', 'Siniestros'], ['nota', 'Notas'], ['escrito', 'Escritos'],
] as const;

const periodoTexto = (a: Pick<Anualidad, 'inicio' | 'fin'>) => (a.inicio || a.fin ? `${fechaMedia(a.inicio) || '¿?'} – ${fechaMedia(a.fin) || '¿?'}` : 'Fechas pendientes');

/** Cronología única del seguro, con búsqueda (también dentro de los documentos) y alta de notas y comunicaciones. */
export async function Expediente({ u, id, buscar, clase, documentos }: { u: Usuario; id: string; buscar?: string; clase?: string; documentos: Documento[] }) {
  const items = await cronologia(u, id, { buscar, clase });
  const opcionesDoc = documentos.map((d) => ({ valor: d.id, texto: `${d.nombre_original}${d.fecha_documento ? ` (${fechaMedia(d.fecha_documento)})` : ''}` }));
  return (
    <div className="dos-columnas">
      <section aria-labelledby="t-crono">
        <h2 id="t-crono" className="sr-only">Cronología del seguro</h2>
        <form className="filtros" method="get" role="search" aria-label="Buscar en el expediente" style={{ marginBottom: 'var(--e-3)' }}>
          <input type="hidden" name="pestana" value="expediente" />
          <div className="campo" style={{ flex: '2 1 220px' }}>
            <label htmlFor="buscar-exp">Buscar</label>
            <input id="buscar-exp" name="buscar" defaultValue={buscar} placeholder="Texto, nombre o contenido de un documento" />
          </div>
          <div className="campo" style={{ flex: '1 1 160px' }}>
            <label htmlFor="clase-exp">Mostrar</label>
            <select id="clase-exp" name="clase" defaultValue={clase ?? ''}>{CLASES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
          </div>
          <button className="boton boton--oscuro" type="submit" style={{ alignSelf: 'flex-end' }}>Aplicar</button>
        </form>
        <div className="tarjeta">
          {items.length === 0 ? <div className="vacio"><h2>{buscar || clase ? 'Nada coincide' : 'Expediente vacío'}</h2><p>{buscar || clase ? 'Prueba con otro texto o tipo.' : 'Sube documentos o añade una nota o comunicación.'}</p></div> : (
            <ol className="cronologia lista-simple">
              {items.map((i) => (
                <li key={`${i.clase}-${i.id}`}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p className="linea-2">{i.fecha ? fechaMedia(i.fecha) : 'Sin fecha'} · <span className="estado estado--neutro">{i.etiqueta}</span>{!i.acreditado && i.clase === 'nota' && <span className="estado estado--revisar" style={{ marginLeft: 6 }}>Sin acreditar</span>}</p>
                    <p style={{ fontWeight: 650, overflowWrap: 'anywhere' }}>{i.enlace ? <a href={i.enlace} {...(i.enlace.startsWith('/api/') ? { target: '_blank', rel: 'noopener' } : {})}>{i.titulo}</a> : i.titulo}</p>
                    {i.detalle && <p className="pequeno" style={{ whiteSpace: 'pre-wrap' }}>{i.detalle}</p>}
                  </div>
                  {i.clase === 'nota' && <form action={accionEliminarNota.bind(null, id, i.id)}><button className="boton boton--peq boton--sutil" type="submit" aria-label="Eliminar nota">Eliminar</button></form>}
                  {i.clase === 'comunicacion' && <form action={accionEliminarComunicacion.bind(null, id, i.id)}><button className="boton boton--peq boton--sutil" type="submit" aria-label="Eliminar comunicación">Eliminar</button></form>}
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
      <aside style={{ display: 'grid', gap: 'var(--e-4)', alignContent: 'start' }}>
        <section className="tarjeta tarjeta--pad" aria-labelledby="t-nota">
          <h2 id="t-nota" style={{ marginBottom: 'var(--e-3)' }}>Añadir nota</h2>
          <Formulario accion={accionNota.bind(null, id)} aria="Añadir nota">
            <Campo nombre="fecha" etiqueta="Fecha" tipo="date" defecto={hoyMadrid()} />
            <Area nombre="texto" etiqueta="Nota" filas={4} requerido ayuda="Queda como afirmación propia: la IA la trata como pendiente de comprobar." />
            <div><Enviar>Guardar nota</Enviar></div>
          </Formulario>
        </section>
        <section className="tarjeta tarjeta--pad" aria-labelledby="t-com">
          <h2 id="t-com" style={{ marginBottom: 'var(--e-3)' }}>Registrar comunicación</h2>
          <Formulario accion={accionComunicacion.bind(null, id)} aria="Registrar comunicación">
            <Campo nombre="fecha" etiqueta="Fecha" tipo="date" requerido />
            <Selector nombre="direccion" etiqueta="Sentido" requerido opciones={Object.entries(DIRECCIONES).map(([valor, texto]) => ({ valor, texto }))} />
            <Selector nombre="medio" etiqueta="Medio" defecto="correo" opciones={Object.entries(MEDIOS).map(([valor, texto]) => ({ valor, texto }))} />
            <Campo nombre="interlocutor" etiqueta="Con quién" placeholder="Aseguradora, mediador, perito…" />
            <Campo nombre="asunto" etiqueta="Asunto" />
            <Area nombre="resumen" etiqueta="Qué se dijo o pidió" filas={3} />
            {opcionesDoc.length > 0 && <Selector nombre="documento_id" etiqueta="Documento (opcional)" vacio="Ninguno" opciones={opcionesDoc} />}
            <div><Enviar>Registrar</Enviar></div>
          </Formulario>
          <p className="pequeno secundario" style={{ marginTop: 'var(--e-2)' }}>Las cartas y correos que subas como documentos se registran solos.</p>
        </section>
      </aside>
    </div>
  );
}

/** Recibos y pagos: últimos pagos, próximo cobro, histórico de importes y revisión de lo leído por la IA. */
export async function Recibos({ u, id, moneda, documentos }: { u: Usuario; id: string; moneda: string; documentos: Documento[] }) {
  const [recibos, sit] = await Promise.all([listarRecibos(u, id), situacionPagos(id)]);
  const opcionesDoc = documentos.map((d) => ({ valor: d.id, texto: `${TIPOS_DOCUMENTO[d.tipo]}: ${d.nombre_original}` }));
  const estados = Object.entries(ESTADOS_RECIBO).map(([valor, texto]) => ({ valor, texto }));
  const periodicidades = PERIODICIDADES.map((p) => ({ valor: p.valor, texto: p.texto }));
  const clase = { previsto: 'neutro', pendiente: 'proxima', pagado: 'vigente', devuelto: 'vencida', anulado: 'neutro' } as const;
  const campos = (r?: (typeof recibos)[number]) => (
    <>
      <div className="fila-2">
        <Campo nombre="periodo_desde" etiqueta="Periodo desde" tipo="date" defecto={r?.periodo_desde ?? ''} />
        <Campo nombre="periodo_hasta" etiqueta="Periodo hasta" tipo="date" defecto={r?.periodo_hasta ?? ''} />
      </div>
      <div className="fila-2">
        <Campo nombre="fecha_cargo" etiqueta="Fecha prevista de cobro" tipo="date" defecto={r?.fecha_cargo ?? ''} />
        <Campo nombre="fecha_pago" etiqueta="Fecha real de pago" tipo="date" defecto={r?.fecha_pago ?? ''} ayuda="Solo si consta el pago." />
      </div>
      <div className="fila-2">
        <Importe nombre="importe" etiqueta="Importe" defecto={r?.importe?.replace('.', ',') ?? ''} />
        <Selector nombre="periodicidad" etiqueta="Periodicidad" vacio="Sin indicar" defecto={r?.periodicidad ?? ''} opciones={periodicidades} />
      </div>
      <div className="fila-2">
        <Selector nombre="estado" etiqueta="Estado" defecto={r?.estado ?? 'pendiente'} opciones={estados} />
        <Campo nombre="numero" etiqueta="Nº de recibo" defecto={r?.numero ?? ''} />
      </div>
      {opcionesDoc.length > 0 && <Selector nombre="documento_id" etiqueta="Recibo (documento)" vacio="Ninguno" defecto={r?.documento_id ?? ''} opciones={opcionesDoc} />}
      {opcionesDoc.length > 0 && <Selector nombre="justificante_id" etiqueta="Justificante de pago" vacio="Ninguno" defecto={r?.justificante_id ?? ''} opciones={opcionesDoc} />}
      <Area nombre="notas" etiqueta="Notas" filas={2} defecto={r?.notas ?? ''} />
    </>
  );
  return (
    <div style={{ display: 'grid', gap: 'var(--e-4)' }}>
      <dl className="tarjeta datos-clave">
        <div><dt>Último pago acreditado</dt><dd>{sit.ultimos[0] ? <>{formatoImporte(sit.ultimos[0].importe, moneda)}<small>pagado el {fechaMedia(sit.ultimos[0].fecha_pago)}</small></> : <span className="pendiente">Sin pagos acreditados</span>}</dd></div>
        <div><dt>Próximo cobro</dt><dd>{sit.proximo ? <>{formatoImporte(sit.proximo.importe, moneda)}<small>{sit.proximo.fecha_cargo ? `previsto el ${fechaMedia(sit.proximo.fecha_cargo)}` : 'fecha de cobro sin confirmar'} · {ESTADOS_RECIBO[sit.proximo.estado as keyof typeof ESTADOS_RECIBO]}</small></> : <span className="pendiente">Sin recibos pendientes</span>}</dd></div>
        <div><dt>Recibos registrados</dt><dd>{recibos.filter((r) => r.estado !== 'anulado').length}<small>{recibos.filter((r) => !r.revisado).length ? `${recibos.filter((r) => !r.revisado).length} leídos por la IA sin revisar` : 'todos revisados'}</small></dd></div>
      </dl>
      <section className="tarjeta" aria-labelledby="t-recibos">
        <h2 id="t-recibos" className="tarjeta--pad" style={{ paddingBottom: 0 }}>Recibos y pagos</h2>
        {recibos.length === 0 ? <div className="vacio"><p>Sin recibos. Sube los recibos o justificantes en «Expediente» y se registran solos, o añádelos aquí.</p></div> : (
          <ul className="lista-simple">
            {recibos.map((r) => (
              <li key={r.id} id={`r-${r.id}`} style={{ display: 'block' }}>
                <div style={{ display: 'flex', gap: 'var(--e-3)', justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'baseline' }}>
                  <div>
                    <p style={{ fontWeight: 650 }}>{r.importe ? formatoImporte(r.importe, moneda) : 'Importe pendiente'}
                      {r.subida !== null && r.subida !== 0 && <span className={`estado estado--${r.subida > 0 ? 'vencida' : 'vigente'}`} style={{ marginLeft: 6 }}>{r.subida > 0 ? '▲' : '▼'} {String(Math.abs(r.subida)).replace('.', ',')} %</span>}
                      {' '}<span className={`estado estado--${clase[r.estado]}`}>{ESTADOS_RECIBO[r.estado]}</span>
                      {!r.revisado && <span className="estado estado--revisar" style={{ marginLeft: 6 }}>Leído por IA · revisar</span>}
                    </p>
                    <p className="linea-2">
                      {r.periodo_desde || r.periodo_hasta ? `Periodo ${fechaMedia(r.periodo_desde) || '¿?'} – ${fechaMedia(r.periodo_hasta) || '¿?'}` : 'Periodo sin indicar'}
                      {' · '}{r.fecha_cargo ? `cobro previsto ${fechaMedia(r.fecha_cargo)}` : 'cobro sin fecha'}
                      {r.fecha_pago ? ` · pagado ${fechaMedia(r.fecha_pago)}` : ''}{r.periodicidad ? ` · ${textoPeriodicidad(r.periodicidad)}` : ''}{r.numero ? ` · nº ${r.numero}` : ''}
                    </p>
                    <p className="linea-2">
                      {r.documento_id ? <a href={`/api/seguros/documentos/${r.documento_id}/`} target="_blank" rel="noopener">Recibo: {r.documento_nombre}</a> : 'Sin documento de recibo'}
                      {' · '}{r.justificante_id ? <a href={`/api/seguros/documentos/${r.justificante_id}/`} target="_blank" rel="noopener">Justificante: {r.justificante_nombre}</a> : 'sin justificante de pago'}
                    </p>
                  </div>
                </div>
                <details style={{ marginTop: 'var(--e-2)' }}>
                  <summary className="pequeno">Revisar o corregir</summary>
                  <Formulario accion={accionRecibo.bind(null, id, r.id)} aria="Editar recibo">{campos(r)}<div><Enviar>Guardar</Enviar></div></Formulario>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
      <details className="tarjeta tarjeta--pad">
        <summary style={{ fontWeight: 650 }}>Añadir recibo a mano</summary>
        <Formulario accion={accionRecibo.bind(null, id, null)} aria="Añadir recibo">{campos()}<div><Enviar>Añadir</Enviar></div></Formulario>
      </details>
      <p className="pequeno secundario">Un recibo emitido no es un pago: solo figura como pagado con su fecha real de pago (justificante o confirmación). La flecha indica la variación frente al recibo anterior de la misma periodicidad.</p>
    </div>
  );
}

/** Condiciones aplicables en una fecha (hoy, o la de un siniestro), con modificaciones y documentos de ese periodo. */
export async function CondicionesEnFecha({ u, id, fecha }: { u: Usuario; id: string; fecha?: string }) {
  const f = fecha && esFecha(fecha) ? fecha : hoyMadrid();
  const c = await condicionesEnFecha(u, id, f);
  const a = c.anualidad as (Anualidad & { garantias?: { texto: string; pagina?: number | null }[]; franquicias?: { texto: string }[]; exclusiones?: { texto: string }[] }) | null;
  return (
    <section className="tarjeta tarjeta--pad" aria-labelledby="t-cfecha">
      <form method="get" className="filtros" style={{ marginBottom: 'var(--e-3)' }}>
        <input type="hidden" name="pestana" value="condiciones" />
        <div className="campo"><label htmlFor="fecha-cond">Condiciones aplicables el</label><input id="fecha-cond" type="date" name="fecha" defaultValue={f} /></div>
        <button className="boton boton--oscuro" type="submit" style={{ alignSelf: 'flex-end' }}>Ver</button>
      </form>
      <h2 id="t-cfecha" style={{ marginBottom: 'var(--e-2)' }}>{c.vigente_hoy && f === hoyMadrid() ? 'Condiciones vigentes hoy' : `Condiciones aplicables el ${fechaMedia(f)}`}</h2>
      {!a ? <p className="aviso aviso--atencion">No hay ningún periodo de cobertura registrado que incluya esa fecha.</p> : (
        <>
          <p className="secundario pequeno">Periodo {periodoTexto(a)}{a.prima_anual ? ` · prima ${formatoImporte(a.prima_anual)}` : ''}{a.periodicidad ? ` · ${textoPeriodicidad(a.periodicidad)}` : ''}{!c.vigente_hoy ? ' · periodo anterior (histórico)' : ''}</p>
          {c.modificaciones.length > 0 && (
            <div style={{ marginTop: 'var(--e-3)' }}>
              <p style={{ fontWeight: 650 }}>Modificaciones con efecto hasta esa fecha</p>
              <ul className="lista-puntos pequeno">{c.modificaciones.map((m) => (
                <li key={m.id}>{m.fecha_efecto ? `${fechaMedia(m.fecha_efecto)}: ` : ''}{m.descripcion}
                  {m.documento_id && <> · <a href={`/api/seguros/documentos/${m.documento_id}/${m.pagina ? `#page=${m.pagina}` : ''}`} target="_blank" rel="noopener">documento{m.pagina ? `, pág. ${m.pagina}` : ''}</a></>}
                  {' '}<form action={accionAnularModificacion.bind(null, id, m.id)} style={{ display: 'inline' }}><button className="boton boton--peq boton--sutil" type="submit">Anular</button></form>
                </li>))}</ul>
            </div>
          )}
          {c.anteriores.length > 0 && (
            <div style={{ marginTop: 'var(--e-3)' }}>
              <p style={{ fontWeight: 650 }}>Modificaciones de periodos anteriores</p>
              <p className="pequeno secundario">Pueden seguir aplicando tras la renovación salvo que las condiciones del periodo digan otra cosa: compruébalo en sus documentos.</p>
              <ul className="lista-puntos pequeno">{c.anteriores.map((m) => (
                <li key={m.id}>{m.fecha_efecto ? `${fechaMedia(m.fecha_efecto)}: ` : ''}{m.descripcion}
                  {m.documento_id && <> · <a href={`/api/seguros/documentos/${m.documento_id}/${m.pagina ? `#page=${m.pagina}` : ''}`} target="_blank" rel="noopener">documento{m.pagina ? `, pág. ${m.pagina}` : ''}</a></>}
                </li>))}</ul>
            </div>
          )}
          {a.garantias && a.garantias.length > 0 && <p className="pequeno" style={{ marginTop: 'var(--e-2)' }}><strong>Garantías del periodo:</strong> {a.garantias.map((g) => g.texto).join('; ')}</p>}
          {a.franquicias && a.franquicias.length > 0 && <p className="pequeno"><strong>Franquicias:</strong> {a.franquicias.map((g) => g.texto).join('; ')}</p>}
          <p className="pequeno" style={{ marginTop: 'var(--e-2)' }}><strong>Documentos de condiciones de ese periodo:</strong> {c.documentos.length ? c.documentos.map((d, i) => <span key={d.id}>{i ? ', ' : ''}<a href={`/api/seguros/documentos/${d.id}/`} target="_blank" rel="noopener">{d.nombre_original}</a></span>) : 'ninguno registrado'}</p>
        </>
      )}
      <details style={{ marginTop: 'var(--e-3)' }}>
        <summary className="pequeno">Registrar una modificación de condiciones</summary>
        <Formulario accion={accionModificacion.bind(null, id)} aria="Registrar modificación">
          <Campo nombre="fecha_efecto" etiqueta="Fecha de efecto" tipo="date" />
          <Area nombre="descripcion" etiqueta="Qué cambia" filas={3} requerido />
          <div><Enviar>Registrar</Enviar></div>
        </Formulario>
      </details>
    </section>
  );
}

/** Editor de un documento: tipo, fecha, descripción, periodo y siniestro al que pertenece. */
export function EditarDocumento({ id, d, anualidades, sins }: { id: string; d: Documento; anualidades: Anualidad[]; sins: { id: string; titulo: string }[] }) {
  return (
    <details style={{ marginTop: 'var(--e-2)' }}>
      <summary className="pequeno">Clasificar</summary>
      <Formulario accion={accionDocumento.bind(null, id, d.id)} aria={`Clasificar ${d.nombre_original}`}>
        <div className="fila-2">
          <Selector nombre="tipo" etiqueta="Tipo" defecto={d.tipo} opciones={Object.entries(TIPOS_DOCUMENTO).map(([valor, texto]) => ({ valor, texto }))} />
          <Campo nombre="fecha_documento" etiqueta="Fecha del documento" tipo="date" defecto={d.fecha_documento ?? ''} />
        </div>
        <Campo nombre="descripcion" etiqueta="Descripción" defecto={d.descripcion ?? ''} />
        <div className="fila-2">
          <Selector nombre="anualidad_id" etiqueta="Periodo" vacio="Sin periodo" defecto={d.anualidad_id ?? ''} opciones={anualidades.map((a) => ({ valor: a.id, texto: periodoTexto(a) }))} />
          {sins.length > 0 && <Selector nombre="siniestro_id" etiqueta="Siniestro" vacio="Ninguno" defecto={d.siniestro_id ?? ''} opciones={sins.map((s) => ({ valor: s.id, texto: s.titulo }))} />}
        </div>
        <div><Enviar>Guardar</Enviar></div>
      </Formulario>
    </details>
  );
}
