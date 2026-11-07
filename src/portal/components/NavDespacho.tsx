'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Salir } from './Salir';

type Enlace = { href: string; texto: string; n?: number };
type Grupo = { titulo: string; enlaces: Enlace[] };

const Flecha = () => <svg aria-hidden="true" viewBox="0 0 16 16" width="12" height="12"><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>;
const CLAVE_PLEGADA = 'praetoria:nav-plegada';

/** Navegación del despacho: barra lateral plegable en escritorio y cajón en móvil. Los grupos empiezan abiertos (son pocas entradas) y se pueden plegar; el de la página actual se abre solo. */
export function NavDespacho({ grupos, correo }: { grupos: Grupo[]; correo?: string }) {
  const ruta = usePathname();
  const activo = (href: string) => (href === '/admin/' ? ruta === '/admin/' || ruta === '/admin' : ruta.startsWith(href) && !grupos.some((g) => g.enlaces.some((e) => e.href !== href && e.href.startsWith(href) && ruta.startsWith(e.href))));
  const actual = grupos.find((g) => g.enlaces.some((e) => activo(e.href)))?.titulo;
  const [abiertos, setAbiertos] = useState<Set<string>>(() => new Set(grupos.map((g) => g.titulo)));
  const [plegada, setPlegada] = useState(false);
  const [cajon, setCajon] = useState(false);

  // El servidor no conoce localStorage: se lee al montar, igual que el ajuste equivalente de DeCA.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { try { setPlegada(localStorage.getItem(CLAVE_PLEGADA) === '1'); } catch { /* sin almacenamiento: sigue desplegada */ } }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (actual) setAbiertos((p) => (p.has(actual) ? p : new Set([...p, actual]))); }, [actual]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setCajon(false), [ruta]);
  const plegar = (v: boolean) => { setPlegada(v); try { localStorage.setItem(CLAVE_PLEGADA, v ? '1' : '0'); } catch { /* solo dura esta vista */ } };
  const alternar = (t: string) => setAbiertos((p) => { const s = new Set(p); if (s.has(t)) s.delete(t); else s.add(t); return s; });

  const enlaces = (prefijo: string) => grupos.map((g) => {
    const abierto = abiertos.has(g.titulo);
    const avisos = g.enlaces.reduce((s, e) => s + (e.n ?? 0), 0);
    return (
      <div key={g.titulo}>
        <button type="button" className="nav-seccion" aria-expanded={abierto} aria-controls={`${prefijo}-${g.titulo}`} data-actual={g.titulo === actual ? '' : undefined} onClick={() => alternar(g.titulo)}>
          <span>{g.titulo}{!abierto && avisos ? ` · ${avisos}` : ''}</span><Flecha />
        </button>
        {abierto ? (
          <ul id={`${prefijo}-${g.titulo}`} className="nav-lista">
            {g.enlaces.map((e) => (
              <li key={e.href}>
                <Link href={e.href} aria-current={activo(e.href) ? 'page' : undefined}>
                  {e.texto}{e.n ? <span className="nav-n" aria-label={`${e.n} sin leer`}>{e.n}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  });

  return (
    <>
      <div className="nav-movil">
        <Link href="/admin/" aria-label="Praetoria Abogados · Inicio del despacho"><img src="/logo-praetoria.png" alt="" width={560} height={109} /></Link>
        <button type="button" aria-expanded={cajon} aria-controls="nav-cajon" aria-label={cajon ? 'Cerrar menú' : 'Abrir menú'} onClick={() => setCajon((v) => !v)}>
          <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20">{cajon
            ? <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" fill="none" />
            : <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" fill="none" />}</svg>
        </button>
      </div>
      {cajon ? (
        <nav id="nav-cajon" aria-label="Despacho" className="nav-cajon">
          {enlaces('m')}
          <div className="nav-cajon-salir"><span>{correo}</span><Salir /></div>
        </nav>
      ) : null}
      {plegada ? (
        <div className="nav-lateral" data-plegada="">
          <button type="button" className="nav-icono" aria-label="Mostrar menú" title="Mostrar menú" onClick={() => plegar(false)}><Flecha /></button>
        </div>
      ) : (
        <nav aria-label="Despacho" className="nav-lateral">
          <div className="nav-marca">
            <Link href="/admin/" aria-label="Praetoria Abogados · Inicio del despacho"><img src="/logo-praetoria.png" alt="" width={560} height={109} /></Link>
            <button type="button" className="nav-icono" aria-label="Ocultar menú" title="Ocultar menú" onClick={() => plegar(true)}>
              <svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14"><path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
            </button>
          </div>
          {enlaces('d')}
          {correo ? <p className="nav-pie">{correo}</p> : null}
        </nav>
      )}
    </>
  );
}

/** Migas de pan coherentes en las pantallas interiores. */
export function Migas({ items }: { items: { texto: string; href?: string }[] }) {
  return (
    <nav aria-label="Ruta" className="migas">
      <ol>{items.map((m, i) => <li key={i}>{m.href ? <Link href={m.href}>{m.texto}</Link> : <span aria-current="page">{m.texto}</span>}</li>)}</ol>
    </nav>
  );
}
