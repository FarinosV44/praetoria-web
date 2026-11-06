'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Enlace = { href: string; texto: string; n?: number };
type Grupo = { titulo: string; enlaces: Enlace[] };

/** Navegación del despacho: lateral en escritorio y desplazable en móvil. Marca la sección actual. */
export function NavDespacho({ grupos }: { grupos: Grupo[] }) {
  const ruta = usePathname();
  const activo = (href: string) => (href === '/admin/' ? ruta === '/admin/' || ruta === '/admin' : ruta.startsWith(href) && !grupos.some((g) => g.enlaces.some((e) => e.href !== href && e.href.startsWith(href) && ruta.startsWith(e.href))));
  return (
    <nav aria-label="Despacho" className="nav-despacho">
      <button type="button" className="nav-buscar" onClick={() => window.dispatchEvent(new Event('abrir-paleta'))}>
        <span>Ir a…</span><kbd>Ctrl K</kbd>
      </button>
      {grupos.map((g) => (
        <div key={g.titulo} className="nav-grupo">
          <p className="nav-titulo">{g.titulo}</p>
          {g.enlaces.map((e) => (
            <Link key={e.href} href={e.href} aria-current={activo(e.href) ? 'page' : undefined}>
              {e.texto}{e.n ? <span className="nav-n" aria-label={`${e.n} sin leer`}>{e.n}</span> : null}
            </Link>
          ))}
        </div>
      ))}
    </nav>
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
