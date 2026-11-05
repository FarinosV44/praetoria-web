import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EditarEstilo } from '@/portal/components/Estilos';
import { comoUsuario } from '@/portal/lib/db';
import { UUID } from '@/portal/lib/datos';
import { normalizarEstilo } from '@/portal/lib/render';
import { requerirGlobal } from '@/portal/lib/sesion';
import { fecha } from '@/portal/lib/textos';

export const metadata: Metadata = { title: 'Estilo' };

export default async function Estilo({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ detectado?: string }> }) {
  const u = await requerirGlobal();
  const { id } = await params;
  const q = await searchParams;
  if (!UUID.test(id)) notFound();
  const d = await comoUsuario(u.id, async (tx) => {
    const e = (await tx.query('select * from portal.bib_estilos where id = $1', [id])).rows[0];
    if (!e) return null;
    const v = (await tx.query(`select v.version, v.config, v.created_at, p.nombre_visible autor, m.titulo origen from portal.bib_estilo_versiones v
      join portal.personal p on p.user_id = v.creado_por left join portal.bib_modelos m on m.id = v.origen_modelo where v.estilo_id = $1 order by v.version desc`, [id])).rows;
    return { e, v };
  });
  if (!d || !d.v[0]) notFound();
  return (
    <div className="grid gap-5">
      <p className="text-sm"><Link href="/admin/biblioteca/estilos/">← Estilos</Link></p>
      <div className="fila"><h1 className="titulo" style={{ marginBottom: 0 }}>{d.e.nombre}</h1>
        <span className="flex gap-3 text-sm"><a href={`/api/escritos/muestra/?estilo=${id}&formato=pdf`} target="_blank" rel="noopener">Vista previa PDF</a><a href={`/api/escritos/muestra/?estilo=${id}&formato=docx`}>Muestra en Word</a></span></div>
      {q.detectado ? <p className="aviso text-sm" role="status">Formato leído del Word de referencia: revísalo y guarda. Solo se ha tomado el formato (nunca textos, nombres ni firmas).</p> : null}
      <section className="card"><EditarEstilo id={id} destino={d.e.destino} materias={d.e.materias} e={normalizarEstilo(d.v[0].config)} /></section>
      <section className="card"><h2 className="subtitulo">Versiones</h2><ul className="grid gap-1 text-sm">{d.v.map((v) => (
        <li key={v.version}>v{v.version} · {v.autor} · {fecha(v.created_at)}{v.origen ? ` · leída de «${v.origen}»` : ''}</li>))}</ul></section>
    </div>
  );
}
