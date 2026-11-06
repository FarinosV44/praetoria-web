import Link from 'next/link';
import type { Usuario } from '@/seguros/lib/auth/sesiones';
import { listarConversaciones, mensajes, type Cita } from '@/seguros/lib/ia/expediente';
import { ESTADOS_ESCRITO, listarAsuntos, listarEscritos, TIPOS_ESCRITO } from '@/seguros/lib/datos/escritos';
import { TIPOS_ASUNTO } from '@/seguros/lib/datos/expediente';
import { iaConfigurada } from '@/seguros/lib/ia/proveedor';
import { fechaMedia, hoyMadrid } from '@/seguros/lib/fechas';
import { Area, Campo, Enviar, Formulario, Selector } from '@/seguros/components/formulario';
import { Refrescar } from '@/seguros/components/copiar';
import { accionCrearAsunto, accionEstadoAsunto, accionPreguntar, accionResumir } from '../asistente-acciones';

const SUGERENCIAS = [
  '¿En qué estado está el siniestro y qué falta?',
  '¿Qué condiciones se aplicaban el día del siniestro y qué ha cambiado desde entonces?',
  '¿Cuáles han sido los últimos pagos y cuándo es el próximo cobro?',
  'Prepara un escrito para declarar este siniestro',
  'Contesta a la última petición de documentación',
  'Reclama que todavía no han respondido',
  'Solicita que revisen esta denegación conforme a la póliza',
  'Pide una revisión de la prima',
];

