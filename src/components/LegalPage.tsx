import { getLegal } from '@/lib/content';
import { buildMetadata } from '@/lib/seo';
import { Breadcrumbs } from './Breadcrumbs';

type LegalSlug = Parameters<typeof getLegal>[0];

export function legalMetadata(slug: LegalSlug) {
  const p = getLegal(slug);
  return buildMetadata({ title: p.title, description: p.description, path: `/${slug}/` });
}

export function LegalPage({ slug }: { slug: LegalSlug }) {
  const p = getLegal(slug);
  return (
    <>
      <section className="page-head">
        <div className="wrap">
          <Breadcrumbs items={[{ label: p.title }]} />
          <h1>{p.title}</h1>
        </div>
      </section>
      <section className="section">
        <div className="wrap prose">
          <div dangerouslySetInnerHTML={{ __html: p.html }} />
          <p className="muted">
            <em>Última actualización: {p.updated}.</em>
          </p>
        </div>
      </section>
    </>
  );
}
