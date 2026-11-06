import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AnalizarDocumento, DatosProceso, DecidirPropuesta, Reindexar } from '@/portal/components/ExpedienteIA';
import { Compositor } from '@/portal/components/Compositor';
import { Migas } from '@/portal/components/NavDespacho';
import { PanelIA } from '@/portal/components/PanelIA';
import { Carpeta, CerrarExpediente, Compartir, Eliminar, Restaurar, Completar, EquipoAsunto, EstadoCliente, Reasignar, Reprogramar, VerificarPlazo } from '@/portal/components/ExpedienteAcciones';
import { ChipSolicitud, tamano } from '@/portal/components/ui';
import { comoUsuario } from '@/portal/lib/db';
import { UUID } from '@/portal/lib/datos';
import { env } from '@/portal/lib/env';
import { opcionesIA } from '@/portal/lib/ia-opciones';
import { cabecera, cronologia, recientes, type Entrada } from '@/portal/lib/expediente';
import { equipoAsunto, personalActivo, relevo, type Relevo } from '@/portal/lib/equipo';
import { fechaHora, partesMadrid, TIPO_ETIQUETA } from '@/portal/lib/agenda';
import { requerirPersonal } from '@/portal/lib/sesion';
import { textoEvento } from '@/portal/lib/textos';

export const metadata: Metadata = { title: 'Expediente' };

const FUENTE: Record<string, string> = { nota: 'Nota interna', texto_aportado: 'Texto aportado', llamada: 'Llamada', reunion: 'Reunión' };
const dia = (d: Date) => new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Madrid' }).format(d);
const hora = (d: Date) => new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' }).format(d);

