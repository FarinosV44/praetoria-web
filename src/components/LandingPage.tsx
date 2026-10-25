import Link from 'next/link';
import type { Landing } from '@/lib/content';
import { areas, canalDe, groups, mensajes } from '@/lib/site';
import { imagen } from '@/lib/imagenes';
import { iconoArea, objetivoArea } from '@/lib/iconos';
import { Breadcrumbs } from './Breadcrumbs';
import { Composicion, Foto } from './Foto';
import { CtaBand } from './CtaBand';
import { Faq } from './Faq';
import { LineIcon } from './Icon';
import { RevisionPendiente } from './RevisionPendiente';

// Landing (#34): misma cabecera y bloques que las páginas de servicio, con el cuerpo en Markdown importado y validado.
// Siempre enlaza con su área (miga de pan) y termina en el contacto del canal que corresponde.
export function LandingPage({ landing: l }: { landing: Landing }) {
  const area = areas.find((a) => a.id === l.area)!;
  const group = groups[area.group];
  const canal = canalDe(l.area);
  const foto = imagen(l.imagen);
  const textoWa = l.area in mensajes ? mensajes[l.area as keyof typeof mensajes] : mensajes.general;
  return (
    <div className="service-page landing-page">
      {l.revision === 'pendiente' && <RevisionPendiente indexable={false} />}
      <section className="page-head area-head">
        <div className="wrap">
          <Breadcrumbs items={[{ label: group.title, href: group.href }, { label: area.name, href: `/${area.slug}/` }, { label: l.h1 }]} />
          <div className="area-head__grid">
            <div className="area-head__texto">
              <p className="antetitulo">
                <LineIcon name={iconoArea[l.area]} /> {area.name}
              </p>
              <h1>{l.h1}</h1>
              <p className="lede">{l.lede}</p>
              <div className="actions">
                <Link className="btn btn--red" href={l.cta.destino}>
                  {l.cta.texto} <LineIcon name="flecha" />
                </Link>
              </div>
            </div>
            {foto ? (
              <figure className="area-head__media">
                <Foto img={foto} sizes="(min-width: 960px) 44vw, 92vw" prioridad />
              </figure>
            ) : (
              <Composicion icono={iconoArea[l.area]} etiqueta="El objetivo" titulo={objetivoArea[l.area]} />
            )}
          </div>
        </div>
      </section>
      <section className="section">
        <div className="wrap">
          <div className="prose" dangerouslySetInnerHTML={{ __html: l.html }} />
        </div>
      </section>
      {(l.faqs.length > 0 || l.fuentes.length > 0) && (
        <section className="section section--stone">
          <div className="wrap">
            {l.faqs.length > 0 && <Faq items={l.faqs} />}
            {l.fuentes.length > 0 && (
              <div className="service-page__sources">
                <h2>Normas y fuentes citadas</h2>
                <ul>
                  {l.fuentes.map((f) => (
                    <li key={f.href}>
                      <a href={f.href} rel="noopener">
                        {f.label}
                      </a>
                    </li>
                  ))}
                </ul>
                <p className="small muted">Información general, no asesoramiento sobre tu caso.</p>
              </div>
            )}
          </div>
        </section>
      )}
      <CtaBand title={l.cta.texto} href={l.cta.destino} canal={canal.id} whatsappText={textoWa} />
    </div>
  );
}
