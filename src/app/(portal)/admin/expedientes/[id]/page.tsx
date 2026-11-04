import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Compositor } from '@/portal/components/Compositor';
import { Carpeta, Compartir, Completar, EquipoAsunto, EstadoCliente, Reasignar, Reprogramar, VerificarPlazo } from '@/portal/components/ExpedienteAcciones';
import { ChipSolicitud, tamano } from '@/portal/components/ui';
import { comoUsuario } from '@/portal/lib/db';
import { UUID } from '@/portal/lib/datos';
import { env } from '@/portal/lib/env';
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

export default async function Expediente({ params }: { params: Promise<{ id: string }> }) {
  const u = await requerirPersonal();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const d = await comoUsuario(u.id, async (tx) => {
    const c = await cabecera(tx, id, u.id);
    if (!c) return null;
    const [entradas, rec, carpetas] = [await cronologia(tx, id), await recientes(tx, u.id),
      (await tx.query(`select distinct coalesce(q.carpeta, d.carpeta) c from portal.documentos d left join portal.requisitos q on q.id = d.requisito_id where d.solicitud_id = $1`, [id])).rows.map((r) => r.c as string)];
    return { c, entradas, rec, carpetas, equipo: await equipoAsunto(tx, id), relevo: await relevo(tx, id), personal: await personalActivo(tx) };
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
      </aside>

      <section className="expediente-central">
        <header className="expediente-cabecera">
          <div className="fila">
            <div className="min-w-0">
              <p className="ayuda text-sm"><Link href={`/admin/clientes/${c.cliente_id}/`}>{c.cliente}</Link> · {c.expediente_ref ?? c.referencia}{c.responsable ? ` · ${c.responsable}` : ''}</p>
              <h1 className="subtitulo" style={{ marginBottom: 0 }}>{c.titulo}</h1>
            </div>
            <ChipSolicitud estado={c.estado} />
          </div>
          <p className="text-sm flex flex-wrap gap-x-4 gap-y-1 mt-1">
            <span>📄 {c.docs} documentos{c.por_revisar ? ` · ${c.por_revisar} por revisar` : ''}{c.faltan ? ` · faltan ${c.faltan}` : ''}</span>
            {c.proxima ? <span>⏰ {c.proxima_titulo}: {fechaHora(c.proxima)}</span> : null}
            {!c.cuenta_activa ? <span className="chip chip-aviso">El cliente aún no ha activado su acceso</span> : null}
            <Link href={`/admin/solicitudes/${id}/`}>Ficha completa</Link>
            {env.iaClave ? <Link href={`/admin/expedientes/${id}/asistente/`} className="font-semibold">✨ Asistente IA</Link> : null}
          </p>
          <div className="mt-1 text-sm"><EstadoCliente solicitud={id} actual={c.estado_visible} /></div>
          <div className="mt-1"><EquipoAsunto solicitud={id} miembros={d.equipo.miembros} gestiona={d.equipo.gestiona} /></div>
          <Continuar r={d.relevo} />
        </header>

        <ol className="cronologia" aria-label="Cronología del expediente">
          {d.entradas.length === 0 ? <li className="evento-linea">Expediente vacío. Escribe abajo, pega un texto o arrastra documentos.</li> : null}
          {d.entradas.map((e, i) => {
            const k = dia(new Date(e.at));
            const nuevoDia = i === 0 || k !== dia(new Date(d.entradas[i - 1]!.at));
            return [nuevoDia ? <li className="dia" key={`d-${k}`}>{k}</li> : null, <Item key={`${e.clase}-${e.id}`} e={e} sid={id} />];
          })}
        </ol>
        <datalist id="documentos-expediente">{[...new Set(d.entradas.filter((x) => x.clase === 'documento').map((x) => (x as { nombre: string }).nombre))].map((n) => <option key={n} value={n} />)}</datalist>
        <datalist id="personal-equipo">{d.personal.map((p) => <option key={p.id} value={p.nombre} />)}</datalist>
        <datalist id="carpetas-expediente">{[...new Set([...d.carpetas, 'Documentación del despacho', 'Escritos', 'Prueba', 'Comunicaciones', 'Resoluciones', 'Economía'])].map((x) => <option key={x} value={x} />)}</datalist>
        <Compositor solicitudId={id} maxMb={env.uploadMaxBytes / 1024 / 1024} />
      </section>
    </div>
  );
}
