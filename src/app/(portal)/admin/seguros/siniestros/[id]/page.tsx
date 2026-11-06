import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { exigirUsuario } from '@/seguros/lib/auth/servidor';
import {
  archivosSiniestro, borradores, ESTADOS_SINIESTRO, eventos, obtenerSiniestro, polizasCandidatas, polizasDelSiniestro, TIPOS_ARCHIVO_SINIESTRO,
} from '@/seguros/lib/datos/siniestros';
import { documentosDeSiniestro } from '@/seguros/lib/datos/expediente';
import { TIPOS_DOCUMENTO } from '@/seguros/lib/datos/documentos';
import { analisisDe, revisarPreparacion } from '@/seguros/lib/ia/siniestro';
import { iaConfigurada } from '@/seguros/lib/ia/proveedor';
import { NoEncontrado } from '@/seguros/lib/errores';
import { fechaLarga, fechaMedia, hoyMadrid } from '@/seguros/lib/fechas';
import { formatoImporte } from '@/seguros/lib/dinero';
import { Area, Campo, CampoArchivo, Enviar, Formulario, Importe, Selector } from '@/seguros/components/formulario';
import { BotonCopiar, Refrescar } from '@/seguros/components/copiar';
import { IconoDocumento, IconoTelefono } from '@/seguros/components/iconos';
import { Preparacion, Resultado, Valoracion } from './analisis';
import { subidaDirecta } from '@/seguros/lib/almacen';
import { SubidaDirecta } from '@/seguros/components/subida-directa';
import {
  accionAnalizar, accionAnualidad, accionEliminarArchivo, accionEvento, accionGuardarBorrador, accionPlantilla, accionPolizas, accionSeguimiento, accionSubirArchivo,
} from '../acciones';

// El análisis o la lectura con IA se ejecutan tras responder y pueden tardar más de un minuto.
export const maxDuration = 300;

export const metadata: Metadata = { title: 'Siniestro' };

const PESTANAS = [
  { clave: 'hechos', texto: 'Hechos y póliza' },
  { clave: 'analisis', texto: 'Análisis' },
  { clave: 'borrador', texto: 'Comunicación' },
  { clave: 'archivos', texto: 'Archivos' },
  { clave: 'seguimiento', texto: 'Seguimiento' },
] as const;