function Item({ e, sid }: { e: Entrada; sid: string }) {
  if (e.clase === 'evento') {
    return <li className="evento-linea" data-clase="evento">{hora(e.at)} · {textoEvento(e.tipo, e.detalle)}{e.autor ? ` · ${e.autor}` : ''}</li>;
  }
  if (e.clase === 'nota') {
    return (
      <li className="burbuja burbuja-interna" data-clase="nota">
        <p className="meta">{FUENTE[e.fuente] ?? 'Nota'} · {e.autor} · {hora(e.at)} · <span title="No lo ve el cliente">🔒 interno</span></p>
        <p className="whitespace-pre-wrap">{e.texto}</p>
      </li>
    );
  }
  if (e.clase === 'mensaje') {
    return (
      <li className={`burbuja ${e.del_despacho ? 'burbuja-cliente-saliente' : 'burbuja-cliente-entrante'}`} data-clase="mensaje">
        <p className="meta">{e.del_despacho ? `Mensaje al cliente · ${e.autor}` : `Mensaje del cliente · ${e.autor}`} · {hora(e.at)}</p>
        <p className="whitespace-pre-wrap">{e.texto}</p>
      </li>
    );
  }
  if (e.clase === 'borrador') {
    return (
      <li className="burbuja burbuja-documento" data-clase="borrador" data-borrador-version={e.version}>
        <p className="meta">✍️ Borrador {e.origen === 'ia' ? 'preparado con IA' : 'corregido a mano'} · {e.autor} · {hora(e.at)} · <span title="No lo ve el cliente">🔒 interno</span></p>
        <p className="fila"><span><strong>{e.titulo}</strong> · versión {e.version}</span><span className="chip chip-aviso">BORRADOR · requiere revisión</span></p>
        {e.instruccion && e.origen === 'ia' ? <p className="text-sm">«{e.instruccion.length > 200 ? `${e.instruccion.slice(0, 200)}…` : e.instruccion}»</p> : null}
        <p className="text-xs" data-modelos-usados>{e.modelos.length ? <>Modelos: {e.modelos.map((m) => `${m.etiqueta} ${m.titulo} v${m.version}`).join(' · ')}</> : 'Sin modelos de la biblioteca'}
          {e.avisos ? ` · ⚠️ ${e.avisos} aviso${e.avisos > 1 ? 's' : ''}` : ''}{e.pendientes ? ` · ${e.pendientes} [PENDIENTE]` : ''}</p>
        <div className="flex flex-wrap gap-3 items-center text-sm mt-1">
          <Link href={`/admin/expedientes/${sid}/escritos/${e.escrito}/?v=${e.version}`}>Abrir y revisar</Link>
          {e.hilo ? <Link href={`?redactar=${e.escrito}#compositor`} scroll={false}>Pedir cambios</Link> : null}
          <form method="post" action="/api/escritos/exportar/" className="inline-flex gap-2" data-exportar>
            <input type="hidden" name="escrito" value={e.escrito} /><input type="hidden" name="version" value={e.version} />
            <button name="formato" value="docx" className="btn-texto">Word</button><button name="formato" value="pdf" className="btn-texto">PDF</button>
          </form>
        </div>
      </li>
    );
  }
  if (e.clase === 'tarea') {
    return (
      <li className="burbuja burbuja-tarea" data-clase="tarea" data-tarea={e.titulo}>
        <p className="meta">{e.tipo === 'plazo' ? (e.verificado ? 'Plazo verificado' : e.sugerida ? 'Fecha sugerida (sin validar)' : 'Plazo pendiente de verificar') : TIPO_ETIQUETA[e.tipo] ?? 'Tarea'} · responsable: {e.autor} · {hora(e.at)}</p>
        <p className="fila"><span><strong>{e.titulo}</strong> · {fechaHora(e.inicio)}</span>
          {e.estado === 'pendiente' ? <span className="flex gap-3 items-center"><Reasignar tarea={e.id} solicitud={sid} /><Completar tarea={e.id} solicitud={sid} /></span>
            : <span className="chip chip-neutro">{e.estado === 'completado' ? 'Hecha' : 'Cancelada'}</span>}</p>
        {e.documento || e.fuente ? <p className="text-xs">Origen: {e.documento ? <a href={`/api/documentos/${e.documento.id}/?ver=1`} target="_blank" rel="noopener">📄 {e.documento.nombre}</a> : e.fuente}</p> : null}
        {e.estado === 'pendiente' ? (
          <p className="flex flex-wrap gap-3 items-center text-xs mt-1">
            {e.tipo === 'plazo' && !e.verificado ? <VerificarPlazo tarea={e.id} solicitud={sid} /> : null}
            <Reprogramar tarea={e.id} solicitud={sid} fecha={partesMadrid(e.inicio).fecha} />
            <Link href={`/admin/agenda/${e.id}/`}>Avisos y detalles</Link>
          </p>
        ) : <p className="text-xs"><Link href={`/admin/agenda/${e.id}/`}>Avisos y detalles</Link></p>}
      </li>
    );
  }
  return (
    <li className="burbuja burbuja-documento" data-clase="documento" data-documento={e.nombre}>
      <p className="meta">{e.del_despacho ? 'Documento del despacho' : 'Documento del cliente'} · {e.autor} · {hora(e.at)}{e.origen === 'portapapeles' ? ' · pegado' : ''}</p>
      <p className="fila">
        <span>📄 <a href={`/api/documentos/${e.id}/?ver=1`} target="_blank" rel="noopener" className="font-semibold">{e.nombre}</a>
          <span className="ayuda text-sm"> · v{e.version} · {tamano(e.tamano)}</span></span>
        <a href={`/api/documentos/${e.id}/?descargar=1`} className="text-sm">Descargar</a>
      </p>
      <p className="flex flex-wrap gap-3 items-center text-sm mt-1">
        <Carpeta documento={e.id} solicitud={sid} carpeta={e.carpeta} editable={e.del_despacho} />
        {e.visible ? <span className="chip chip-ok">Visible para el cliente</span> : <><span className="chip chip-neutro">🔒 Privado</span><Compartir documento={e.id} solicitud={sid} /></>}
        <Eliminar documento={e.id} solicitud={sid} nombre={e.nombre} />
        {e.estado === 'pendiente' ? <Link href={`/admin/solicitudes/${sid}/#documentacion`}>Revisar</Link> : null}
        {e.analisis === 'infectado' ? <span className="chip chip-aviso">Bloqueado por antivirus</span> : null}
      </p>
    </li>
  );
}

