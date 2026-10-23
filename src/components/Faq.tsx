import type { ReactNode } from 'react';
import { JsonLd } from './JsonLd';

// Preguntas frecuentes con marcado FAQPage
export function Faq({ items, title = 'Preguntas frecuentes', children }: { items: { q: string; a: string }[]; title?: string; children?: ReactNode }) {
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((i) => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } })),
  };
  return (
    <div className="faq">
      {title && <h2>{title}</h2>}
      {children}
      {items.map((i) => (
        <details key={i.q}>
          <summary>{i.q}</summary>
          <p>{i.a}</p>
        </details>
      ))}
      <JsonLd data={ld} />
    </div>
  );
}
