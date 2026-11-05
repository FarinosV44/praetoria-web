import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EstadoModelo, FichaModelo, SubirBiblioteca } from '@/portal/components/Biblioteca';
import { CLASES, diferencias, ESTADOS } from '@/portal/lib/biblioteca';
import { comoUsuario } from '@/portal/lib/db';
import { UUID } from '@/portal/lib/datos';
import { requerirPersonal } from '@/portal/lib/sesion';
import { fecha } from '@/portal/lib/textos';
import { estiloDesdeModelo } from '../estilos/acciones';

export const metadata: Metadata = { title: 'Modelo de la biblioteca' };

export default async function Modelo({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string; comparar?: string }> }) {
  const u = await requerirPersonal();
  const { id } = await params;
  const q = await searchParams;
  if (!UUID.test(id)) notFound();
  const d = await comoUsuario(u.id, async (tx) => {
    const m = (await tx.query(`select m.*, p.nombre procedimiento, au.nombre_visible autor, ap.nombre_visible aprobador
      from portal.bib_modelos m left join portal.bib_procedimientos p on p.id = m.procedimiento_id join portal.personal au on au.user_id = m.autor_id
      left join portal.personal ap on ap.user_id = m.aprobado_por where m.id = $1`, [id])).rows[0];
    if (!m) return null;
    const versiones = (await tx.query(`select v.id, v.version, v.origen, v.nombre_original, v.mime, v.tamano, v.texto, v.avisos, v.nota, v.subido_at, p.nombre_visible autor
      from portal.bib_versiones v join portal.personal p on p.user_id = v.subido_por where v.modelo_id = $1 order by v.version desc`, [id])).rows;
    // Otras variantes del mismo procedimiento que esta persona puede ver (para comparar)
    const variantes = m.procedimiento_id ? (await tx.query(`select m.id, m.titulo, m.variante, (select id from portal.bib_versiones x where x.modelo_id = m.id order by version desc limit 1) ultima
      from portal.bib_modelos m where m.procedimiento_id = $1 and m.id <> $2 and m.estado <> 'obsoleto' order by m.updated_at desc limit 20`, [m.procedimiento_id, id])).rows : [];
    const comparar = q.comparar && UUID.test(q.comparar) ? (await tx.query(`select v.texto, v.version, mo.titulo from portal.bib_versiones v join portal.bib_modelos mo on mo.id = v.modelo_id where v.id = $1`, [q.comparar])).rows[0] : null;
    const materias = (await tx.query('select id, nombre from portal.bib_materias where activa order by orden')).rows;
    const procs = (await tx.query('select materia_id, nombre from portal.bib_procedimientos where activo order by orden')).rows;
    return { m, versiones, variantes, comparar, materias, procs };
  });
  if (!d) notFound();
  const { m } = d;
  const global = u.personal!.rol === 'administrador';
  const autor = m.autor_id === u.id;
  const editable = global || (autor && ['pendiente', 'revision'].includes(m.estado) && u.personal!.rol !== 'lectura');
  const actual = d.versiones.find((v) => String(v.version) === q.v) ?? d.versiones[0];
  const cambios = d.comparar && actual ? diferencias(d.comparar.texto, actual.texto) : null;
  return (
    <div className="grid gap-5">
      <p className="text-sm"><Link href="/admin/biblioteca/">← Biblioteca</Link></p>
      <header className="grid gap-1">
        <h1 className="titulo" style={{ marginBottom: 0 }}>{m.titulo}</h1>
        <p className="flex flex-wrap gap-2 items-center text-sm">
          <span className={`chip ${ESTADOS[m.estado]?.chip}`} data-estado-modelo={m.estado}>{ESTADOS[m.estado]?.t}</span><span className="chip chip-neutro">{CLASES[m.clase]?.t}</span>
          <span className="ayuda">Autor: {m.autor} · creado {fecha(m.created_at)}{m.aprobado_at ? ` · aprobado por ${m.aprobador} el ${fecha(m.aprobado_at)}` : ''}</span>
        </p>
      </header>
      <div className="grid lg:grid-cols-[1fr_22rem] gap-5 items-start">
        <div className="grid gap-4">
          {actual ? (
            <section className="card grid gap-2" aria-label="Versión">
              <p className="fila"><span className="font-semibold">Versión {actual.version} · {actual.origen === 'archivo' ? actual.nombre_original : 'texto pegado'} · {actual.autor} · {fecha(actual.subido_at)}</span>
                {actual.origen === 'archivo' ? <span className="flex gap-3 text-sm">{actual.mime === 'application/pdf' ? <a href={`/api/biblioteca/${actual.id}/?ver=1`} target="_blank" rel="noopener">Ver original</a> : null}
                  <a href={`/api/biblioteca/${actual.id}/`}>Descargar original</a></span> : null}</p>
              {actual.avisos?.length ? (
                <div className="aviso text-sm" data-avisos-identificables><strong>Revisa antes de compartir:</strong> {actual.avisos.join(' · ')}. La detección es automática y orientativa: la revisión es humana.</div>
              ) : <p className="ayuda text-sm">No se han detectado datos identificables obvios (la revisión humana sigue siendo necesaria).</p>}
              {cambios ? (
                <div className="grid gap-1" data-diferencias>
                  <p className="text-sm"><strong>Diferencias</strong> entre «{d.comparar!.titulo}» v{d.comparar!.version} (en rojo) y esta versión (en verde) · <Link href={`?v=${actual.version}`}>cerrar</Link></p>
                  <div className="text-sm border rounded p-2 max-h-[32rem] overflow-auto">{cambios.map((c, i) => (
                    <p key={i} style={{ background: c.tipo === '+' ? 'var(--color-ok-bg, #e7f6ec)' : c.tipo === '-' ? 'var(--color-red-bg, #fdecec)' : undefined }}>
                      {c.tipo === '+' ? '+ ' : c.tipo === '-' ? '− ' : ''}{c.texto}</p>))}</div>
                </div>
              ) : <pre className="whitespace-pre-wrap text-sm border rounded p-3 max-h-[32rem] overflow-auto" style={{ fontFamily: 'inherit' }} data-texto-modelo>{actual.texto || 'Sin texto legible (PDF escaneado o imagen).'}</pre>}
            </section>
          ) : null}
          {editable || autor ? <SubirBiblioteca modelo={m.id} /> : null}
        </div>
        <aside className="grid gap-4">
          {global && actual?.mime?.startsWith('application/vnd.openxmlformats') ? (
            <section className="card"><h2 className="subtitulo">Estilo</h2>
              <form action={estiloDesdeModelo}><input type="hidden" name="version" value={actual.id} />
                <button className="btn btn-secundario" style={{ minHeight: 36 }}>Crear estilo a partir de este Word</button></form>
              <p className="ayuda text-xs mt-1">Solo se lee el formato (márgenes, letra, interlineado, numeración); nunca textos ni firmas.</p></section>
          ) : null}
          <section className="card"><h2 className="subtitulo">Estado</h2><EstadoModelo modelo={m.id} estado={m.estado} autor={autor} global={global} clase={m.clase} /></section>
          <section className="card" aria-label="Versiones"><h2 className="subtitulo">Versiones</h2>
            <ul className="grid gap-1 text-sm">{d.versiones.map((v) => (
              <li key={v.id} data-version={v.version}><Link href={`?v=${v.version}`} className={v.id === actual?.id ? 'font-semibold' : ''}>v{v.version}</Link> · {v.autor} · {fecha(v.subido_at)}
                {v.id !== actual?.id && actual ? <> · <Link href={`?v=${actual.version}&comparar=${v.id}`}>comparar</Link></> : null}{v.nota ? <span className="ayuda"> · {v.nota}</span> : null}</li>))}</ul>
          </section>
          {d.variantes.length ? (
            <section className="card" aria-label="Otras variantes"><h2 className="subtitulo">Otras variantes de este procedimiento</h2>
              <ul className="grid gap-1 text-sm">{d.variantes.map((x) => (
                <li key={x.id}><Link href={`/admin/biblioteca/${x.id}/`}>{x.titulo}</Link>{x.variante ? <span className="ayuda"> · {x.variante}</span> : null}
                  {x.ultima && actual ? <> · <Link href={`?v=${actual.version}&comparar=${x.ultima}`}>comparar</Link></> : null}</li>))}</ul>
            </section>
          ) : null}
          <section className="card"><h2 className="subtitulo">Clasificación</h2>
            {d.materias.map((mt) => <datalist key={mt.id} id={`procs-${mt.id}`}>{d.procs.filter((p) => p.materia_id === mt.id).map((p) => <option key={p.nombre} value={p.nombre} />)}</datalist>)}
            <datalist id="procs-">{d.procs.map((p) => <option key={`${p.materia_id}-${p.nombre}`} value={p.nombre} />)}</datalist>
            <FichaModelo m={{ id: m.id, titulo: m.titulo, materia: m.materia_id, procedimiento: m.procedimiento, tipo: m.tipo_escrito, variante: m.variante, clase: m.clase,
              etiquetas: m.etiquetas, organo: m.organo, posicion: m.posicion, fecha: m.fecha_normativa ? new Date(m.fecha_normativa).toISOString().slice(0, 10) : null }}
              materias={d.materias} clases={CLASES} editable={editable} />
          </section>
        </aside>
      </div>
    </div>
  );
}
