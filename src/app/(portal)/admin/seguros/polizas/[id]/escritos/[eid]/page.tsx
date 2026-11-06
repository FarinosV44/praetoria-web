import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { exigirUsuario } from '@/seguros/lib/auth/servidor';
import { ESTADOS_ESCRITO, obtenerEscrito, TIPOS_ESCRITO } from '@/seguros/lib/datos/escritos';
import { MEDIOS } from '@/seguros/lib/datos/expediente';
import { obtenerPoliza } from '@/seguros/lib/datos/polizas';
import { NoEncontrado } from '@/seguros/lib/errores';
import { fechaMedia, hoyMadrid } from '@/seguros/lib/fechas';
import { q } from '@/seguros/lib/db';
import { Area, Campo, Enviar, Formulario, Selector } from '@/seguros/components/formulario';
import { BotonCopiar } from '@/seguros/components/copiar';
import { Citas } from '../../asistente';
import { accionDescartar, accionEnvio, accionRespuesta, accionVersion } from '../../../asistente-acciones';

export const metadata: Metadata = { title: 'Escrito' };

const medios = Object.entries(MEDIOS).map(([valor, texto]) => ({ valor, texto }));

export default async function PaginaEscrito({ params, searchParams }: { params: Promise<{ id: string; eid: string }>; searchParams: Promise<{ v?: string }> }) {
  const { id, eid } = await params;
  const { v } = await searchParams;
  const u = await exigirUsuario();
  let e;
  try {
    e = await obtenerEscrito(u, eid);
    if (e.poliza_id !== id) notFound();
  } catch (err) {
    if (err instanceof NoEncontrado) notFound();
    throw err;
  }
  const p = await obtenerPoliza(u, id);
  const version = e.versiones.find((x) => String(x.version) === v) ?? e.versiones[0];
  const faltantes = (await q<{ datos_faltantes: string[] | null }>('SELECT datos_faltantes FROM escrito_versiones WHERE id = $1', [version?.id ?? '00000000-0000-0000-0000-000000000000']))[0]?.datos_faltantes ?? [];
  const asunto = e.asunto_id ? (await q<{ titulo: string }>('SELECT titulo FROM asuntos WHERE id = $1', [e.asunto_id]))[0] : null;
  const docs = await q<{ id: string; nombre_original: string }>('SELECT id, nombre_original FROM documentos WHERE poliza_id = $1 AND eliminado_en IS NULL ORDER BY subido_en DESC', [id]);
  const editable = e.estado === 'borrador';
  return (
    <>
      <p className="migas"><Link href={`/admin/seguros/polizas/${id}?pestana=asistente`}>{p.nombre}</Link> › Escritos</p>
      <header className="encabezado">
        <div>
          <h1>{e.titulo}</h1>
          <p className="secundario">{TIPOS_ESCRITO[e.tipo] ?? e.tipo}{e.destinatario ? ` · Para: ${e.destinatario}` : ''}{asunto ? ` · Asunto: ${asunto.titulo}` : ''} · Póliza {p.numero ?? 'sin número'} · {p.aseguradora}</p>
        </div>
        <span className={`estado estado--${e.estado === 'borrador' || e.estado === 'descartado' ? 'neutro' : 'vigente'}`}>{ESTADOS_ESCRITO[e.estado]}</span>
      </header>
      {e.estado === 'borrador' && <div className="aviso aviso--atencion" style={{ display: 'block' }}>Es un borrador. Generarlo o descargarlo <strong>no lo envía</strong>: revísalo, envíalo tú y después registra el envío aquí.</div>}

      <div className="dos-columnas">
        <section aria-labelledby="t-texto" style={{ minWidth: 0 }}>
          <div className="encabezado" style={{ marginBottom: 'var(--e-3)' }}>
            <h2 id="t-texto">Versión {version?.version} {version ? <span className="pequeno secundario">· {version.origen === 'ia' ? 'generada por la IA' : 'editada a mano'} · {new Date(version.creado_en).toLocaleString('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'short', timeStyle: 'short' })}</span> : null}</h2>
            {version && (
              <div className="acciones" style={{ flexWrap: 'wrap' }}>
                <BotonCopiar texto={version.texto} etiqueta="Copiar texto" />
                <a className="boton boton--peq" href={`/api/seguros/escritos/${e.id}/?v=${version.version}&formato=docx`}>Descargar Word</a>
                <a className="boton boton--peq boton--sutil" href={`/api/seguros/escritos/${e.id}/?v=${version.version}&formato=txt`}>Descargar texto</a>
              </div>
            )}
          </div>
          {faltantes.length > 0 && <div className="aviso aviso--atencion" style={{ display: 'block' }}>Datos que faltaban al redactarlo (marcados entre corchetes): {faltantes.join('; ')}.</div>}
          {version && (editable ? (
            <Formulario key={version.id} accion={accionVersion.bind(null, id, e.id)} aria="Editar escrito">
              <Area nombre="texto" etiqueta="Texto del escrito" filas={26} defecto={version.texto} requerido ayuda="Al guardar se crea una versión nueva; las anteriores se conservan." />
              <div><Enviar>Guardar como nueva versión</Enviar></div>
            </Formulario>
          ) : <div className="tarjeta tarjeta--pad" style={{ whiteSpace: 'pre-wrap' }}>{version.texto}</div>)}
          {version && <Citas citas={version.citas} />}
        </section>

        <aside style={{ display: 'grid', gap: 'var(--e-4)', alignContent: 'start', minWidth: 0 }}>
          <section className="tarjeta tarjeta--pad" aria-labelledby="t-versiones">
            <h2 id="t-versiones" style={{ marginBottom: 'var(--e-2)' }}>Versiones</h2>
            <ul className="lista-puntos pequeno">{e.versiones.map((x) => <li key={x.id}><Link href={`?v=${x.version}`} aria-current={x.id === version?.id ? 'page' : undefined}>Versión {x.version}</Link> · {x.origen === 'ia' ? 'IA' : 'manual'} · {new Date(x.creado_en).toLocaleString('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'short', timeStyle: 'short' })}</li>)}</ul>
          </section>
          <section className="tarjeta tarjeta--pad" aria-labelledby="t-seg">
            <h2 id="t-seg" style={{ marginBottom: 'var(--e-2)' }}>Envío y respuesta</h2>
            {e.comunicaciones.length === 0 ? <p className="secundario pequeno">No consta envío ni respuesta.</p> : (
              <ul className="lista-puntos pequeno">{e.comunicaciones.map((c) => <li key={c.id}>{fechaMedia(c.fecha)} · {c.direccion === 'enviada' ? 'Enviado' : 'Recibido'} por {MEDIOS[c.medio as keyof typeof MEDIOS] ?? c.medio}{c.interlocutor ? ` · ${c.interlocutor}` : ''}{c.escrito_version_id ? ` · versión ${e.versiones.find((x) => x.id === c.escrito_version_id)?.version ?? '?'}` : ''}{c.resumen ? ` — ${c.resumen}` : ''}{c.documento_id ? <> · <a href={`/api/seguros/documentos/${c.documento_id}/`} target="_blank" rel="noopener">documento</a></> : ''}</li>)}</ul>
            )}
            {e.estado !== 'descartado' && (
              <details style={{ marginTop: 'var(--e-3)' }}>
                <summary className="pequeno">Registrar envío</summary>
                <Formulario accion={accionEnvio.bind(null, id, e.id)} aria="Registrar envío">
                  <Campo nombre="fecha" etiqueta="Fecha de envío" tipo="date" defecto={hoyMadrid()} requerido />
                  <Selector nombre="medio" etiqueta="Medio" defecto="correo" opciones={medios} />
                  <Campo nombre="destinatario" etiqueta="Destinatario" defecto={e.destinatario ?? ''} />
                  <Selector nombre="version_id" etiqueta="Versión enviada" defecto={version?.id} opciones={e.versiones.map((x) => ({ valor: x.id, texto: `Versión ${x.version}` }))} />
                  <div><Enviar>Registrar envío</Enviar></div>
                </Formulario>
              </details>
            )}
            {(e.estado === 'enviado' || e.estado === 'respondido') && (
              <details style={{ marginTop: 'var(--e-3)' }}>
                <summary className="pequeno">Registrar respuesta recibida</summary>
                <Formulario accion={accionRespuesta.bind(null, id, e.id)} aria="Registrar respuesta">
                  <Campo nombre="fecha" etiqueta="Fecha de la respuesta" tipo="date" defecto={hoyMadrid()} requerido />
                  <Selector nombre="medio" etiqueta="Medio" defecto="correo" opciones={medios} />
                  <Campo nombre="interlocutor" etiqueta="Quién responde" />
                  <Area nombre="resumen" etiqueta="Qué responden" requerido />
                  <Selector nombre="documento_id" etiqueta="Documento de la respuesta (súbelo antes al expediente)" vacio="Sin documento" opciones={docs.map((d) => ({ valor: d.id, texto: d.nombre_original }))} />
                  <div><Enviar>Registrar respuesta</Enviar></div>
                </Formulario>
              </details>
            )}
            {e.estado === 'borrador' && (
              <form action={accionDescartar.bind(null, id, e.id)} style={{ marginTop: 'var(--e-3)' }}><button className="boton boton--peq boton--sutil" type="submit">Descartar borrador</button></form>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
