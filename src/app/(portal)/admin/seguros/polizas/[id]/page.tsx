import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { exigirUsuario } from '@/seguros/lib/auth/servidor';
import { listarAnualidades, obtenerPoliza, ESTADOS_POLIZA, type Anualidad } from '@/seguros/lib/datos/polizas';
import { listarDocumentos, maxBytes, TIPOS_DOCUMENTO, type Documento } from '@/seguros/lib/datos/documentos';
import { situacion } from '@/seguros/lib/datos/panel';
import { NoEncontrado } from '@/seguros/lib/errores';
import { costeAnual, deCentimos, formatoImporte, textoPeriodicidad } from '@/seguros/lib/dinero';
import { fechaLarga, fechaMedia, hoyMadrid, textoDias } from '@/seguros/lib/fechas';
import { Estado, Revisar } from '@/seguros/components/estado';
import { IconoDocumento, IconoRamo, IconoTelefono } from '@/seguros/components/iconos';
import { accionEliminarDocumento } from '../acciones';
import { accionRenegociar } from '../lectura-acciones';
import { iaConfigurada } from '@/seguros/lib/ia/proveedor';
import { CondicionesEnFecha, EditarDocumento, Expediente, Recibos } from './expediente';
import { SubidaDirecta } from '@/seguros/components/subida-directa';
import { Importar } from '@/seguros/components/importar';
import type { Origen } from '@/seguros/lib/ia/importacion';
import { renovacionDeAnualidad } from '@/seguros/lib/datos/renovaciones';
import { q, q as consulta } from '@/seguros/lib/db';
import { ESTADOS_SINIESTRO } from '@/seguros/lib/datos/siniestros';

export const metadata: Metadata = { title: 'Póliza' };

const PESTANAS = [
  { clave: 'resumen', texto: 'Resumen' },
  { clave: 'expediente', texto: 'Expediente' },
  { clave: 'recibos', texto: 'Recibos y pagos' },
  { clave: 'condiciones', texto: 'Condiciones' },
  { clave: 'documentos', texto: 'Documentos' },
  { clave: 'siniestros', texto: 'Siniestros' },
  { clave: 'anualidades', texto: 'Periodos' },
] as const;

const ESTADO_DOC: Record<string, { texto: string; clase: string }> = {
  pendiente: { texto: 'Sin leer', clase: 'neutro' }, procesando: { texto: 'Leyendo…', clase: 'proxima' },
  revision: { texto: 'Datos por revisar', clase: 'revisar' }, confirmado: { texto: 'Datos confirmados', clase: 'vigente' }, error: { texto: 'Lectura fallida', clase: 'vencida' },
};