/** Relevo (#81): resumen operativo con lo registrado en el expediente, para retomarlo sin explicaciones externas. */
function Continuar({ r }: { r: Relevo }) {
  return (
    <details className="mt-2 text-sm" data-relevo>
      <summary className="font-semibold cursor-pointer">Continuar este asunto</summary>
      <dl className="grid gap-1 mt-2" style={{ gridTemplateColumns: 'max-content 1fr', columnGap: '1rem' }}>
        <dt className="ayuda">Último movimiento</dt><dd>{r.ultimo ? `${fechaHora(r.ultimo.at)} · ${r.ultimo.texto}` : 'Sin movimientos'}</dd>
        <dt className="ayuda">Situación publicada</dt><dd>{r.estado_visible ?? <em>sin publicar</em>}</dd>
        <dt className="ayuda">Última nota interna</dt><dd>{r.ultima_nota ? `${r.ultima_nota.autor}: ${r.ultima_nota.texto}` : '—'}</dd>
        <dt className="ayuda">Qué hay que hacer</dt><dd>{r.tareas.length ? <ul>{r.tareas.map((t, i) => <li key={i}>{t.vencida ? '⚠️ ' : ''}{t.titulo} · {t.responsable} · {fechaHora(t.inicio)}</li>)}</ul> : 'No hay tareas pendientes'}</dd>
        <dt className="ayuda">Plazos</dt><dd>{r.plazos.length ? <ul>{r.plazos.map((p, i) => <li key={i}>{p.titulo} · {fechaHora(p.inicio)} · {p.verificado ? 'verificado' : <strong>pendiente de verificar</strong>}</li>)}</ul> : 'Ninguno registrado'}</dd>
        <dt className="ayuda">Documentación</dt><dd>{r.faltan.length ? `Faltan: ${r.faltan.join(', ')}` : 'No falta nada solicitado'}{r.por_revisar ? ` · ${r.por_revisar} por revisar` : ''}</dd>
        <dt className="ayuda">Bloqueos</dt><dd>{r.sin_responder ? `Mensaje del cliente sin contestar (${fechaHora(r.sin_responder.at)}): «${r.sin_responder.texto}»` : 'Ninguno detectado'}</dd>
      </dl>
    </details>
  );
}

