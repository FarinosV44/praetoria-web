import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SubirBiblioteca } from '@/portal/components/Biblioteca';
import { buscarModelos, CLASES, ESTADOS } from '@/portal/lib/biblioteca';
import { comoUsuario } from '@/portal/lib/db';
import { requerirPersonal } from '@/portal/lib/sesion';
import { fecha } from '@/portal/lib/textos';

export const metadata: Metadata = { title: 'Biblioteca jurídica' };

export default async function Biblioteca({ searchParams }: { searchParams: Promise<{ q?: string; materia?: string; procedimiento?: string; estado?: string; clase?: string }> }) {
  const u = await requerirPersonal();
  if (u.personal!.rol === 'facturacion') redirect('/admin/');
  const f = await searchParams;
  const d = await comoUsuario(u.id, async (tx) => {
    const materias = (await tx.query(`select mt.id, mt.nombre, count(m.id) filter (where m.estado <> 'obsoleto')::int n
      from portal.bib_materias mt left join portal.bib_modelos m on m.materia_id = mt.id where mt.activa group by mt.id order by mt.orden, mt.nombre`)).rows;
    const procs = f.materia ? (await tx.query(`select p.id, p.nombre, count(m.id) filter (where m.estado <> 'obsoleto')::int n
      from portal.bib_procedimientos p left join portal.bib_modelos m on m.procedimiento_id = p.id where p.materia_id = $1 and p.activo group by p.id order by p.orden, p.nombre`, [f.materia])).rows : [];
    return { materias, procs, modelos: await buscarModelos(tx, f) };
  });
  const enlace = (c: Record<string, string | undefined>) => `?${new URLSearchParams(Object.entries({ ...f, ...c }).filter(([, v]) => v) as [string, string][])}`;
  return (
    <div className="grid gap-5">
      <div className="fila"><h1 className="titulo">Biblioteca jurídica</h1>
        {u.personal!.rol === 'administrador' ? <Link href="/admin/biblioteca/catalogo/" className="btn btn-secundario">Catálogo de procedimientos</Link> : null}</div>
      <form className="flex gap-2" role="search">
        {f.materia ? <input type="hidden" name="materia" value={f.materia} /> : null}
        <input name="q" type="search" defaultValue={f.q ?? ''} placeholder="Buscar por contenido, procedimiento, materia o etiqueta (p. ej. «modificación de medidas», «TEAR»)" aria-label="Buscar en la biblioteca" className="border rounded-md p-3 flex-1 min-w-0" />
        <button className="btn btn-primario">Buscar</button>
      </form>
      <nav aria-label="Materias" className="flex flex-wrap gap-2">
        <Link href={enlace({ materia: undefined, procedimiento: undefined })} className={`chip ${!f.materia ? 'chip-info' : 'chip-neutro'} no-underline`}>Todas</Link>
        {d.materias.map((m) => <Link key={m.id} href={enlace({ materia: m.id, procedimiento: undefined })} className={`chip ${f.materia === m.id ? 'chip-info' : 'chip-neutro'} no-underline`}>📁 {m.nombre} ({m.n})</Link>)}
      </nav>
      {f.materia ? (
        <section className="card" aria-label="Procedimientos">
          <ul className="grid sm:grid-cols-2 gap-1 text-sm">
            {d.procs.map((p) => (
              <li key={p.id} data-procedimiento={p.nombre}>
                <Link href={enlace({ procedimiento: p.id })} className={f.procedimiento === p.id ? 'font-semibold' : ''}>{p.nombre}</Link>
                {p.n ? <span className="ayuda"> · {p.n} modelo{p.n > 1 ? 's' : ''}</span> : <span className="ayuda"> · modelo no disponible — sube el primero</span>}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {u.personal!.rol !== 'lectura' ? <SubirBiblioteca /> : null}
      <section aria-label="Modelos" className="grid gap-2">
        <p className="flex flex-wrap gap-2 text-sm">
          {[['', 'Vigentes'], ['aprobado', 'Aprobados'], ['revision', 'En revisión'], ['pendiente', 'Pendientes'], ['obsoleto', 'Obsoletos']].map(([v, t]) => (
            <Link key={v} href={enlace({ estado: v || undefined })} className={`chip ${(f.estado ?? '') === v ? 'chip-info' : 'chip-neutro'} no-underline`}>{t}</Link>))}
        </p>
        {d.modelos.length === 0 ? <p className="ayuda">{f.q ? 'No hay modelos que coincidan.' : 'Todavía no hay modelos aquí. Arrastra vuestros escritos para empezar.'}</p> : null}
        <ul className="grid gap-2">
          {d.modelos.map((m) => (
            <li key={m.id} className="card" data-modelo={m.titulo}>
              <p className="fila"><Link href={`/admin/biblioteca/${m.id}/`} className="font-semibold">{m.titulo}</Link>
                <span className="flex gap-1"><span className={`chip ${ESTADOS[m.estado]?.chip}`}>{ESTADOS[m.estado]?.t}</span><span className="chip chip-neutro">{CLASES[m.clase]?.t}</span></span></p>
              <p className="ayuda text-sm">{[m.materia, m.procedimiento, m.variante, m.tipo_escrito].filter(Boolean).join(' · ') || 'Sin clasificar'} · v{m.version ?? 0} · {m.autor} · {fecha(m.updated_at)}
                {m.etiquetas?.length ? ` · ${m.etiquetas.map((e: string) => `#${e}`).join(' ')}` : ''}</p>
              {m.fragmento ? <p className="text-sm mt-1">…{m.fragmento}…</p> : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
