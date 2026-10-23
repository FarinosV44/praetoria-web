import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { CtaBand } from '@/components/CtaBand';
import { areaContent } from '@/lib/areas-content';
import { areas, groups } from '@/lib/site';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: "Áreas de práctica: empresas y particulares",
  description: "Transporte y logística, mercantil, Hacienda y Seguridad Social para empresas; civil, familia, arte y patrimonio para particulares.",
  path: '/areas/',
});

export default function AreasPage() {
  const bySlug = Object.fromEntries(areaContent.map((a) => [a.slug, a]));
  return (
    <div className="page-areas">
    <section className="page-head">
        <div className="wrap">
          <Breadcrumbs items={[{ label: 'Áreas de práctica' }]} />
          <h1>Áreas de práctica</h1>
          <p className="lede">
            Seis áreas, ordenadas según a quién se dirigen. Las de empresa nacen de años de gestión empresarial en el
            transporte y la logística; las de particulares, de la cercanía con familias y patrimonios.
          </p>
        </div>
      </section>
      {(['empresas', 'particulares'] as const).map((g, i) => (
        <section key={g} id={g} className={i === 1 ? 'section section--stone' : 'section'}>
          <div className="wrap">
            <h2>{groups[g].title}</h2>
            <ul className="index-list">
              {areas.filter((a) => a.group === g).map((a) => (
                <li key={a.slug}>
                  <h3><Link href={`/${a.slug}/`}>{a.name}</Link></h3>
                  <div>
                    <p>{bySlug[a.slug]?.lede ?? a.short}</p>
                    <p className="more"><Link href={`/${a.slug}/`}>Ver {a.name.toLowerCase()}</Link></p>
                  </div>
                </li>
              ))}
              {g === 'particulares' && (
                <li>
                  <h3><Link href="/abogado-divorcio-horta-nord-valencia/">Divorcio en l&apos;Horta Nord</Link></h3>
                  <div>
                    <p>Divorcio de mutuo acuerdo con precio cerrado de 399 € en total, abogado, procurador e IVA incluidos.</p>
                    <p className="more"><Link href="/abogado-divorcio-horta-nord-valencia/">Comprobar si mi caso entra</Link></p>
                  </div>
                </li>
              )}
            </ul>
          </div>
        </section>
      ))}
      <CtaBand />

    </div>

  );
}
