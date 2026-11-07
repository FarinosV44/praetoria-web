import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ConCitas, type Cita } from '@/portal/components/ConCitas';
import { EditorEscrito } from '@/portal/components/EditorEscrito';
import { Migas } from '@/portal/components/NavDespacho';
import { comoUsuario } from '@/portal/lib/db';
import { UUID } from '@/portal/lib/datos';
import { diferencias } from '@/portal/lib/biblioteca';
import { estilosDisponibles } from '@/portal/lib/estilos';
import type { Aviso, ModeloUsado } from '@/portal/lib/redactor';
import { env } from '@/portal/lib/env';
import { requerirPersonal } from '@/portal/lib/sesion';

export const metadata: Metadata = { title: 'Borrador de escrito' };

const TIPO_AVISO: Record<string, string> = { laguna: 'Faltas o contradicciones', pendiente: 'Marcadores por completar', norma: 'Normas sin verificar con fuente oficial',
  jurisprudencia: 'Jurisprudencia retirada', trasvase: 'Datos de otro asunto retirados', cita: 'Citas', limite: 'Límites de lectura' };
const CLASE: Record<string, string> = { maestro: 'Maestro', historico_anonimizado: 'Histórico anonimizado', clausula: 'Cláusula' };
const fecha = (d: Date | string) => new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Madrid' }).format(new Date(d));

