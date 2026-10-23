import Link from 'next/link';
import type { Metadata } from 'next';
import { areas } from '@/lib/site';

export const metadata: Metadata = {
  title: { absolute: 'Página no encontrada | Praetoria División Jurídica' },
  description: 'La página que buscas no existe o ha cambiado de dirección.',
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <section className="section">
      <div className="wrap">
        <h1>Esta página no existe</h1>
        <p className="lede">Puede que haya cambiado de dirección al reorganizar la web. Prueba desde una de estas secciones:</p>
        <ul className="index-list">
          {areas.map((a) => (
            <li key={a.slug}>
              <h3>
                <Link href={`/${a.slug}/`}>{a.name}</Link>
              </h3>
              <p>{a.short}</p>
            </li>
          ))}
          <li>
            <h3>
              <Link href="/blog/">Blog</Link>
            </h3>
            <p>Todos los artículos, ordenados por tema.</p>
          </li>
        </ul>
      </div>
    </section>
  );
}
