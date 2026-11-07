import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChatVivo } from '@/portal/components/ChatVivo';
import { ConCitas, type Cita } from '@/portal/components/ConCitas';
import { comoUsuario } from '@/portal/lib/db';
import { UUID } from '@/portal/lib/datos';
import { env } from '@/portal/lib/env';
import { opcionesIA } from '@/portal/lib/ia-opciones';
import { requerirPersonal } from '@/portal/lib/sesion';

export const metadata: Metadata = { title: 'Copiloto jurídico' };
const RAPIDAS = ['¿Qué modelos tenemos de divorcio contencioso?', 'Busca argumentos sobre medidas provisionales en la biblioteca', '¿Qué estructura usamos en los recursos de apelación?'];

/** Asistente general del despacho: consulta la biblioteca aprobada. No accede a ningún expediente. */
export default async function Copiloto({ searchParams }: { searchParams: Promise<{ hilo?: string }> }) {
  const u = await requerirPersonal();
  if (u.personal!.rol === 'facturacion') redirect('/admin/');
  const q = await searchParams;
  const d = await comoUsuario(u.id, async (tx) => {
    const hilos = (await tx.query(`select id, titulo from portal.ia_hilos where solicitud_id is null order by created_at desc limit 40`)).rows as { id: string; titulo: string }[];
    const hilo = q.hilo && UUID.test(q.hilo) && hilos.some((h) => h.id === q.hilo) ? q.hilo : null;
    const mensajes = hilo ? (await tx.query(`select id, rol, texto, citas, limites, modelo, created_at from portal.ia_mensajes where hilo_id = $1 order by created_at`, [hilo])).rows as
      { id: string; rol: string; texto: string; citas: Cita[]; limites: string[]; modelo: string | null }[] : [];
    const reanudar = hilo ? (await tx.query(`select id from portal.ia_ejecuciones where hilo_id = $1 and estado = 'en_curso' and latido_at > now() - interval '3 minutes' limit 1`, [hilo])).rows[0]?.id as string | undefined : undefined;
    const indexados = (await tx.query(`select count(*)::int n from portal.bib_fragmentos f where portal.bib_usable(f.version_id)`)).rows[0].n as number;
    return { hilos, hilo, mensajes, reanudar: reanudar ?? null, indexados, opciones: await opcionesIA(tx) };
  });
  return (
    <div className="expediente">
      <aside className="expediente-lateral" aria-label="Conversaciones">
        <p className="mb-2"><Link href="/admin/ia/" className="btn btn-secundario" style={{ minHeight: 34 }}>+ Nueva conversación</Link></p>
        <p className="mb-2"><Link href="/admin/ia/nuevo/" className="btn btn-secundario" style={{ minHeight: 34 }}>Nuevo escrito</Link></p>
        <ul className="grid gap-1 text-sm">{d.hilos.map((h) => <li key={h.id}><Link href={`?hilo=${h.id}`} className={`block rounded px-2 py-1 no-underline truncate ${h.id === d.hilo ? 'activo' : ''}`}>{h.titulo}</Link></li>)}</ul>
      </aside>
      <section className="expediente-central">
        <header className="expediente-cabecera">
          <p className="ayuda text-sm">Consulta los modelos aprobados de la biblioteca · para un asunto concreto, abre el asistente de su expediente</p>
          <h1 className="subtitulo" style={{ marginBottom: 0 }}>Copiloto jurídico</h1>
        </header>
        {!env.iaClave ? <p className="aviso">El asistente de IA no está configurado en este servidor.</p> : (<>
          {d.indexados === 0 ? <p className="aviso text-sm" data-sin-modelos>La biblioteca no tiene todavía modelos aprobados e indexados, así que el Copiloto no tiene en qué apoyarse. <Link href="/admin/biblioteca/">Revisa y aprueba modelos</Link>.</p> : null}
          <ol className="cronologia" aria-label="Conversación" aria-live="polite">
            {d.mensajes.map((m) => (
              <li key={m.id} className={`burbuja ${m.rol === 'usuario' ? 'burbuja-interna' : 'burbuja-documento'}`} data-ia={m.rol}>
                {m.rol === 'asistente' ? <p className="meta">Copiloto{m.modelo ? ` · ${m.modelo}` : ''} · borrador, revísalo</p> : null}
                {m.rol === 'asistente' ? <ConCitas texto={m.texto} citas={m.citas} /> : <p className="whitespace-pre-wrap">{m.texto}</p>}
                {m.citas.length ? <ul className="text-xs mt-1" data-fuentes>{m.citas.map((c) => <li key={c.id}>[{c.id}] {c.enlace ? <a href={c.enlace} target="_blank" rel="noopener">{c.etiqueta}</a> : c.etiqueta}</li>)}</ul> : null}
                {m.limites.length ? <ul className="text-xs mt-1" data-limites>{m.limites.map((l, i) => <li key={i}>⚠️ {l}</li>)}</ul> : null}
              </li>
            ))}
          </ol>
          <ChatVivo solicitud={null} hilo={d.hilo} opciones={d.opciones} rapidas={d.mensajes.length ? [] : RAPIDAS} reanudar={d.reanudar} />
        </>)}
      </section>
    </div>
  );
}