export default async function Ficha({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ pestana?: string; volver?: string; creada?: string; buscar?: string; clase?: string; fecha?: string }> }) {
  const { id } = await params;
  const { pestana = 'resumen', volver, creada, buscar, clase, fecha } = await searchParams;
  const u = await exigirUsuario();
  const p = await obtenerPoliza(u, id).catch((e) => { if (e instanceof NoEncontrado) notFound(); throw e; });
  const [anualidades, documentos] = await Promise.all([listarAnualidades(u, id), listarDocumentos(u, id)]);
  const hoy = hoyMadrid();
  // Anualidad actual: la vigente hoy; si no hay, la más reciente.
  const actual = anualidades.find((a) => a.inicio && a.inicio <= hoy && (!a.fin || a.fin > hoy)) ?? anualidades[0];
  const { situacion: sit, dias } = situacion({ estado: p.estado, fin: actual?.fin ?? null }, hoy);
  const coste = actual ? costeAnual(actual) : null;
  const renovacion = actual ? await renovacionDeAnualidad(actual.id) : null;
  const volverA = volver && volver.startsWith('/admin/seguros/') ? volver : '/admin/seguros/';
  const q = (k: string) => `/admin/seguros/polizas/${id}?pestana=${k}${volver ? `&volver=${encodeURIComponent(volverA)}` : ''}`;

  return (
    <>
      <div className="migas"><Link href={volverA}>← Pólizas</Link></div>
      {creada && <div className="aviso aviso--ok" role="status" style={{ marginBottom: 'var(--e-4)' }}>Póliza guardada. Ahora puedes adjuntar sus documentos.</div>}
      {p.archivada_en && <div className="aviso aviso--info" style={{ marginBottom: 'var(--e-4)' }}>Póliza archivada: no aparece en el panel ni en los totales.</div>}

      <div className="ficha-cab">
        <div className="titular-ramo" style={{ alignItems: 'flex-start' }}>
          <IconoRamo icono={p.ramo_icono} etiqueta={p.ramo_nombre} />
          <div>
            <span className="tpoliza__titular">{p.titular_nombre} · {p.titular_tipo === 'empresa' ? 'Empresa' : 'Particular'}</span>
            <h1>{p.nombre}</h1>
            <p className="secundario">{p.ramo_nombre} · {p.aseguradora}{p.numero ? ` · Nº ${p.numero}` : ''}</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 'var(--e-2)' }}>
              <Estado situacion={sit} />
              {actual && !actual.datos_confirmados && <Revisar />}
            </div>
          </div>
        </div>
        <div className="acciones">
          <Link className="boton" href={`/admin/seguros/polizas/${id}/editar`}>Editar</Link>
          <Link className="boton" href={`/admin/seguros/siniestros/nuevo?poliza=${id}`}>Comunicar siniestro</Link>
          {actual && renovacion ? <Link className="boton boton--oscuro" href={`/admin/seguros/renovaciones/${renovacion.id}`}>Renegociación</Link>
            : actual && <form action={accionRenegociar.bind(null, actual.id, undefined)}><button className="boton boton--oscuro" type="submit">Renegociar</button></form>}
        </div>
      </div>

      <dl className="tarjeta datos-clave">
        <div>
          <dt>Prima anual</dt>
          <dd>
            {coste ? formatoImporte(deCentimos(coste.centimos), p.moneda) : <span className="pendiente">Pendiente</span>}
            {coste?.tipo === 'estimado' && <small>estimada a partir del recibo</small>}
          </dd>
        </div>
        <div>
          <dt>Recibo</dt>
          <dd>
            {actual?.importe_recibo ? formatoImporte(actual.importe_recibo, p.moneda) : <span className="pendiente">Pendiente</span>}
            <small>{textoPeriodicidad(actual?.periodicidad) || 'Forma de pago pendiente'}</small>
          </dd>
        </div>
        <div>
          <dt>Vencimiento</dt>
          <dd>
            {actual?.fin ? fechaMedia(actual.fin) : <span className="pendiente">Pendiente</span>}
            {dias !== null && <small>{textoDias(dias)}</small>}
          </dd>
        </div>
        <div>
          <dt>Límite para oponerse a la prórroga</dt>
          <dd>
            {actual?.plazo_oposicion ? fechaMedia(actual.plazo_oposicion) : <span className="pendiente">No registrado</span>}
            {actual?.plazo_oposicion && <small>{actual.plazo_oposicion_confirmado ? `Comprobado · ${actual.plazo_oposicion_fuente}` : 'Sin comprobar en el contrato'}</small>}
          </dd>
        </div>
      </dl>

      <nav className="pestanas" aria-label="Secciones de la póliza">
        {PESTANAS.map((t) => (
          <Link key={t.clave} href={q(t.clave)} aria-current={pestana === t.clave ? 'page' : undefined} scroll={false}>
            {t.texto}{t.clave === 'documentos' ? ` (${documentos.length})` : t.clave === 'anualidades' ? ` (${anualidades.length})` : ''}
          </Link>
        ))}
      </nav>

      {pestana === 'expediente' ? <Expediente u={u} id={id} buscar={buscar} clase={clase} documentos={documentos} />
        : pestana === 'recibos' ? <Recibos u={u} id={id} moneda={p.moneda} documentos={documentos} />
        : pestana === 'condiciones' ? <><CondicionesEnFecha u={u} id={id} fecha={fecha} /><Condiciones id={id} actual={actual} documentos={documentos} /></>
        : pestana === 'siniestros' ? <SiniestrosPoliza id={id} />
        : pestana === 'anualidades' ? <Anualidades id={id} anualidades={anualidades} actualId={actual?.id} moneda={p.moneda} documentos={documentos} />
        : pestana === 'documentos' ? <Documentos id={id} documentos={documentos} anualidades={anualidades} sins={await consulta<{ id: string; titulo: string }>(`SELECT s.id, s.titulo FROM siniestros s JOIN siniestro_polizas sp ON sp.siniestro_id = s.id WHERE sp.poliza_id = $1 AND s.archivado_en IS NULL`, [id])} />
        : (
          <div className="dos-columnas">
            <section className="tarjeta tarjeta--pad" aria-labelledby="t-datos">
              <h2 id="t-datos" style={{ marginBottom: 'var(--e-4)' }}>Datos de la póliza</h2>
              <dl className="lista-datos">
                <dt>Titular</dt><dd>{p.titular_nombre}</dd>
                <dt>Tipo de seguro</dt><dd>{p.ramo_nombre}</dd>
                <dt>Objeto asegurado</dt><dd>{p.riesgo ?? <span className="pendiente">Sin indicar</span>}</dd>
                <dt>Aseguradora</dt><dd>{p.aseguradora}</dd>
                <dt>Número de póliza</dt><dd>{p.numero ?? <span className="pendiente">Pendiente</span>}</dd>
                <dt>Tomador</dt><dd>{p.tomador ?? <span className="pendiente">Sin indicar</span>}</dd>
                <dt>Asegurado</dt><dd>{p.asegurado ?? <span className="pendiente">Sin indicar</span>}</dd>
                {p.beneficiario && <><dt>Beneficiario</dt><dd>{p.beneficiario}</dd></>}
                <dt>Vigencia actual</dt><dd>{actual?.inicio || actual?.fin ? `${fechaLarga(actual?.inicio) || 'inicio pendiente'} – ${fechaLarga(actual?.fin) || 'vencimiento pendiente'}` : <span className="pendiente">Pendiente</span>}</dd>
                <dt>Renovación automática</dt><dd>{p.renovacion_automatica === null ? <span className="pendiente">No consta</span> : p.renovacion_automatica ? 'Sí' : 'No'}</dd>
                <dt>Estado</dt><dd>{ESTADOS_POLIZA[p.estado]}</dd>
                {p.moneda !== 'EUR' && <><dt>Moneda</dt><dd>{p.moneda}</dd></>}
                {p.notas && <><dt>Notas</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{p.notas}</dd></>}
              </dl>
            </section>
            <aside className="tarjeta tarjeta--pad contactos" aria-labelledby="t-contactos">
              <h2 id="t-contactos" style={{ marginBottom: 'var(--e-4)' }}>Contactos</h2>
              {!p.mediador && !p.mediador_telefono && !p.asistencia_telefono && !p.mediador_email && !p.siniestros_telefono && !p.siniestros_email && !p.siniestros_web
                ? <p className="secundario pequeno">Sin contactos todavía. Se completan al subir los documentos de la póliza.</p>
                : (
                  <div style={{ display: 'grid', gap: 'var(--e-4)' }}>
                    {(p.siniestros_telefono || p.siniestros_email || p.siniestros_web) && (
                      <div>
                        <p className="secundario pequeno">Comunicar un siniestro</p>
                        {p.siniestros_telefono && <><a className="boton boton--peq" style={{ marginTop: 6 }} href={`tel:${p.siniestros_telefono.replace(/[^\d+]/g, '')}`}><IconoTelefono /> {p.siniestros_telefono}</a><Procedencia o={p.origen_datos?.siniestros_telefono} /></>}
                        {p.siniestros_email && <p style={{ marginTop: 6 }}><a href={`mailto:${p.siniestros_email}`}>{p.siniestros_email}</a><Procedencia o={p.origen_datos?.siniestros_email} /></p>}
                        {p.siniestros_web && <p style={{ marginTop: 6 }}><a href={p.siniestros_web} target="_blank" rel="noopener noreferrer">Declarar en la web</a><Procedencia o={p.origen_datos?.siniestros_web} /></p>}
                      </div>
                    )}
                    {p.asistencia_telefono && (
                      <div>
                        <p className="secundario pequeno">Asistencia 24 horas</p>
                        <a className="boton boton--peq" style={{ marginTop: 6 }} href={`tel:${p.asistencia_telefono.replace(/[^\d+]/g, '')}`}><IconoTelefono /> {p.asistencia_telefono}</a>
                        <Procedencia o={p.origen_datos?.asistencia_telefono} />
                      </div>
                    )}
                    {(p.mediador || p.mediador_telefono || p.mediador_email) && (
                      <div>
                        <p className="secundario pequeno">Mediador</p>
                        {p.mediador && <p style={{ fontWeight: 700 }}>{p.mediador}</p>}
                        {p.mediador_telefono && <a className="boton boton--peq" style={{ marginTop: 6 }} href={`tel:${p.mediador_telefono.replace(/[^\d+]/g, '')}`}><IconoTelefono /> {p.mediador_telefono}</a>}
                        {p.mediador_email && <p style={{ marginTop: 6 }}><a href={`mailto:${p.mediador_email}`}>{p.mediador_email}</a></p>}
                      </div>
                    )}
                  </div>
                )}
            </aside>
          </div>
        )}
    </>
  );
}

