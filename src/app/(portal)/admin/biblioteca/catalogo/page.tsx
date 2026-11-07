import type { Metadata } from 'next';
import Link from 'next/link';
import { Cabecera } from '@/portal/components/despacho';
import { NuevaMateria, NuevoProcedimiento } from '@/portal/components/Biblioteca';
import { alternarProcedimiento } from '../acciones';
import { comoUsuario } from '@/portal/lib/db';
import { requerirGlobal } from '@/portal/lib/sesion';

export const metadata: Metadata = { title: 'Catálogo de procedimientos' };

export default async function Catalogo() {
  const u = await requerirGlobal();
  const d = await comoUsuario(u.id, async (tx) => ({
    materias: (await tx.query('select id, nombre from portal.bib_materias where activa order by orden, nombre')).rows,
    procs: (await tx.query(`select p.id, p.materia_id, p.nombre, p.activo, (select count(*)::int from portal.bib_modelos m where m.procedimiento_id = p.id) n
      from portal.bib_procedimientos p order by p.orden, p.nombre`)).rows,
  }));
  return (
    <div className="grid gap-5">
      <p className="text-sm"><Link href="/admin/biblioteca/">← Biblioteca</Link></p>
      <Cabecera titulo="Catálogo de procedimientos" migas={[{ texto: 'Biblioteca', href: '/admin/biblioteca/' }, { texto: 'Catálogo' }]} />
      <p className="ayuda">Solo nombres de materias y procedimientos para clasificar vuestros escritos: el catálogo no contiene escritos ni normativa. Desactivar un procedimiento no borra sus modelos.</p>
      <section className="card grid gap-3"><h2 className="subtitulo">Añadir procedimiento</h2><NuevoProcedimiento materias={d.materias} /><NuevaMateria /></section>
      {d.materias.map((m) => (
        <section key={m.id} className="card"><h2 className="subtitulo">{m.nombre}</h2>
          <ul className="grid gap-1 text-sm">{d.procs.filter((p) => p.materia_id === m.id).map((p) => (
            <li key={p.id} className="fila" data-catalogo={p.nombre}><span className={p.activo ? '' : 'ayuda line-through'}>{p.nombre} <span className="ayuda">· {p.n} modelos</span></span>
              <form action={alternarProcedimiento}><input type="hidden" name="procedimiento" value={p.id} /><button className="btn-texto text-xs">{p.activo ? 'Desactivar' : 'Activar'}</button></form></li>
          ))}</ul>
        </section>
      ))}
    </div>
  );
}