export default async function Borrador({ params, searchParams }: { params: Promise<{ id: string; escrito: string }>; searchParams: Promise<{ v?: string; con?: string }> }) {
  const u = await requerirPersonal();
  const { id, escrito } = await params;
  const q = await searchParams;
  if (!UUID.test(id) || !UUID.test(escrito)) notFound();
  const d = await comoUsuario(u.id, async (tx) => {
    const e = (await tx.query(`select e.id, e.titulo, e.hilo_id, coalesce(x.titulo, s.referencia) asunto, us.name cliente, pr.nombre procedimiento, pr.materia_id,
        portal.personal_escribe(e.solicitud_id) escribe
      from portal.escritos e join portal.solicitudes s on s.id = e.solicitud_id join identidad."user" us on us.id = s.cliente_id
      left join portal.expedientes x on x.solicitud_id = s.id left join portal.bib_procedimientos pr on pr.id = e.procedimiento_id
      where e.id = $1 and e.solicitud_id = $2`, [escrito, id])).rows[0];
    if (!e) return null;
    const versiones = (await tx.query(`select v.version, v.texto, v.origen, v.instruccion, v.modelos, v.citas, v.avisos, v.created_at, p.nombre_visible autor
      from portal.escrito_versiones v join portal.personal p on p.user_id = v.autor_id where v.escrito_id = $1 order by v.version`, [escrito])).rows as
      { version: number; texto: string; origen: string; instruccion: string | null; modelos: ModeloUsado[]; citas: Cita[]; avisos: Aviso[]; created_at: Date; autor: string }[];
    const estilos = (await estilosDisponibles(tx)).map((s) => ({ id: s.id, nombre: s.nombre }));
    return { e, versiones, estilos };
  });
  if (!d || !d.versiones.length) notFound();
  const ultima = d.versiones[d.versiones.length - 1]!;
  const sel = d.versiones.find((v) => String(v.version) === q.v) ?? ultima;
  const anterior = d.versiones.find((v) => String(v.version) === q.con && v.version !== sel.version) ?? d.versiones.find((v) => v.version === sel.version - 1);
  const cambios = anterior ? diferencias(anterior.texto, sel.texto).filter((c) => c.tipo !== '=') : [];
  const grupos = Object.entries(sel.avisos.reduce<Record<string, string[]>>((a, x) => { (a[x.tipo] ??= []).push(x.texto); return a; }, {}));

  return (
    <div className="expediente">
      <aside className="expediente-lateral" aria-label="Versiones">
        <Migas items={[{ texto: 'Expedientes', href: '/admin/expedientes/' }, { texto: d.e.asunto, href: `/admin/expedientes/${id}/?vista=escritos` }, { texto: d.e.titulo }]} />
        {d.e.hilo_id ? <p className="mb-2"><Link href={`/admin/expedientes/${id}/asistente/?hilo=${d.e.hilo_id}&modo=redactar`} className="btn btn-secundario" style={{ minHeight: 34 }}>Seguir con el asistente</Link></p> : null}
        <p className="etiqueta text-sm mb-1">Versiones</p>
        <ol className="grid gap-1 text-sm" data-versiones>
          {[...d.versiones].reverse().map((v) => (
            <li key={v.version}><Link href={`?v=${v.version}`} aria-current={v.version === sel.version ? 'page' : undefined} className={`block rounded px-2 py-1 no-underline ${v.version === sel.version ? 'activo' : ''}`}>
              <span className="font-semibold block">v{v.version} · {v.origen === 'ia' ? 'IA' : 'a mano'}</span>
              <span className="ayuda block truncate">{v.autor} · {fecha(v.created_at)}</span></Link></li>
          ))}
        </ol>
      </aside>
      <section className="expediente-central">
        <header className="expediente-cabecera">
          <p className="ayuda text-sm">{d.e.cliente} · {d.e.asunto}{d.e.procedimiento ? ` · ${d.e.procedimiento}` : ''}</p>
          <h1 className="subtitulo" style={{ marginBottom: 0 }}>{d.e.titulo} · versión {sel.version}</h1>
          <p className="aviso text-sm mt-1" data-estado-borrador>
            <strong>BORRADOR · requiere revisión del abogado.</strong> No se puede compartir con el cliente, firmar ni presentar desde aquí.
          </p>
          {sel.instruccion ? <p className="text-sm mt-1">Instrucción: «{sel.instruccion}»</p> : null}
        </header>

        <div className="grid gap-4">
          <section aria-label="Modelos utilizados" className="text-sm overflow-x-auto" data-modelos-usados>
            <h2 className="etiqueta">Modelos utilizados</h2>
            {sel.modelos.length ? (
              <table className="tabla">
                <thead><tr><th></th><th>Modelo</th><th>Clase</th><th>Versión</th><th>Secciones aprovechadas</th></tr></thead>
                <tbody>{sel.modelos.map((m) => (
                  <tr key={m.etiqueta}><td>{m.etiqueta}</td><td><Link href={`/admin/biblioteca/${m.modelo_id}/`}>{m.titulo}</Link></td><td>{CLASE[m.clase] ?? m.clase}</td><td>v{m.version}</td><td>{m.secciones}</td></tr>
                ))}</tbody>
              </table>
            ) : <p className="ayuda">Ninguno: redactado solo con lo que consta en el expediente.</p>}
            {sel.origen === 'manual' ? <p className="ayuda text-xs">Versión corregida a mano a partir de la anterior; los modelos son los de su origen.</p> : null}
          </section>

          {grupos.length ? (
            <section aria-label="Avisos" className="text-sm" data-avisos>
              <h2 className="etiqueta">Para revisar antes de usarlo</h2>
              {grupos.map(([t, l]) => <div key={t} className="mb-2" data-aviso={t}><strong>{TIPO_AVISO[t] ?? t}</strong><ul>{l.map((x, i) => <li key={i}>⚠️ {x}</li>)}</ul></div>)}
            </section>
          ) : null}

          <section aria-label="Texto del borrador" className="control" data-texto-borrador>
            <ConCitas texto={sel.texto} citas={sel.citas} />
          </section>

          {sel.citas.length ? (
            <section aria-label="Fuentes citadas" className="text-sm">
              <h2 className="etiqueta">Fuentes del expediente citadas</h2>
              <ul>{sel.citas.map((c) => <li key={c.id}>[{c.id}] {c.enlace ? <a href={c.enlace} target="_blank" rel="noopener">{c.etiqueta}</a> : c.etiqueta}</li>)}</ul>
            </section>
          ) : null}

          {anterior ? (
            <details className="text-sm" data-diferencias>
              <summary>Cambios respecto a la versión {anterior.version} ({cambios.length} líneas)</summary>
              {d.versiones.length > 2 ? (
                <form className="flex gap-2 items-center my-2" data-comparar>
                  <input type="hidden" name="v" value={sel.version} />
                  <label className="flex gap-1 items-center">Comparar la versión {sel.version} con
                    <select name="con" defaultValue={anterior.version}>{d.versiones.filter((v) => v.version !== sel.version).map((v) => <option key={v.version} value={v.version}>versión {v.version}</option>)}</select>
                  </label>
                  <button className="btn-texto">Comparar</button>
                </form>
              ) : null}
              <div className="control max-h-[32rem] overflow-auto">{cambios.slice(0, 400).map((c, i) => (
                <p key={i} data-cambio={c.tipo} style={{ background: c.tipo === '+' ? 'var(--color-ok-bg, #e7f6ec)' : 'var(--color-red-bg, #fdecec)' }}>{c.tipo === '+' ? '+ ' : '− '}{c.texto}</p>))}</div>
            </details>
          ) : null}

          <form method="post" action="/api/escritos/exportar/" className="flex flex-wrap gap-2 items-center text-sm" data-exportar>
            <input type="hidden" name="escrito" value={escrito} /><input type="hidden" name="version" value={sel.version} />
            {d.e.materia_id ? <input type="hidden" name="materia" value={d.e.materia_id} /> : null}
            {d.estilos.length ? d.estilos.map((e, i) => <label key={e.id} className="flex gap-1 items-center"><input type="radio" name="estilo" value={e.id} defaultChecked={i === 0} /> {e.nombre}</label>)
              : <span className="ayuda">Estilo base</span>}
            <button name="formato" value="docx" className="btn-texto">Descargar Word</button>
            <button name="formato" value="pdf" className="btn-texto">Descargar PDF</button>
            <span className="ayuda text-xs">Sale marcado como BORRADOR en cada página.</span>
          </form>

          {d.e.escribe && sel.version === ultima.version ? (
            <EditorEscrito solicitud={id} escrito={escrito} base={ultima.version} texto={ultima.texto} ia={!!env.iaClave} />
          ) : d.e.escribe ? <p className="ayuda text-sm">Estás viendo una versión anterior. <Link href={`?v=${ultima.version}`}>Abre la versión {ultima.version}</Link> para editarla.</p> : null}
        </div>
      </section>
    </div>
  );
}