function Anualidades({ id, anualidades, actualId, moneda, documentos }: { id: string; anualidades: Anualidad[]; actualId?: string; moneda: string; documentos: Documento[] }) {
  return (
    <section className="tarjeta" aria-label="Anualidades">
      <div className="bloque__titulo" style={{ padding: 'var(--e-4) var(--e-4) 0' }}>
        <p className="secundario pequeno">Cada renovación es una anualidad nueva; las anteriores se conservan con sus documentos.</p>
        <Link className="boton boton--peq boton--oscuro" href={`/admin/seguros/polizas/${id}/anualidades/nueva`}>Registrar renovación</Link>
      </div>
      <ul className="lista-simple">
        {anualidades.map((a, i) => {
          const c = costeAnual(a);
          const anterior = anualidades[i + 1];
          const cAnt = anterior ? costeAnual(anterior) : null;
          const variacion = c && cAnt && cAnt.centimos > 0 ? ((c.centimos - cAnt.centimos) / cAnt.centimos) * 100 : null;
          const docs = documentos.filter((d) => d.anualidad_id === a.id).length;
          return (
            <li key={a.id}>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontWeight: 700 }}>
                  {a.inicio || a.fin ? `${fechaMedia(a.inicio) || 'Inicio pendiente'} – ${fechaMedia(a.fin) || 'vencimiento pendiente'}` : 'Fechas pendientes'}
                  {a.id === actualId && <span className="estado estado--neutro" style={{ marginLeft: 8 }}>Actual</span>}
                  {!a.datos_confirmados && <span style={{ marginLeft: 6 }}><Revisar /></span>}
                </p>
                <p className="linea-2">
                  {c ? `${formatoImporte(deCentimos(c.centimos), moneda)} al año${c.tipo === 'estimado' ? ' (estimado)' : ''}` : 'Prima pendiente'}
                  {variacion !== null && ` · ${variacion >= 0 ? '+' : ''}${variacion.toFixed(1).replace('.', ',')} % respecto a la anterior`}
                  {a.periodicidad && ` · ${textoPeriodicidad(a.periodicidad)}`}
                  {` · ${docs} ${docs === 1 ? 'documento' : 'documentos'}`}
                </p>
              </div>
              <Link className="boton boton--peq" href={`/admin/seguros/polizas/${id}/anualidades/${a.id}`}>Corregir</Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Documentos({ id, documentos, anualidades, sins }: { id: string; documentos: Documento[]; anualidades: Anualidad[]; sins: { id: string; titulo: string }[] }) {
  const opcionesAnualidad = anualidades.map((a) => ({ valor: a.id, texto: a.inicio || a.fin ? `${fechaMedia(a.inicio) || '¿?'} – ${fechaMedia(a.fin) || '¿?'}` : 'Fechas pendientes' }));
  const tamano = (b: string) => { const n = Number(b); return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(n / 1024))} KB`; };
  return (
    <div className="dos-columnas">
      <section className="tarjeta" aria-label="Documentos de la póliza">
        {documentos.length === 0 ? (
          <div className="vacio">
            <h2>Sin documentos</h2>
            <p>Adjunta la póliza, las condiciones generales, los suplementos y los recibos. Se guardan en un almacén privado.</p>
          </div>
        ) : (
          <ul className="lista-simple">
            {documentos.map((d) => {
              const anualidad = opcionesAnualidad.find((o) => o.valor === d.anualidad_id);
              return (
                <li key={d.id}>
                  <div className="titular-ramo" style={{ minWidth: 0, flex: 1 }}>
                    <span className="icono-ramo"><IconoDocumento /></span>
                    <div style={{ minWidth: 0 }}>
                      <a href={`/api/seguros/documentos/${d.id}`} target="_blank" rel="noopener" style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{d.nombre_original}</a>
                      <p className="linea-2">
                        {TIPOS_DOCUMENTO[d.tipo]}{d.fecha_documento ? ` · ${fechaMedia(d.fecha_documento)}` : ''}{anualidad ? ` · periodo ${anualidad.texto}` : ''} · {tamano(d.bytes)} · subido {fechaMedia(hoyMadrid(new Date(d.subido_en)))}
                      </p>
                      {d.descripcion && <p className="linea-2">{d.descripcion}</p>}
                      {d.siniestro_id && <p className="linea-2"><Link href={`/admin/seguros/siniestros/${d.siniestro_id}`}>Vinculado a un siniestro</Link></p>}
                      {d.duplicado_de && <p className="linea-2" style={{ color: 'var(--color-aviso-texto)' }}>Idéntico a «{d.duplicado_de}»</p>}
                      <span className={`estado estado--${ESTADO_DOC[d.estado]?.clase ?? 'neutro'}`} style={{ marginTop: 4 }}>{ESTADO_DOC[d.estado]?.texto ?? d.estado}</span>
                      <EditarDocumento id={id} d={d} anualidades={anualidades} sins={sins} />
                    </div>
                  </div>
                  <div className="acciones">
                    <Link className="boton boton--peq" href={`/admin/seguros/polizas/${id}/documentos/${d.id}`}>{d.estado === 'revision' ? 'Revisar datos' : 'Ver y leer'}</Link>
                    <a className="boton boton--peq boton--sutil" href={`/api/seguros/documentos/${d.id}?descargar=1`}>Descargar</a>
                    <form action={accionEliminarDocumento.bind(null, d.id)}>
                      <button className="boton boton--peq boton--sutil" type="submit" aria-label={`Eliminar ${d.nombre_original}`}>Eliminar</button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <aside className="tarjeta tarjeta--pad" aria-labelledby="t-subir">
        <h2 id="t-subir" style={{ marginBottom: 'var(--e-4)' }}>Adjuntar documentos</h2>
        <a className="boton boton--peq boton--sutil" href={`/api/seguros/exportar/poliza/${id}`} style={{ marginBottom: 'var(--e-4)' }}>Descargar todo (ZIP)</a>
        {iaConfigurada() ? <Importar polizaId={id} compacto /> : (
          <SubidaDirecta destino="poliza" id={id} tipos={Object.entries(TIPOS_DOCUMENTO).map(([valor, texto]) => ({ valor, texto }))} tipoDefecto="condiciones_particulares"
            anualidades={opcionesAnualidad} anualidadDefecto={anualidades[0]?.id ?? ''}
            ayuda={`PDF o foto (JPEG, PNG, WebP, HEIC). Máximo ${Math.round(maxBytes() / 1024 / 1024)} MB por archivo.`} />
        )}
        <p className="ayuda secundario pequeno" style={{ marginTop: 'var(--e-3)' }}>Después, abre el documento y pulsa «Leer datos» para que se propongan los datos con su página; tú los confirmas.</p>
      </aside>
    </div>
  );
}

type Item = { texto: string; documento_id?: string; pagina?: number | null; cita?: string | null };

function Condiciones({ id, actual, documentos }: { id: string; actual?: Anualidad & { garantias?: Item[] | null; exclusiones?: Item[] | null; franquicias?: Item[] | null; capitales?: Item[] | null }; documentos: Documento[] }) {
  const grupos = [['garantias', 'Garantías'], ['capitales', 'Capitales y límites'], ['franquicias', 'Franquicias'], ['exclusiones', 'Exclusiones']] as const;
  const vacio = !actual || grupos.every(([k]) => !actual[k]?.length);
  const faltan = [
    !documentos.some((d) => d.tipo === 'condiciones_particulares') && 'condiciones particulares',
    !documentos.some((d) => d.tipo === 'condiciones_generales') && 'condiciones generales',
  ].filter(Boolean);
  return (
    <div style={{ display: 'grid', gap: 'var(--e-4)' }}>
      {faltan.length > 0 && <div className="aviso aviso--atencion">Faltan las {faltan.join(' y ')}. Súbelas en «Documentos»: el asistente de siniestros las necesita.</div>}
      {vacio ? (
        <div className="tarjeta vacio"><h2>Sin resumen de condiciones</h2><p>Abre las condiciones en «Documentos», pulsa «Leer datos» y confirma las garantías, franquicias y exclusiones. Cada una queda enlazada a su página.</p></div>
      ) : (
        <div className="rejilla">
          {grupos.filter(([k]) => actual![k]?.length).map(([k, t]) => (
            <section key={k} className="tarjeta tarjeta--pad" aria-label={t}>
              <h2 style={{ marginBottom: 'var(--e-3)' }}>{t}</h2>
              <ul className="lista-puntos">
                {actual![k]!.map((x, i) => (
                  <li key={i}>{x.texto}{x.documento_id && x.pagina ? <> · <a className="pequeno" href={`/api/seguros/documentos/${x.documento_id}#page=${x.pagina}`} target="_blank" rel="noopener">pág. {x.pagina}</a></> : ''}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      <p className="pequeno secundario">Resumen de la anualidad actual. <Link href={`/admin/seguros/polizas/${id}?pestana=anualidades`}>Ver otras anualidades</Link>.</p>
    </div>
  );
}

async function SiniestrosPoliza({ id }: { id: string }) {
  const lista = await q<{ id: string; titulo: string; fecha_hecho: string | null; estado: keyof typeof ESTADOS_SINIESTRO }>(
    'SELECT s.id, s.titulo, s.fecha_hecho, s.estado FROM siniestros s JOIN siniestro_polizas sp ON sp.siniestro_id = s.id WHERE sp.poliza_id = $1 AND s.archivado_en IS NULL ORDER BY s.fecha_hecho DESC NULLS LAST', [id],
  );
  return (
    <div className="tarjeta">
      {lista.length === 0 ? <div className="vacio"><h2>Sin siniestros</h2><p>Si ocurre algo, comunícalo desde aquí.</p><Link className="boton boton--principal" href={`/admin/seguros/siniestros/nuevo?poliza=${id}`}>Comunicar siniestro</Link></div> : (
        <ul className="lista-simple">{lista.map((s) => <li key={s.id}><div><Link href={`/admin/seguros/siniestros/${s.id}`} style={{ fontWeight: 700 }}>{s.titulo}</Link><p className="linea-2">{s.fecha_hecho ? fechaMedia(s.fecha_hecho) : 'Fecha pendiente'}</p></div><span className="estado estado--neutro">{ESTADOS_SINIESTRO[s.estado]}</span></li>)}</ul>
      )}
    </div>
  );
}

/** De dónde sale un dato guardado automáticamente: documento y página, o página web consultada. */
function Procedencia({ o }: { o?: Origen }) {
  if (!o) return null;
  return (
    <span className="origen" style={{ display: 'block', marginTop: 4 }}>
      {o.origen === 'documento'
        ? <>Según {o.documento_id ? <a href={`/api/seguros/documentos/${o.documento_id}/${o.pagina ? `#page=${o.pagina}` : ''}`} target="_blank" rel="noopener">{o.documento}</a> : o.documento}{o.pagina ? `, pág. ${o.pagina}` : ''}</>
        : <>Encontrado en internet: <a href={o.url} target="_blank" rel="noopener noreferrer">{(() => { try { return new URL(o.url).hostname.replace(/^www\./, ''); } catch { return o.titulo; } })()}</a> ({o.fecha.split('-').reverse().join('/')})</>}
    </span>
  );
}