export function Citas({ citas }: { citas: Cita[] | null }) {
  if (!citas?.length) return null;
  return (
    <ul className="citas pequeno">
      {citas.map((c, i) => (
        <li key={i}>
          <strong>{c.ref}</strong>{' '}
          {c.documento_id ? <a href={`/api/seguros/documentos/${c.documento_id}/${c.pagina ? `#page=${c.pagina}` : ''}`} target="_blank" rel="noopener">{c.documento}{c.pagina ? `, pág. ${c.pagina}` : ''}</a> : <span>documento no identificado</span>}
          {c.fecha ? ` · ${fechaMedia(c.fecha)}` : ''}
          {c.cita && <> · «{c.cita}»</>}
          {' '}{c.verificada === true ? <span className="estado estado--vigente">cita comprobada</span> : c.verificada === false ? <span className="estado estado--vencida">la cita no aparece en el documento</span> : <span className="estado estado--neutro">sin comprobar</span>}
        </li>
      ))}
    </ul>
  );
}

/** Espacio de IA del seguro: asuntos con su resumen, conversaciones con citas y escritos generados. */
export async function Asistente({ u, id, c }: { u: Usuario; id: string; c?: string }) {
  const [asuntos, convs, escritos] = await Promise.all([listarAsuntos(u, id), listarConversaciones(u, id), listarEscritos(u, id)]);
  const actual = convs.find((x) => x.id === c) ?? null;
  const lista = actual ? await mensajes(u, actual.id) : [];
  const pendiente = lista.some((m) => m.estado === 'pendiente');
  const asuntoConv = actual?.asunto_id ? asuntos.find((a) => a.id === actual.asunto_id) : null;
  const configurada = iaConfigurada();
  return (
    <div className="dos-columnas asistente">
      <section aria-labelledby="t-conv" style={{ minWidth: 0 }}>
        <div className="encabezado" style={{ marginBottom: 'var(--e-3)' }}>
          <div>
            <h2 id="t-conv">{actual ? actual.titulo : 'Pregunta sobre este seguro'}</h2>
            <p className="secundario pequeno">{asuntoConv ? `Asunto: ${asuntoConv.titulo} · ` : ''}La IA consulta solo este expediente y cita documento, página y fecha. Distingue lo acreditado de las notas propias y las condiciones de hoy de las aplicables en cada fecha.</p>
          </div>
          {actual && <Link className="boton boton--peq" href={`?pestana=asistente`}>Nueva conversación</Link>}
        </div>
        {!configurada && <div className="aviso aviso--atencion" style={{ display: 'block' }}>Asistente sin configurar: falta <code>ANTHROPIC_API_KEY</code> en el servidor.</div>}
        <Refrescar activo={pendiente} />
        {lista.length > 0 && (
          <ol className="mensajes">
            {lista.map((m) => (
              <li key={m.id} className={`mensaje mensaje--${m.rol}`}>
                <p className="mensaje__quien">{m.rol === 'usuario' ? 'Tú' : 'Asistente'} · {new Date(m.creado_en).toLocaleString('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'short', timeStyle: 'short' })}</p>
                {m.estado === 'pendiente' ? <p role="status" className="secundario">Consultando el expediente… (suele tardar menos de un minuto; la página se actualiza sola)</p>
                  : m.estado === 'error' ? <p className="aviso aviso--error">No se ha podido responder: {m.error}</p>
                  : <div style={{ whiteSpace: 'pre-wrap' }}>{m.texto}</div>}
                <Citas citas={m.citas} />
                {m.escrito_id && <p style={{ marginTop: 'var(--e-2)' }}><Link className="boton boton--peq boton--oscuro" href={`/admin/seguros/polizas/${id}/escritos/${m.escrito_id}`}>Abrir el borrador del escrito</Link> <span className="pequeno secundario">Es un borrador: no se ha enviado.</span></p>}
                {m.fuentes && m.fuentes.length > 0 && <details className="pequeno"><summary>Documentos consultados ({m.fuentes.length})</summary><p>{m.fuentes.map((f) => `${f.ref} ${f.nombre} p.${f.pagina}`).join(' · ')}</p></details>}
              </li>
            ))}
          </ol>
        )}
        {configurada && (
          <Formulario accion={accionPreguntar.bind(null, id, actual?.id ?? null, actual ? actual.asunto_id : null)} aria="Preguntar a la IA">
            <Area nombre="texto" etiqueta={actual ? 'Seguir preguntando' : 'Tu pregunta o encargo'} filas={3} requerido ayuda="Por ejemplo: «¿En qué estado está el siniestro?» o «Prepara un escrito para reclamar que no han respondido»." />
            <div><Enviar pendiente="Enviando…">Preguntar</Enviar></div>
          </Formulario>
        )}
        {configurada && !actual && (
          <div className="sugerencias" aria-label="Sugerencias">
            {SUGERENCIAS.map((s) => (
              <Formulario key={s} accion={accionPreguntar.bind(null, id, null, null)} className="" aria={s}>
                <input type="hidden" name="texto" value={s} />
                <Enviar className="boton boton--peq boton--sutil" pendiente="Enviando…">{s}</Enviar>
              </Formulario>
            ))}
          </div>
        )}
        {convs.length > 0 && (
          <section style={{ marginTop: 'var(--e-5)' }} aria-labelledby="t-convs">
            <h3 id="t-convs" style={{ fontSize: 'var(--texto-m)' }}>Conversaciones de este seguro</h3>
            <ul className="lista-puntos pequeno">{convs.map((x) => <li key={x.id}><Link href={`?pestana=asistente&c=${x.id}`} aria-current={x.id === actual?.id ? 'page' : undefined}>{x.titulo}</Link> · {fechaMedia(hoyMadrid(new Date(x.actualizada_en)))}{x.asunto_id ? ` · ${asuntos.find((a) => a.id === x.asunto_id)?.titulo ?? ''}` : ''}</li>)}</ul>
          </section>
        )}
      </section>

      <aside style={{ display: 'grid', gap: 'var(--e-4)', alignContent: 'start', minWidth: 0 }}>
        <section className="tarjeta tarjeta--pad" aria-labelledby="t-asuntos">
          <h2 id="t-asuntos" style={{ marginBottom: 'var(--e-3)' }}>Asuntos</h2>
          {asuntos.length === 0 && <p className="secundario pequeno">Sin asuntos. Cada siniestro crea el suyo; puedes abrir otros (reclamación, prima…).</p>}
          {asuntos.map((a) => (
            <article key={a.id} className="asunto" style={{ marginBottom: 'var(--e-4)' }}>
              <p style={{ fontWeight: 650 }}>{a.titulo} <span className={`estado estado--${a.estado === 'abierto' ? 'proxima' : 'neutro'}`}>{a.estado === 'abierto' ? 'Abierto' : 'Cerrado'}</span></p>
              <p className="linea-2">{TIPOS_ASUNTO[a.tipo]}{a.siniestro_id ? <> · <Link href={`/admin/seguros/siniestros/${a.siniestro_id}`}>ver siniestro</Link></> : ''}</p>
              {a.resumen ? (
                <dl className="lista-datos pequeno" style={{ marginTop: 'var(--e-2)' }}>
                  <dt>Qué ha ocurrido</dt><dd>{a.resumen.ocurrido}</dd>
                  <dt>Última actuación</dt><dd>{a.resumen.ultima_actuacion}</dd>
                  <dt>Respuesta recibida</dt><dd style={a.resumen.constan_respuesta ? undefined : { color: 'var(--color-aviso-texto)', fontWeight: 600 }}>{a.resumen.respuesta}</dd>
                  <dt>Documentación pendiente</dt><dd>{a.resumen.pendiente}</dd>
                  <dt>Siguiente paso</dt><dd>{a.resumen.siguiente_paso}</dd>
                </dl>
              ) : <p className="pequeno secundario">Sin resumen todavía.</p>}
              {a.resumen && <Citas citas={a.resumen.citas} />}
              {a.resumen && a.resumen_desactualizado && <p className="pequeno" style={{ color: 'var(--color-aviso-texto)' }}>Hay novedades en el expediente desde este resumen.</p>}
              {a.resumen_en && <p className="pequeno secundario">Resumen del {new Date(a.resumen_en).toLocaleString('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'short', timeStyle: 'short' })}</p>}
              <div className="acciones" style={{ marginTop: 'var(--e-2)', flexWrap: 'wrap' }}>
                {configurada && <Formulario accion={accionResumir.bind(null, id, a.id)} className="" aria={`Resumir ${a.titulo}`}><Enviar className="boton boton--peq" pendiente="Resumiendo… (hasta un minuto)">{a.resumen ? 'Regenerar resumen' : 'Resumir estado'}</Enviar></Formulario>}
                {configurada && <Formulario accion={accionPreguntar.bind(null, id, null, a.id)} className="" aria={`Preguntar sobre ${a.titulo}`}><input type="hidden" name="texto" value={`¿En qué estado está «${a.titulo}» y cuál es el siguiente paso?`} /><Enviar className="boton boton--peq boton--sutil" pendiente="…">Preguntar sobre este asunto</Enviar></Formulario>}
                <form action={accionEstadoAsunto.bind(null, id, a.id, a.estado === 'abierto' ? 'cerrado' : 'abierto')}><button className="boton boton--peq boton--sutil" type="submit">{a.estado === 'abierto' ? 'Cerrar' : 'Reabrir'}</button></form>
              </div>
            </article>
          ))}
          <details>
            <summary className="pequeno">Abrir un asunto</summary>
            <Formulario accion={accionCrearAsunto.bind(null, id)} aria="Abrir asunto">
              <Selector nombre="tipo" etiqueta="Tipo" defecto="reclamacion" opciones={Object.entries(TIPOS_ASUNTO).filter(([k]) => k !== 'siniestro').map(([valor, texto]) => ({ valor, texto }))} />
              <Campo nombre="titulo" etiqueta="Título" requerido />
              <div><Enviar>Abrir</Enviar></div>
            </Formulario>
          </details>
        </section>
        <section className="tarjeta tarjeta--pad" aria-labelledby="t-escritos">
          <h2 id="t-escritos" style={{ marginBottom: 'var(--e-3)' }}>Escritos</h2>
          {escritos.length === 0 ? <p className="secundario pequeno">Pide uno en la conversación («Prepara un escrito para…»).</p> : (
            <ul className="lista-puntos pequeno">{escritos.map((e) => <li key={e.id}><Link href={`/admin/seguros/polizas/${id}/escritos/${e.id}`}>{e.titulo}</Link> · {TIPOS_ESCRITO[e.tipo] ?? e.tipo} · <span className={`estado estado--${e.estado === 'borrador' ? 'neutro' : e.estado === 'descartado' ? 'neutro' : 'vigente'}`}>{ESTADOS_ESCRITO[e.estado]}</span> · v{e.versiones}</li>)}</ul>
          )}
        </section>
      </aside>
    </div>
  );
}