export default async function Expediente({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ redactar?: string; vista?: string; q?: string }> }) {
  const u = await requerirPersonal();
  const { id } = await params;
  const { redactar, vista: vistaPedida, q: qDocs } = await searchParams;
  const vista = (['cronologia', 'documentos', 'plazos', 'escritos'] as const).find((v) => v === vistaPedida) ?? 'cronologia';
  const busca = (qDocs ?? '').trim().slice(0, 200);
  if (!UUID.test(id)) notFound();
  const d = await comoUsuario(u.id, async (tx) => {
    const c = await cabecera(tx, id, u.id);
    if (!c) return null;
    const [entradas, rec, carpetas] = [await cronologia(tx, id), await recientes(tx, u.id),
      (await tx.query(`select distinct coalesce(q.carpeta, d.carpeta) c from portal.documentos d left join portal.requisitos q on q.id = d.requisito_id where d.solicitud_id = $1`, [id])).rows.map((r) => r.c as string)];
    const escritos = (await tx.query(`select e.id, e.titulo, e.hilo_id hilo, v.version, v.modelos from portal.escritos e
      join lateral (select version, modelos from portal.escrito_versiones x where x.escrito_id = e.id order by version desc limit 1) v on true
      where e.solicitud_id = $1 order by e.updated_at desc limit 20`, [id])).rows as { id: string; titulo: string; hilo: string | null; version: number; modelos: { version_id: string; titulo: string; etiqueta: string }[] }[];
    const papelera = (await tx.query(`select id, nombre, version, eliminado_at, eliminado_por, motivo, purgado_at, greatest(0, 30 - floor(extract(epoch from now() - eliminado_at) / 86400))::int dias
      from portal.papelera($1) limit 30`, [id])).rows as
      { id: string; nombre: string; version: number; eliminado_at: Date; eliminado_por: string | null; motivo: string | null; purgado_at: Date | null; dias: number }[];
    const propuestas = (await tx.query(`select p.id, p.tipo, p.titulo, p.fecha, p.fundamento, d.nombre_original documento from portal.ia_propuestas p
      left join portal.documentos d on d.id = p.documento_id where p.solicitud_id = $1 and p.estado = 'pendiente' order by p.created_at desc limit 30`, [id])).rows as { id: string; tipo: string; titulo: string; fecha: Date | null; fundamento: string | null; documento: string | null }[];
    const analisis = (await tx.query(`select documento_id, tipo, resumen, datos, modelo from portal.doc_analisis where solicitud_id = $1`, [id])).rows as { documento_id: string; tipo: string; resumen: string; datos: Record<string, unknown>; modelo: string | null }[];
    const indexado = (await tx.query(`select origen_id, estado, detalle, fragmentos, con_ocr from portal.ia_indexacion where tipo = 'documento' and solicitud_id = $1`, [id])).rows as { origen_id: string; estado: string; detalle: string | null; fragmentos: number; con_ocr: boolean }[];
    const coincidentes = busca.length >= 2 ? (await tx.query(`select distinct f.documento_id from portal.doc_fragmentos f where f.solicitud_id = $1 and f.tsv @@ websearch_to_tsquery('spanish', $2)`, [id, busca])).rows.map((r) => r.documento_id as string) : [];
    const duplicados = (await tx.query(`select array_agg(id::text) ids from portal.documentos where solicitud_id = $1 group by sha256 having count(*) > 1`, [id])).rows.flatMap((r) => r.ids as string[]);
    return { c, entradas, rec, carpetas, escritos, papelera, propuestas, analisis, indexado, coincidentes, duplicados, opciones: env.iaClave ? await opcionesIA(tx) : null, equipo: await equipoAsunto(tx, id), relevo: await relevo(tx, id), personal: await personalActivo(tx) };
  });
  if (!d) notFound();
  const { c } = d;
  return (
    <div className="expediente">
      <aside className="expediente-lateral" aria-label="Expedientes recientes">
        <form action="/admin/buscar/" className="mb-3"><input name="q" type="search" placeholder="Buscar cliente, asunto o documento" aria-label="Buscar" className="border rounded-md p-2 w-full" /></form>
        <p className="etiqueta text-sm mb-1">Recientes</p>
        <ul className="grid gap-1 text-sm">
          {d.rec.map((r) => (
            <li key={r.id}><Link href={`/admin/expedientes/${r.id}/`} aria-current={r.id === id ? 'page' : undefined} className={`block rounded px-2 py-1 no-underline ${r.id === id ? 'activo' : ''}`}>
              <span className="font-semibold block truncate">{r.cliente}</span><span className="ayuda block truncate">{r.titulo}</span></Link></li>
          ))}
        </ul>
        <p className="mt-3 text-sm"><Link href="/admin/clientes/nuevo/">+ Nuevo cliente</Link></p>
        {d.escritos.length ? (
          <>
            <p className="etiqueta text-sm mt-4 mb-1">Borradores de este asunto</p>
            <ul className="grid gap-1 text-sm" data-escritos>
              {d.escritos.map((e) => <li key={e.id}><Link href={`/admin/expedientes/${id}/escritos/${e.id}/`} className="block rounded px-2 py-1 no-underline truncate">✍️ {e.titulo} · v{e.version}</Link></li>)}
            </ul>
          </>
        ) : null}
        {d.papelera.length ? (
          <details className="mt-4 text-sm" data-papelera>
            <summary className="etiqueta cursor-pointer">🗑 Papelera ({d.papelera.filter((x) => !x.purgado_at).length})</summary>
            <p className="ayuda text-xs mt-1">Se puede restaurar durante 30 días; después se borra el archivo y queda solo el registro.</p>
            <ul className="grid gap-2 mt-2">
              {d.papelera.map((x) => {
                const dias = x.dias;
                return (
                  <li key={x.id} data-en-papelera={x.nombre}>
                    <span className="block truncate">{x.nombre} · v{x.version}</span>
                    <span className="ayuda block text-xs">{x.eliminado_por ?? '—'} · {fechaHora(new Date(x.eliminado_at))}{x.motivo ? ` · ${x.motivo}` : ''}</span>
                    {x.purgado_at ? <span className="ayuda text-xs">Borrado definitivamente</span>
                      : <span className="flex gap-2 items-center text-xs">{dias} día{dias === 1 ? '' : 's'} para restaurar · <Restaurar documento={x.id} solicitud={id} /></span>}
                  </li>
                );
              })}
            </ul>
          </details>
        ) : null}
      </aside>

      <section className="expediente-central">
        <Migas items={[{ texto: 'Expedientes', href: '/admin/expedientes/' }, { texto: c.titulo }]} />
        <header className="expediente-cabecera">
          <div className="fila">
            <div className="min-w-0">
              <p className="ayuda text-sm"><Link href={`/admin/clientes/${c.cliente_id}/`}>{c.cliente}</Link> · {c.expediente_ref ?? c.referencia}{c.responsable ? ` · ${c.responsable}` : ''}</p>
              <h1 className="subtitulo" style={{ marginBottom: 0 }}>{c.titulo}</h1>
            </div>
            <span className="flex gap-2 items-center">{c.expediente_estado === 'cerrado' ? <span className="chip chip-neutro" data-expediente-cerrado>Expediente cerrado</span> : null}<ChipSolicitud estado={c.estado} /></span>
          </div>
          <dl className="ficha-proceso" data-ficha-proceso>
            <div><dt>Contrario</dt><dd>{c.contraparte ?? '—'}</dd></div>
            <div><dt>Procedimiento</dt><dd>{c.procedimiento ?? '—'}</dd></div>
            <div><dt>Órgano</dt><dd>{c.organo ?? '—'}</dd></div>
            <div><dt>N.º de autos</dt><dd>{c.numero_autos ?? '—'}</dd></div>
            <div><dt>Abierto</dt><dd>{c.abierto_at ? fechaHora(new Date(c.abierto_at)) : '—'}</dd></div>
          </dl>
          {c.expediente_estado ? <DatosProceso solicitud={id} contraparte={c.contraparte} procedimiento={c.procedimiento} organo={c.organo} autos={c.numero_autos} /> : null}
          <p className="text-sm flex flex-wrap gap-x-4 gap-y-1 mt-1">
            <span>📄 {c.docs} documentos{c.por_revisar ? ` · ${c.por_revisar} por revisar` : ''}{c.faltan ? ` · faltan ${c.faltan}` : ''}</span>
            {c.proxima ? <span>⏰ {c.proxima_titulo}: {fechaHora(c.proxima)}</span> : null}
            {!c.cuenta_activa ? <span className="chip chip-aviso">El cliente aún no ha activado su acceso</span> : null}
            <Link href={`/admin/solicitudes/${id}/`}>Ficha completa</Link>
            {c.expediente_estado ? <CerrarExpediente solicitud={id} cerrado={c.expediente_estado === 'cerrado'} /> : null}
            {d.opciones ? <PanelIA solicitud={id} opciones={d.opciones} /> : null}
            {env.iaClave ? <Link href={`/admin/expedientes/${id}/asistente/`} className="font-semibold">✨ Asistente IA</Link> : null}
            {env.iaClave ? <Link href={`/admin/expedientes/${id}/asistente/?modo=redactar`} className="font-semibold">✍️ Redactar escrito</Link> : null}
          </p>
          <div className="mt-1 text-sm"><EstadoCliente solicitud={id} actual={c.estado_visible} /></div>
          <div className="mt-1"><EquipoAsunto solicitud={id} miembros={d.equipo.miembros} gestiona={d.equipo.gestiona} /></div>
          <Continuar r={d.relevo} />
        </header>

        <nav className="pestanas" aria-label="Vistas del expediente">
          {([['cronologia', 'Cronología', null], ['documentos', 'Documentación', c.docs], ['plazos', 'Plazos y tareas', d.entradas.filter((x) => x.clase === 'tarea' && x.estado === 'pendiente').length], ['escritos', 'Escritos', d.escritos.length]] as const).map(([k, t, n]) => (
            <Link key={k} href={k === 'cronologia' ? '?' : `?vista=${k}`} scroll={false} aria-current={vista === k ? 'page' : undefined}>{t}{n ? <span className="ayuda text-xs"> {n}</span> : null}</Link>
          ))}
        </nav>

        {d.propuestas.length ? (
          <section className="card" aria-label="Propuestas de la IA" data-propuestas>
            <h2 className="font-semibold">Propuestas de la IA por revisar</h2>
            <p className="ayuda text-xs mb-2">No se ha cambiado nada. Un plazo aceptado queda como fecha sugerida sin verificar: comprueba notificación, días inhábiles y norma aplicable.</p>
            <ul className="grid gap-2">{d.propuestas.map((p) => (
              <li key={p.id} className="border rounded p-2 text-sm" data-propuesta={p.titulo}>
                <p><strong>{p.tipo === 'plazo' ? 'Posible plazo' : 'Tarea'}:</strong> {p.titulo}{p.documento ? <span className="ayuda"> · {p.documento}</span> : null}</p>
                {p.fundamento ? <p className="ayuda text-xs">{p.fundamento}</p> : null}
                <DecidirPropuesta propuesta={p.id} solicitud={id} fecha={p.fecha ? new Date(p.fecha).toISOString().slice(0, 10) : ''} />
              </li>
            ))}</ul>
          </section>
        ) : null}

        {vista === 'documentos' ? (
          <section className="grid gap-3" aria-label="Documentación del expediente" data-vista="documentos">
            <form className="flex gap-2"><input type="hidden" name="vista" value="documentos" />
              <input name="q" type="search" defaultValue={busca} placeholder="Busca por nombre o dentro del contenido" aria-label="Buscar en la documentación" className="border rounded-md p-2 flex-1 min-w-0" />
              <button className="btn btn-secundario" style={{ minHeight: 40 }}>Buscar</button>
            </form>
            {(() => {
              const docs = d.entradas.filter((x): x is Extract<Entrada, { clase: 'documento' }> => x.clase === 'documento')
                .filter((x) => !busca || x.nombre.toLowerCase().includes(busca.toLowerCase()) || d.coincidentes.includes(x.id));
              if (!docs.length) return <p className="ayuda">{busca ? 'Ningún documento coincide.' : 'Aún no hay documentos. Súbelos desde la cronología.'}</p>;
              return (
                <ul className="grid gap-2">{docs.map((x) => {
                  const ix = d.indexado.find((i) => i.origen_id === x.id);
                  const an = d.analisis.find((a) => a.documento_id === x.id);
                  return (
                    <li key={x.id} className="card" style={{ marginTop: 0, padding: 14 }} data-documento={x.nombre}>
                      <p className="fila"><span>📄 <a href={`/api/documentos/${x.id}/?ver=1`} target="_blank" rel="noopener" className="font-semibold">{x.nombre}</a><span className="ayuda text-sm"> · v{x.version} · {tamano(x.tamano)} · {x.carpeta}</span></span>
                        <a href={`/api/documentos/${x.id}/?descargar=1`} className="text-sm">Descargar</a></p>
                      <p className="flex flex-wrap gap-2 items-center text-xs mt-1">
                        {ix?.estado === 'ok' ? <span className="chip chip-ok" data-indexado>Disponible para la IA{ix.con_ocr ? ' (OCR)' : ''}</span>
                          : ix?.estado === 'error' || ix?.estado === 'sin_texto' ? <span className="chip chip-aviso" title={ix.detalle ?? ''}>{ix.detalle ?? 'Sin texto legible'}</span>
                            : <span className="chip chip-neutro">Procesando para la IA…</span>}
                        {ix && ix.estado !== 'pendiente' && ix.estado !== 'procesando' ? <Reindexar tipo="documento" origen={x.id} solicitud={id} /> : null}
                        {d.duplicados.includes(x.id) ? <span className="chip chip-aviso">Posible duplicado (mismo contenido que otro archivo)</span> : null}
                        {d.opciones && ix?.estado === 'ok' ? <AnalizarDocumento documento={x.id} ya={!!an} /> : null}
                      </p>
                      {an ? (
                        <details className="text-sm mt-2" data-analisis>
                          <summary>Análisis de la IA · {an.tipo}{an.modelo ? ` · ${an.modelo}` : ''} (revísalo)</summary>
                          <p className="whitespace-pre-wrap mt-1">{an.resumen}</p>
                          {([['Órgano', an.datos.organo], ['Procedimiento', an.datos.procedimiento], ['Fallo', an.datos.fallo], ['Estrategia preliminar', an.datos.estrategia_preliminar]] as const).map(([t, v]) => (v ? <p key={t} className="mt-1"><strong>{t}:</strong> {String(v)}</p> : null))}
                          {([['Partes', an.datos.partes], ['Pretensiones', an.datos.pretensiones], ['Cuantías', an.datos.cuantias], ['Documentos citados', an.datos.documentos_citados], ['Advertencias', an.datos.advertencias]] as const).map(([t, v]) => (Array.isArray(v) && v.length ? <div key={t} className="mt-1"><strong>{t}</strong><ul>{v.map((y, i) => <li key={i}>{String(y)}</li>)}</ul></div> : null))}
                          {Array.isArray(an.datos.fechas) && an.datos.fechas.length ? <div className="mt-1"><strong>Fechas que constan en el documento</strong><ul>{(an.datos.fechas as { fecha: string; que: string; cita: string }[]).map((f, i) => <li key={i}>{f.fecha}: {f.que} <span className="ayuda">«{f.cita}»</span></li>)}</ul></div> : null}
                        </details>
                      ) : null}
                    </li>
                  );
                })}</ul>
              );
            })()}
          </section>
        ) : vista === 'escritos' ? (
          <section className="grid gap-2" aria-label="Escritos del expediente" data-vista="escritos">
            <p className="fila"><span className="ayuda text-sm">{d.escritos.length ? 'Borradores de este asunto.' : 'Aún no hay escritos.'}</span>{env.iaClave ? <Link href={`/admin/ia/nuevo/?expediente=${id}`} className="btn btn-secundario" style={{ minHeight: 38 }}>✍️ Nuevo escrito</Link> : null}</p>
            <ul className="grid gap-2">{d.escritos.map((e) => <li key={e.id} className="card" style={{ marginTop: 0, padding: 14 }}><Link href={`/admin/expedientes/${id}/escritos/${e.id}/`} className="font-semibold">{e.titulo}</Link> <span className="ayuda text-sm">· versión {e.version}{e.modelos.length ? ` · ${e.modelos.length} modelo${e.modelos.length > 1 ? 's' : ''} de la biblioteca` : ''}</span> <span className="chip chip-aviso">BORRADOR</span></li>)}</ul>
          </section>
        ) : null}

        {vista === 'cronologia' || vista === 'plazos' ? (<>
        <ol className="cronologia" aria-label={vista === 'plazos' ? 'Plazos y tareas del expediente' : 'Cronología del expediente'}>
          {vista === 'plazos' && !d.entradas.some((x) => x.clase === 'tarea') ? <li className="evento-linea">No hay plazos ni tareas en este expediente.</li> : null}
          {vista === 'cronologia' && d.entradas.length === 0 ? <li className="evento-linea">Expediente vacío. Escribe abajo, pega un texto o arrastra documentos.</li> : null}
          {(vista === 'plazos' ? d.entradas.filter((x) => x.clase === 'tarea') : d.entradas).map((e, i, lista) => {
            const k = dia(new Date(e.at));
            const nuevoDia = i === 0 || k !== dia(new Date(lista[i - 1]!.at));
            return [nuevoDia ? <li className="dia" key={`d-${k}`}>{k}</li> : null, <Item key={`${e.clase}-${e.id}`} e={e} sid={id} />];
          })}
        </ol>
        </>) : null}
        <datalist id="documentos-expediente">{[...new Set(d.entradas.filter((x) => x.clase === 'documento').map((x) => (x as { nombre: string }).nombre))].map((n) => <option key={n} value={n} />)}</datalist>
        <datalist id="personal-equipo">{d.personal.map((p) => <option key={p.id} value={p.nombre} />)}</datalist>
        <datalist id="carpetas-expediente">{[...new Set([...d.carpetas, 'Documentación del despacho', 'Escritos', 'Prueba', 'Comunicaciones', 'Resoluciones', 'Economía'])].map((x) => <option key={x} value={x} />)}</datalist>
        {vista !== 'cronologia' ? null : <Compositor solicitudId={id} maxMb={env.uploadMaxBytes / 1024 / 1024} ia={!!env.iaClave}
          escritos={d.escritos.filter((e) => e.hilo).map((e) => ({ id: e.id, titulo: e.titulo, version: e.version, hilo: e.hilo!, modelos: e.modelos }))}
          abrirEscrito={redactar && UUID.test(redactar) ? redactar : null} />}
      </section>
    </div>
  );
}
