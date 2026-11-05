import type { Metadata } from 'next';
import Link from 'next/link';
import { CrearEstilo } from '@/portal/components/Estilos';
import { comoUsuario } from '@/portal/lib/db';
import { DESTINOS, estilosDisponibles } from '@/portal/lib/estilos';
import { requerirPersonal } from '@/portal/lib/sesion';

export const metadata: Metadata = { title: 'Estilos de los escritos' };

export default async function Estilos() {
  const u = await requerirPersonal();
  const lista = await comoUsuario(u.id, (tx) => estilosDisponibles(tx));
  const global = u.personal!.rol === 'administrador';
  return (
    <div className="grid gap-5">
      <p className="text-sm"><Link href="/admin/biblioteca/">← Biblioteca</Link></p>
      <h1 className="titulo">Estilos de los escritos</h1>
      <p className="ayuda">Formato con el que se exportan los borradores a Word y PDF: tipografía, márgenes, interlineado, títulos, numeración, encabezado, pie y firma. Para crear uno a partir de un Word vuestro, súbelo a la biblioteca como «Estilo / maquetación» y usa «Crear estilo a partir de este Word».</p>
      {global ? <section className="card"><h2 className="subtitulo">Nuevo estilo</h2><CrearEstilo /></section> : null}
      <ul className="grid gap-2">{lista.length === 0 ? <li className="ayuda">Todavía no hay estilos: se usa el estilo base (Times New Roman 12, interlineado 1,5).</li> : null}
        {lista.map((e) => <li key={e.id} className="card fila" data-estilo={e.nombre}><span><Link href={`/admin/biblioteca/estilos/${e.id}/`} className="font-semibold">{e.nombre}</Link>
          <span className="ayuda"> · {DESTINOS[e.destino]} · v{e.version} · {e.config.fuente} {e.config.tamano} pt</span></span>
          <a href={`/api/escritos/muestra/?estilo=${e.id}&formato=pdf`} target="_blank" rel="noopener" className="text-sm">Vista previa PDF</a></li>)}</ul>
    </div>
  );
}
