import Link from 'next/link';
import { getPosts } from '@/lib/content';
import type { AreaContent } from '@/lib/areas-content';
import { areasDe, canalDe, categories, groups, whatsapp } from '@/lib/site';
import { iconoArea, metodo, objetivoArea } from '@/lib/iconos';
import { Breadcrumbs } from './Breadcrumbs';
import { PostList } from './PostList';
import { DecaBand } from './DecaBand';
import { CtaBand } from './CtaBand';
import { Icon, LineIcon } from './Icon';
import { ServiceList } from './ServiceList';
import { serviciosDe } from '@/lib/servicios';
import { imagen } from '@/lib/imagenes';
import { Composicion, Foto } from './Foto';
import { RevisionPendiente } from './RevisionPendiente';

export function AreaPage({ area }: { area: AreaContent }) {
  const group = groups[area.group];
  const siblings = areasDe(area.group).filter((a) => a.slug !== area.slug);
  const all = area.category ? getPosts().filter((p) => p.category === area.category) : [];
  const isTransport = area.category === 'transporte';
  const decaGuides = all.filter((p) => p.deca === 'guia');
  const decaTools = all.filter((p) => p.deca === 'herramienta');
  const others = all.filter((p) => !p.deca);
  const canal = canalDe(area.id);
  const foto = imagen(area.imagen);

  return (
    <div className="area-page">
      {area.revision === 'pendiente' && <RevisionPendiente indexable={area.indexable !== false} />}
      <section className="page-head area-head">
        <div className="wrap">
          <Breadcrumbs items={[{ label: group.title, href: group.href }, { label: area.h1 }]} />
          <div className="area-head__grid">
            <div className="area-head__texto">
              <p className="antetitulo">
                <LineIcon name={iconoArea[area.id]} /> {area.id === 'laboral' ? 'Área laboral' : group.title}
              </p>
              <h1>{area.h1}</h1>
              <p className="lede">{area.lede}</p>
              <p className="objetivo-nota">
                <LineIcon name="objetivo" />
                <span>
                  <small>Objetivo</small>
                  {objetivoArea[area.id]}
                </span>
              </p>
              <div className="actions">
                <Link className="btn btn--red" href={`/contacto/?area=${area.id}`}>
                  {canal.consulta} <LineIcon name="flecha" />
                </Link>
                {(canal.id === 'laboral' || area.urgente) && (
                  <a className="btn btn--ghost" href={`tel:${canal.phoneIntl}`}>
                    <Icon name="phone" /> {canal.llamar}
                  </a>
                )}
                {area.urgente ? (
                  <Link className="btn btn--ghost" href={`/que-me-llame-un-abogado/?area=${area.id}`}>
                    <LineIcon name="reloj" /> Que me llame un abogado
                  </Link>
                ) : (
                  <a className="btn btn--ghost" href={whatsapp(area.whatsappText, canal.id)}>
                    <Icon name="whatsapp" /> {canal.escribir}
                  </a>
                )}
              </div>
              {area.urgente && (
                <p className="small muted">Atendemos según disponibilidad. Si estás en peligro, llama al 112.</p>
              )}
            </div>
            {foto ? (
              <figure className="area-head__media">
                <Foto img={foto} sizes="(min-width: 960px) 46vw, 92vw" prioridad />
              </figure>
            ) : (
              <Composicion icono={iconoArea[area.id]} titulo={objetivoArea[area.id]} />
            )}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          {area.recorridos && (
            <>
              <h2 className="journeys-title">¿Qué te ha pasado?</h2>
              <ul className="journeys">
                {area.recorridos.map((r) => (
                  <li key={r.titulo} className="journey">
                    {r.icono && <LineIcon name={r.icono} />}
                    <h3>{r.titulo}</h3>
                    <p>{r.texto}</p>
                    <p className="journey__links">
                      {r.enlaces.map((e) => (
                        <Link key={e.href} href={e.href}>
                          {e.label}
                        </Link>
                      ))}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="intro-grid">
            <div className="prose intro">
              {area.intro.map((p) => (
                <p key={p.slice(0, 40)}>{p}</p>
              ))}
            </div>
            <aside className="metodo-mini" aria-label="Cómo trabajamos">
              <p className="metodo-mini__titulo">Cómo trabajamos</p>
              <ol>
                {metodo.map((m) => (
                  <li key={m.titulo}>
                    <LineIcon name={m.icono} />
                    <span>{m.titulo}</span>
                  </li>
                ))}
              </ol>
            </aside>
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
          <ServiceList services={serviciosDe(area.id)} defaultCta={area.ctaServicios} />
          <p className="closing">{area.closing}</p>
          {area.nota && <p className="area-note">{area.nota}</p>}

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

      <CtaBand whatsappText={area.whatsappText} href={`/contacto/?area=${area.id}`} canal={canal.id} />

    </div>

  );
}
