import Link from 'next/link';
import { getPosts } from '@/lib/content';
import type { AreaContent } from '@/lib/areas-content';
import { areas, categories, groups, whatsapp } from '@/lib/site';
import { Breadcrumbs } from './Breadcrumbs';
import { PostList } from './PostList';
import { DecaBand } from './DecaBand';
import { CtaBand } from './CtaBand';
import { Icon } from './Icon';
import { ServiceList } from './ServiceList';
import { serviciosDe } from '@/lib/servicios';

export function AreaPage({ area }: { area: AreaContent }) {
  const group = groups[area.group];
  const siblings = areas.filter((a) => a.group === area.group && a.slug !== area.slug);
  const all = area.category ? getPosts().filter((p) => p.category === area.category) : [];
  const isTransport = area.category === 'transporte';
  const decaGuides = all.filter((p) => p.deca === 'guia');
  const decaTools = all.filter((p) => p.deca === 'herramienta');
  const others = all.filter((p) => !p.deca);

  return (
    <div className="area-page">
    <section className="page-head">
        <div className="wrap">
          <Breadcrumbs items={[{ label: group.title, href: group.href }, { label: area.h1 }]} />
          <div className="split">
            <div>
              <h1>{area.h1}</h1>
              <p className="lede">{area.lede}</p>
              <div className="actions">
                <a className="btn btn--red" href={whatsapp(area.whatsappText)}><Icon name="whatsapp" /> Consultar por WhatsApp</a>
                <Link className="btn btn--ghost" href={`/contacto/?area=${area.id}`}>Enviar mi consulta</Link>
              </div>
            </div>
            <img className="photo head-photo" src={area.image.src.replace('.webp', '-800.webp')} alt={area.image.alt} width={800} height={600} />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="prose intro">
            {area.intro.map((p) => (
              <p key={p.slice(0, 40)}>{p}</p>
            ))}
          </div>

          {
            area.audience && (
              <div className="audience">
                <h2>{area.audience.title}</h2>
                <ul>
                  {area.audience.items.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              </div>
            )
          }

          <h2 className="services-title">{area.servicesTitle}</h2>
          <ServiceList services={serviciosDe(area.id)} />
          <p className="closing">{area.closing}</p>

          {
            area.gallery && (
              <div className="gallery">
                {area.gallery.map((g) => (
                  <img key={g.src} className="photo" src={g.src} alt={g.alt} width={600} height={800} loading="lazy" />
                ))}
              </div>
            )
          }
        </div>
      </section>

      {
        isTransport && (
          <section className="section section--stone" id="deca">
            <div className="wrap">
              <h2>El DECA digital, explicado por un abogado del sector</h2>
              <p className="lede">
                Desde el 5 de octubre de 2026 el documento de control del transporte de mercancías por carretera debe ser
                digital. Estas guías explican quién debe hacerlo, qué riesgos asume cada parte y cómo organizarlo.
              </p>
              <div className="deca-cols">
                <div>
                  <h3>Guías legales</h3>
                  <PostList posts={decaGuides} showCategory={false} compact />
                </div>
                <div>
                  <h3>Herramientas para generarlo</h3>
                  <PostList posts={decaTools} showCategory={false} compact />
                  <div className="deca-band">
                    <DecaBand campaign="transporte" />
                  </div>
                </div>
              </div>
            </div>
          </section>
        )
      }

      {
        (isTransport ? others : all).length > 0 && (
          <section className={isTransport ? 'section' : 'section section--stone'}>
            <div className="wrap">
              <div className="head-row">
                <h2>{isTransport ? 'Más artículos sobre transporte' : `Artículos sobre ${categories[area.category!].name.toLowerCase()}`}</h2>
                <Link href={`/blog/categoria/${area.category}/`}>Ver la categoría</Link>
              </div>
              <PostList posts={(isTransport ? others : all).slice(0, 6)} showCategory={false} />
            </div>
          </section>
        )
      }

      <section className="section section--tight">
        <div className="wrap">
          <p className="siblings-title">Otras áreas para {group.title.toLowerCase()}</p>
          <ul className="siblings">
            {siblings.map((s) => (
              <li key={s.slug}>
                <Link href={`/${s.slug}/`}>{s.name}</Link>
              </li>
            ))}
            <li><Link href="/areas/">Todas las áreas</Link></li>
          </ul>
        </div>
      </section>

      <CtaBand whatsappText={area.whatsappText} />

    </div>

  );
}
