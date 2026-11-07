import type { Metadata } from 'next';
import Link from 'next/link';
import { Cabecera, enlaceCon, FiltroSelector, Filtros, FiltroTexto, Resultados, textoOpcion, Vacio, Vistas } from '@/portal/components/despacho';
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
  const BASE = '/admin/biblioteca/';
  const enlace = (c: Record<string, string | undefined>) => enlaceCon(BASE, f, c);
  const opcionesProc: [string, string][] = [['', 'Todos'], ...d.procs.map((p): [string, string] => [p.id, p.nombre])];
  const opcionesClase: [string, string][] = [['', 'Todas'], ...Object.entries(CLASES).map(([k, v]): [string, string] => [k, v.t])];
  const activos = [
    f.q ? { texto: `Buscar: ${f.q}`, href: enlace({ q: undefined }) } : null,
    f.procedimiento ? { texto: `Procedimiento: ${textoOpcion(opcionesProc, f.procedimiento)}`, href: enlace({ procedimiento: undefined }) } : null,
    f.clase ? { texto: `Clase: ${textoOpcion(opcionesClase, f.clase)}`, href: enlace({ clase: undefined }) } : null,
  ].filter((x): x is { texto: string; href: string } => !!x);
  return (
    <div className="grid gap-4">
      <Cabecera titulo="Biblioteca jurídica" entradilla="Modelos y escritos del despacho. El Copiloto solo se apoya en los modelos aprobados."
        acciones={<><Link href="/admin/biblioteca/estilos/" className="btn btn-secundario">Estilos</Link>
          {u.personal!.rol === 'administrador' ? <Link href="/admin/biblioteca/catalogo/" className="btn btn-secundario">Catálogo de procedimientos</Link> : null}</>} />
      <Vistas etiqueta="Estado de los modelos" visible="Estado" items={[['', 'Vigentes'], ['aprobado', 'Aprobados'], ['revision', 'En revisión'], ['pendiente', 'Pendientes'], ['obsoleto', 'Obsoletos']].map(([v, t]) => ({ texto: t!, href: enlace({ estado: v || undefined }), activo: (f.estado ?? '') === v }))} />
      <Vistas etiqueta="Materias" visible="Materia" items={[{ texto: 'Todas', href: enlace({ materia: undefined, procedimiento: undefined }), activo: !f.materia }, ...d.materias.map((m) => ({ texto: m.nombre, n: m.n, href: enlace({ materia: m.id, procedimiento: undefined }), activo: f.materia === m.id }))]} />
      <Filtros accion={BASE} etiqueta="Buscar en la biblioteca" columnas={4} ocultos={{ estado: f.estado, materia: f.materia }} activos={activos} limpiar={enlaceCon(BASE, { estado: f.estado, materia: f.materia })}
        basicos={<>
          <FiltroTexto nombre="q" etiqueta="Buscar en la biblioteca" valor={f.q} ayuda="Contenido, procedimiento, materia o etiqueta" ancho />
          {f.materia ? <FiltroSelector nombre="procedimiento" etiqueta="Procedimiento" valor={f.procedimiento} opciones={opcionesProc} /> : null}
          <FiltroSelector nombre="clase" etiqueta="Clase" valor={f.clase} opciones={opcionesClase} />
        </>} />
      {f.materia ? (
        <section className="card" aria-label="Procedimientos">
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-1 text-sm">
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
      <section aria-label="Modelos" className="grid gap-3">
        <Resultados total={d.modelos.length} nombre={['modelo', 'modelos']} />
        {d.modelos.length === 0 ? <Vacio titulo={f.q ? 'No hay modelos que coincidan' : 'Todavía no hay modelos aquí'}>{f.q ? 'Prueba con otras palabras o quita algún filtro.' : 'Arrastra vuestros escritos para empezar.'}</Vacio> : (
          <div className="tabla-marco">
            <table className="tabla tabla-apilada">
              <caption className="sr-only">Modelos de la biblioteca</caption>
              <thead><tr><th>Modelo</th><th>Clasificación</th><th>Estado</th><th>Clase</th><th>Autor</th><th>Actualizado</th></tr></thead>
              <tbody>
                {d.modelos.map((m) => (
                  <tr key={m.id} data-modelo={m.titulo}>
                    <td data-e="Modelo"><Link href={`/admin/biblioteca/${m.id}/`}>{m.titulo}</Link>
                      {m.etiquetas?.length ? <span className="ref">{m.etiquetas.map((e: string) => `#${e}`).join(' ')}</span> : null}
                      {m.fragmento ? <span className="ref">…{m.fragmento}…</span> : null}</td>
                    <td data-e="Clasificación" className="text-sm">{[m.materia, m.procedimiento, m.variante, m.tipo_escrito].filter(Boolean).join(' · ') || <span className="ayuda">Sin clasificar</span>}</td>
                    <td data-e="Estado"><span className={`chip ${ESTADOS[m.estado]?.chip}`}>{ESTADOS[m.estado]?.t}</span></td>
                    <td data-e="Clase"><span className="chip chip-neutro">{CLASES[m.clase]?.t}</span></td>
                    <td data-e="Autor" className="text-sm">{m.autor}<span className="ref">v{m.version ?? 0}</span></td>
                    <td data-e="Actualizado" className="text-sm whitespace-nowrap">{fecha(m.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
