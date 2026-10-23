import Link from 'next/link';
import { site } from '@/lib/site';
import { JsonLd } from './JsonLd';

type Item = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: Item[] }) {
  const all: Item[] = [{ label: 'Inicio', href: '/' }, ...items];
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: all.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.label,
      ...(it.href ? { item: new URL(it.href, site.url).href } : {}),
    })),
  };
  return (
    <>
      <nav className="crumbs" aria-label="Ruta de navegación">
        <ol>
          {all.map((it) => (
            <li key={it.label}>{it.href ? <Link href={it.href}>{it.label}</Link> : <span aria-current="page">{it.label}</span>}</li>
          ))}
        </ol>
      </nav>
      <JsonLd data={ld} />
    </>
  );
}