export default async function FichaSiniestro({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ pestana?: string; version?: string }> }) {
  const { id } = await params;
  const { pestana = 'hechos', version } = await searchParams;
  const u = await exigirUsuario();
  const s = await obtenerSiniestro(u, id).catch((e) => { if (e instanceof NoEncontrado) notFound(); throw e; });
  const [polizas, analisis] = await Promise.all([polizasDelSiniestro(u, id), analisisDe(u, id)]);
  const enCurso = analisis.some((a) => a.estado === 'pendiente' || a.estado === 'procesando');

  return (
    <>
      <div className="migas"><Link href="/admin/seguros/siniestros">← Siniestros</Link></div>
      <div className="ficha-cab">
        <div>
          <span className="tpoliza__titular">{s.titular}</span>
          <h1>{s.titulo}</h1>
          <p className="secundario">{s.fecha_hecho ? fechaLarga(s.fecha_hecho) : 'Fecha del hecho pendiente'}{s.lugar ? ` · ${s.lugar}` : ''}</p>
          <div style={{ display: 'flex', gap: 6, marginTop: 'var(--e-2)', flexWrap: 'wrap' }}>
            <span className="estado estado--neutro">{ESTADOS_SINIESTRO[s.estado]}</span>
            {analisis[0]?.resultado && <Valoracion v={analisis[0].resultado.valoracion_global} />}
          </div>
        </div>
        <div className="acciones">
          <Link className="boton" href={`/admin/seguros/siniestros/${id}/editar`}>Editar hechos</Link>
          <a className="boton boton--sutil" href={`/api/seguros/exportar/siniestro/${id}`}>Descargar expediente</a>
          {polizas.find((p) => p.asistencia_telefono) && (
            <a className="boton boton--oscuro" href={`tel:${polizas.find((p) => p.asistencia_telefono)!.asistencia_telefono!.replace(/[^\d+]/g, '')}`}><IconoTelefono /> Asistencia</a>
          )}
        </div>
      </div>

      <nav className="pestanas" aria-label="Secciones del siniestro">
        {PESTANAS.map((t) => <Link key={t.clave} href={`/admin/seguros/siniestros/${id}?pestana=${t.clave}`} aria-current={pestana === t.clave ? 'page' : undefined} scroll={false}>{t.texto}{t.clave === 'analisis' && analisis.length ? ` (${analisis.length})` : ''}</Link>)}
      </nav>

      {pestana === 'analisis' ? <Analisis id={id} analisis={analisis} version={version} enCurso={enCurso} />
        : pestana === 'borrador' ? <Borrador id={id} />
        : pestana === 'archivos' ? <Archivos id={id} />
        : pestana === 'seguimiento' ? <Seguimiento id={id} />
        : <Hechos id={id} />}
    </>
  );

  async function Hechos({ id }: { id: string }) {
    const candidatas = await polizasCandidatas(u, id);
    return (
      <div className="dos-columnas">
        <section className="tarjeta tarjeta--pad" aria-labelledby="t-hechos">
          <h2 id="t-hechos" style={{ marginBottom: 'var(--e-4)' }}>Hechos</h2>
          <p style={{ whiteSpace: 'pre-wrap', marginBottom: 'var(--e-4)' }}>{s.relato}</p>
          <dl className="lista-datos">
            <dt>Fecha del hecho</dt><dd>{s.fecha_hecho ? fechaLarga(s.fecha_hecho) : <span className="pendiente">Pendiente</span>}</dd>
            <dt>Fecha de conocimiento</dt><dd>{s.fecha_conocimiento ? fechaLarga(s.fecha_conocimiento) : <span className="pendiente">Sin indicar</span>}</dd>
            <dt>Bien afectado</dt><dd>{s.riesgo_afectado ?? <span className="pendiente">Sin indicar</span>}</dd>
            <dt>Daños</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{s.danos ?? <span className="pendiente">Sin indicar</span>}</dd>
            {s.terceros && <><dt>Terceros</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{s.terceros}</dd></>}
            {s.importe_estimado && <><dt>Importe estimado</dt><dd>{formatoImporte(s.importe_estimado)}</dd></>}
            {s.pruebas && <><dt>Pruebas</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{s.pruebas}</dd></>}
          </dl>
        </section>
        <aside className="tarjeta tarjeta--pad" aria-labelledby="t-pol">
          <h2 id="t-pol" style={{ marginBottom: 'var(--e-3)' }}>Póliza aplicable</h2>
          <p className="pequeno secundario" style={{ marginBottom: 'var(--e-4)' }}>Se usan las condiciones de la anualidad vigente el día del hecho, aunque la póliza se haya renovado después.</p>
          {polizas.map((p) => (
            <div key={p.poliza_id} className="bloque-cita">
              <p><Link href={`/admin/seguros/polizas/${p.poliza_id}`} style={{ fontWeight: 700 }}>{p.nombre}</Link> <span className="secundario pequeno">· {p.aseguradora}</span></p>
              <Formulario accion={accionAnualidad.bind(null, id, p.poliza_id)} className="" aria={`Anualidad de ${p.nombre}`}>
                <div style={{ display: 'flex', gap: 'var(--e-2)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <Selector nombre="anualidad_id" etiqueta="Anualidad" defecto={p.anualidad_id ?? ''} vacio="Sin elegir"
                    opciones={p.anualidades.map((a) => ({ valor: a.id, texto: `${fechaMedia(a.inicio) || '¿?'} – ${fechaMedia(a.fin) || '¿?'}${s.fecha_hecho && a.inicio && a.inicio <= s.fecha_hecho && (!a.fin || a.fin > s.fecha_hecho) ? ' (vigente el día del hecho)' : ''}` }))} />
                  <Enviar className="boton boton--peq">Guardar</Enviar>
                </div>
              </Formulario>
            </div>
          ))}
          <Formulario accion={accionPolizas.bind(null, id)} aria="Pólizas candidatas" className="form">
            <fieldset style={{ marginTop: 'var(--e-4)' }}>
              <legend className="pequeno" style={{ fontSize: 'var(--texto-s)', fontWeight: 700 }}>Pólizas que pueden cubrirlo</legend>
              {candidatas.length === 0 && <p className="pequeno secundario">Este titular aún no tiene pólizas.</p>}
              {candidatas.map((c) => (
                <label key={c.id} className="casilla"><input type="checkbox" name="poliza" value={c.id} defaultChecked={c.ya} />
                  <span>{c.nombre} <span className="secundario">· {c.ramo} · {c.aseguradora}{c.vigente ? ' · vigente ese día' : s.fecha_hecho ? ' · sin anualidad ese día' : ''}</span></span>
                </label>
              ))}
            </fieldset>
            <div><Enviar className="boton boton--peq">Actualizar pólizas</Enviar></div>
          </Formulario>
        </aside>
      </div>
    );
  }

  async function Analisis({ id, analisis, version, enCurso }: { id: string; analisis: Awaited<ReturnType<typeof analisisDe>>; version?: string; enCurso: boolean }) {
    const prep = await revisarPreparacion(u, id);
    const elegido = analisis.find((a) => String(a.version) === version) ?? analisis[0];
    const ia = iaConfigurada();
    const bloqueado = prep.faltan.some((f) => f.tipo === 'bloqueo');
    return (
      <div className="dos-columnas">
        <section className="tarjeta tarjeta--pad" aria-labelledby="t-res">
          <div className="bloque__titulo">
            <h2 id="t-res">{elegido ? `Análisis v${elegido.version}` : 'Análisis de cobertura'}</h2>
            {elegido && <span className="pequeno secundario">{new Date(elegido.creado_en).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}{elegido.modelo ? ` · ${elegido.modelo}` : ''}</span>}
          </div>
          <Refrescar activo={enCurso} />
          {!elegido && <p className="secundario">Todavía no hay análisis. Revisa a la derecha qué documentos se usarán y qué falta.</p>}
          {elegido?.estado === 'error' && <div className="aviso aviso--error">No se ha podido completar el análisis: {elegido.error}. Puedes volver a intentarlo.</div>}
          {elegido?.resultado && <Resultado r={elegido.resultado} docs={elegido.documentos} />}
          {analisis.length > 1 && (
            <p className="pequeno" style={{ marginTop: 'var(--e-5)' }}>Versiones anteriores: {analisis.map((a) => <Link key={a.id} href={`/admin/seguros/siniestros/${id}?pestana=analisis&version=${a.version}`} style={{ marginRight: 8 }}>v{a.version}</Link>)}</p>
          )}
        </section>
        <aside className="tarjeta tarjeta--pad" aria-labelledby="t-prep">
          <h2 id="t-prep" style={{ marginBottom: 'var(--e-3)' }}>Antes de analizar</h2>
          <Preparacion faltan={prep.faltan} docs={prep.documentos} />
          <div style={{ marginTop: 'var(--e-4)' }}>
            {!ia ? (
              <div className="aviso aviso--atencion" style={{ display: 'block' }}>
                <p><strong>Asistente con IA sin configurar.</strong> El expediente funciona igual: puedes preparar la comunicación con la plantilla.</p>
                <p className="pequeno" style={{ marginTop: 6 }}>Para activarlo, el administrador debe definir <code>ANTHROPIC_API_KEY</code> en el servidor.</p>
              </div>
            ) : (
              <Formulario accion={accionAnalizar.bind(null, id)} className="" aria="Analizar">
                <Enviar className="boton boton--principal" pendiente="Enviando…">{analisis.length ? 'Volver a analizar' : 'Analizar cobertura'}</Enviar>
                {bloqueado && <p className="pequeno secundario" style={{ marginTop: 6 }}>Resuelve antes lo marcado en rojo.</p>}
                <p className="pequeno secundario" style={{ marginTop: 'var(--e-3)' }}>Se envían al proveedor de IA el relato y los documentos indicados. Ver docs/SEGURIDAD.md.</p>
              </Formulario>
            )}
          </div>
        </aside>
      </div>
    );
  }

  async function Borrador({ id }: { id: string }) {
    const lista = await borradores(u, id);
    const ultimo = lista[0];
    return (
      <div className="dos-columnas">
        <section className="tarjeta tarjeta--pad" aria-labelledby="t-bor">
          <div className="bloque__titulo">
            <h2 id="t-bor">Comunicación a la aseguradora</h2>
            {ultimo && <BotonCopiar texto={ultimo.texto} />}
          </div>
          <div className="aviso aviso--info" style={{ marginBottom: 'var(--e-4)' }}>Revisa que cada hecho sea cierto y completa lo que está entre corchetes. La aplicación no envía nada: tú decides cuándo y cómo comunicarlo.</div>
          {ultimo ? (
            <Formulario accion={accionGuardarBorrador.bind(null, id)} aria="Editar comunicación">
              <label className="sr" htmlFor="texto-borrador">Texto</label>
              <textarea id="texto-borrador" className="borrador" name="texto" defaultValue={ultimo.texto} />
              <div className="acciones"><Enviar>Guardar como nueva versión</Enviar></div>
            </Formulario>
          ) : <p className="secundario">Aún no hay borrador. Genera uno con la plantilla o con el análisis.</p>}
        </section>
        <aside className="tarjeta tarjeta--pad" aria-labelledby="t-ver">
          <h2 id="t-ver" style={{ marginBottom: 'var(--e-3)' }}>Versiones</h2>
          <form action={accionPlantilla.bind(null, id)} style={{ marginBottom: 'var(--e-4)' }}>
            <button className="boton" type="submit">Nueva desde la plantilla</button>
            <p className="pequeno secundario" style={{ marginTop: 6 }}>Ordena solo los datos que has escrito; sin IA.</p>
          </form>
          <ul className="lista-simple">
            {lista.map((b) => <li key={b.id} style={{ padding: 'var(--e-2) 0' }}><span className="pequeno">{new Date(b.creado_en).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })} · {b.origen === 'asistente' ? 'asistente' : b.origen === 'plantilla' ? 'plantilla' : `editado${b.autor ? ` por ${b.autor}` : ''}`}</span></li>)}
          </ul>
        </aside>
      </div>
    );
  }

  async function Archivos({ id }: { id: string }) {
    const [lista, delSeguro] = await Promise.all([archivosSiniestro(u, id), documentosDeSiniestro(id)]);
    return (
      <div className="dos-columnas">
        <div style={{ display: 'grid', gap: 'var(--e-4)', alignContent: 'start' }}>
        {delSeguro.length > 0 && (
          <section className="tarjeta" aria-label="Documentos del seguro vinculados a este siniestro">
            <h2 className="tarjeta--pad" style={{ paddingBottom: 0, fontSize: 'var(--texto-m)' }}>Del expediente del seguro</h2>
            <ul className="lista-simple">{delSeguro.map((d) => (
              <li key={d.id}><div style={{ minWidth: 0 }}>
                <a href={`/api/seguros/documentos/${d.id}/`} target="_blank" rel="noopener" style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{d.nombre_original}</a>
                <p className="linea-2">{TIPOS_DOCUMENTO[d.tipo as keyof typeof TIPOS_DOCUMENTO] ?? d.tipo}{d.fecha_documento ? ` · ${fechaMedia(d.fecha_documento)}` : ''} · <Link href={`/admin/seguros/polizas/${d.poliza_id}?pestana=documentos`}>en el seguro</Link></p>
              </div></li>))}</ul>
          </section>
        )}
        <section className="tarjeta" aria-label="Archivos del siniestro">
          {lista.length === 0 ? <div className="vacio"><h2>Sin archivos</h2><p>Añade fotos, el parte, presupuestos o las comunicaciones con la aseguradora.</p></div> : (
            <ul className="lista-simple">
              {lista.map((a) => (
                <li key={a.id}>
                  <div className="titular-ramo" style={{ minWidth: 0, flex: 1 }}>
                    <span className="icono-ramo"><IconoDocumento /></span>
                    <div style={{ minWidth: 0 }}>
                      <a href={`/api/seguros/siniestros/archivos/${a.id}`} target="_blank" rel="noopener" style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{a.nombre_original}</a>
                      <p className="linea-2">{TIPOS_ARCHIVO_SINIESTRO[a.tipo]} · {fechaMedia(hoyMadrid(new Date(a.subido_en)))}</p>
                    </div>
                  </div>
                  <form action={accionEliminarArchivo.bind(null, a.id)}><button className="boton boton--peq boton--sutil" type="submit" aria-label={`Eliminar ${a.nombre_original}`}>Eliminar</button></form>
                </li>
              ))}
            </ul>
          )}
        </section>
        </div>
        <aside className="tarjeta tarjeta--pad" aria-labelledby="t-subir-s">
          <h2 id="t-subir-s" style={{ marginBottom: 'var(--e-4)' }}>Añadir archivos</h2>
          {subidaDirecta() ? (
            <SubidaDirecta destino="siniestro" id={id} tipos={Object.entries(TIPOS_ARCHIVO_SINIESTRO).map(([valor, texto]) => ({ valor, texto }))} tipoDefecto="foto" ayuda="Fotos o PDF. Se guardan en el almacén privado." />
          ) : (
            <Formulario accion={accionSubirArchivo.bind(null, id)} encType="multipart/form-data" aria="Añadir archivos">
              <CampoArchivo nombre="archivo" etiqueta="Archivos" multiple accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,.heic" ayuda="Fotos o PDF. Se guardan en el almacén privado." />
              <Selector nombre="tipo" etiqueta="Tipo" defecto="foto" opciones={Object.entries(TIPOS_ARCHIVO_SINIESTRO).map(([valor, texto]) => ({ valor, texto }))} />
              <Enviar pendiente="Subiendo…">Subir</Enviar>
            </Formulario>
          )}
        </aside>
      </div>
    );
  }

  async function Seguimiento({ id }: { id: string }) {
    const lista = await eventos(u, id);
    const pagado = lista.filter((e) => e.tipo === 'pago' && e.importe).reduce((t, e) => t + Number(e.importe), 0);
    return (
      <div className="dos-columnas">
        <section className="tarjeta tarjeta--pad" aria-labelledby="t-seg">
          <h2 id="t-seg" style={{ marginBottom: 'var(--e-4)' }}>Historial</h2>
          {pagado > 0 && <p style={{ marginBottom: 'var(--e-3)' }}>Cobrado: <strong className="cifra">{formatoImporte(pagado)}</strong></p>}
          <ul className="lista-simple">
            {lista.map((e) => (
              <li key={e.id} style={{ display: 'block' }}>
                <p className="pequeno secundario">{fechaMedia(e.fecha)} · {{ estado: 'Estado', nota: 'Nota', comunicacion: 'Comunicación', pago: 'Pago' }[e.tipo]}{e.autor ? ` · ${e.autor}` : ''}</p>
                <p style={{ whiteSpace: 'pre-wrap' }}>{e.texto}{e.importe ? ` · ${formatoImporte(e.importe)}` : ''}</p>
              </li>
            ))}
          </ul>
        </section>
        <aside style={{ display: 'grid', gap: 'var(--e-5)' }}>
          <div className="tarjeta tarjeta--pad">
            <h2 style={{ marginBottom: 'var(--e-4)' }}>Estado</h2>
            <Formulario accion={accionSeguimiento.bind(null, id)} aria="Estado del siniestro">
              <Selector nombre="estado" etiqueta="Estado" defecto={s.estado} opciones={Object.entries(ESTADOS_SINIESTRO).map(([valor, texto]) => ({ valor, texto }))} />
              <Campo nombre="referencia_aseguradora" etiqueta="Referencia de la aseguradora" defecto={s.referencia_aseguradora} />
              <Campo nombre="plazo_comunicacion" etiqueta="Plazo para comunicarlo" tipo="date" defecto={s.plazo_comunicacion} ayuda="Solo si consta en la póliza." />
              <Campo nombre="plazo_comunicacion_fuente" etiqueta="Fuente del plazo" defecto={s.plazo_comunicacion_fuente} placeholder="Documento, cláusula y página" />
              <div><Enviar>Guardar</Enviar></div>
            </Formulario>
          </div>
          <div className="tarjeta tarjeta--pad">
            <h2 style={{ marginBottom: 'var(--e-4)' }}>Anotar</h2>
            <Formulario accion={accionEvento.bind(null, id)} aria="Anotar en el historial">
              <Selector nombre="tipo" etiqueta="Tipo" defecto="nota" opciones={[{ valor: 'nota', texto: 'Nota' }, { valor: 'comunicacion', texto: 'Comunicación enviada o recibida' }, { valor: 'pago', texto: 'Pago recibido' }]} />
              <Campo nombre="fecha" etiqueta="Fecha" tipo="date" defecto={hoyMadrid()} />
              <Area nombre="texto" etiqueta="Detalle" filas={2} />
              <Importe nombre="importe" etiqueta="Importe (si es un pago)" />
              <div><Enviar>Anotar</Enviar></div>
            </Formulario>
          </div>
        </aside>
      </div>
    );
  }
}
