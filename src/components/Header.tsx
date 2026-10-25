'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { areasDe, groups, nav, site, type Group } from '@/lib/site';
import { Icon } from './Icon';

export function Header() {
  const path = usePathname() || '/';
  const [menuOpen, setMenuOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<Group | null>(null);
  const navRef = useRef<HTMLElement>(null);

  // Al cambiar de página se cierran el menú móvil y los submenús (ajuste durante el render, sin efecto)
  const [lastPath, setLastPath] = useState(path);
  if (path !== lastPath) {
    setLastPath(path);
    setMenuOpen(false);
    setOpenGroup(null);
  }

  const isActive = (href: string) => path === href || (href !== '/' && path.startsWith(href));
  const groupActive = (g: Group) => areasDe(g).some((a) => path.startsWith(`/${a.slug}/`));

  // Cerrar submenús al pulsar fuera o Escape; cerrar todo al navegar
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.has-sub')) setOpenGroup(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenGroup(null);
    };
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <header className="site-header" lang="es">
      <div className="wrap bar">
        <Link href="/" className="brand" aria-label={`${site.name}, inicio`}>
          <img src="/media/logo-praetoria-sin-fondo.png" alt={site.name} width={560} height={151} />
        </Link>

        <button className="menu-toggle" aria-expanded={menuOpen} aria-controls="menu" onClick={() => setMenuOpen((v) => !v)}>
          <span className="menu-toggle__lines" aria-hidden="true" />
          Menú
        </button>

        <nav id="menu" ref={navRef} className={menuOpen ? 'menu open' : 'menu'} aria-label="Principal">
          <ul className="menu__list">
            {nav.map((item) =>
              'group' in item ? (
                <li key={item.label} className={openGroup === item.group ? 'menu__item has-sub open' : 'menu__item has-sub'}>
                  <button
                    className={groupActive(item.group) ? 'menu__link is-active' : 'menu__link'}
                    aria-expanded={openGroup === item.group}
                    onClick={() => setOpenGroup((g) => (g === item.group ? null : item.group))}
                  >
                    {item.label}
                    <Icon name="chevron" />
                  </button>
                  <div className="sub">
                    <p className="sub__title">{groups[item.group].title}</p>
                    <ul>
                      {areasDe(item.group).map((a) => (
                          <li key={a.slug}>
                            <Link href={`/${a.slug}/`} aria-current={path === `/${a.slug}/` ? 'page' : undefined}>
                              <strong>{a.name}</strong>
                              <span>{a.short}</span>
                            </Link>
                          </li>
                        ))}
                    </ul>
                    {item.group === 'particulares' && (
                      <Link className="sub__extra" href="/abogado-divorcio-horta-nord-valencia/">
                        Divorcio de mutuo acuerdo: 399 € en total
                      </Link>
                    )}
                    {item.group === 'empresas' && (
                      <Link className="sub__extra" href="/blog/categoria/transporte/">
                        Guías sobre el DECA digital
                      </Link>
                    )}
                  </div>
                </li>
              ) : (
                <li key={item.label} className="menu__item">
                  <Link
                    className={isActive(item.href) ? 'menu__link is-active' : 'menu__link'}
                    href={item.href}
                    aria-current={path === item.href ? 'page' : undefined}
                  >
                    {item.label}
                  </Link>
                </li>
              ),
            )}
          </ul>
          <Link className="btn btn--red menu__cta" href="/contacto/">
            Contactar con el despacho
          </Link>
        </nav>
      </div>
    </header>
  );
}
