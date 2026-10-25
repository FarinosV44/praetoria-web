import Link from 'next/link';
import { getPosts } from '@/lib/content';
import { areas, canalDe, groups, mensajes, whatsapp } from '@/lib/site';
import { imagen } from '@/lib/imagenes';
import { Composicion, Foto } from './Foto';
import { iconoArea, objetivoArea } from '@/lib/iconos';
import { docLabel, enlaceConsulta, servicioPorId, type Servicio } from '@/lib/servicios';
import { RevisionPendiente } from './RevisionPendiente';
import { Breadcrumbs } from './Breadcrumbs';
import { CtaBand } from './CtaBand';
import { Faq } from './Faq';
import { Icon, LineIcon } from './Icon';
import { PostList } from './PostList';

// Página propia de un servicio (#6, reutilizable en #7 y #8): problema, a quién va, qué revisamos,
// cómo trabajamos, documentación orientativa, preguntas frecuentes, guías y fuentes oficiales.
// Todo sale de src/lib/servicios.ts; aquí no se escribe texto jurídico.
export function ServicePage({ servicio: s }: { servicio: Servicio }) {
  const area = areas.find((a) => a.id === s.area)!;
  const group = groups[area.group];
  const posts = getPosts();
  const guias = (s.articulos ?? []).map((slug) => posts.find((p) => p.slug === slug)).filter((p) => !!p);
  const consulta = enlaceConsulta(s);
  const cta = s.cta ?? 'Consultar sobre esto';
  // Canal del área (#28): laboral -> área laboral (llamadas y WhatsApp); el resto -> atención jurídica general
  const canal = canalDe(s.area);
  // Imagen propia del servicio (#28); nunca la del área por defecto ni una oficina vacía
  const foto = imagen(s.imagen);
  const textoWa = s.area in mensajes ? mensajes[s.area as keyof typeof mensajes] : mensajes.general;
  // Asuntos con factores de urgencia (#32, #33): solicitud de llamada y llamada directa al canal del área
  const llamada = s.urgencia ? `/que-me-llame-un-abogado/?area=${s.area}&servicio=${encodeURIComponent(s.id)}` : null;
  const relacionados = (s.relacionados ?? []).map(servicioPorId).filter((r) => !!r?.pagina) as Servicio[];

  return (
    <div className="service-page">
      {s.revision === 'pendiente' && <RevisionPendiente indexable={s.indexable !== false} />}
      <section className="page-head area-head">
        <div className="wrap">
          <Breadcrumbs items={[{ label: group.title, href: group.href }, { label: area.name, href: `/${area.slug}/` }, { label: s.nombre }]} />
          <div className="area-head__grid">
            <div className="area-head__texto">
              <p className="antetitulo">
                <LineIcon name={iconoArea[s.area]} /> {s.area === 'laboral' ? 'Área laboral' : area.name}
              </p>
              <h1>{s.seo?.h1 ?? s.nombre}</h1>
              {s.problema && <p className="lede">{s.problema}</p>}
              <div className="actions">
                <Link className="btn btn--red" href={consulta}>
                  {cta} <LineIcon name="flecha" />
                </Link>
                {llamada ? (
                  <Link className="btn btn--ghost" href={llamada}>
                    <LineIcon name="reloj" /> Que me llame un abogado
                  </Link>
                ) : canal.id === 'laboral' ? (
                  <a className="btn btn--ghost" href={`tel:${canal.phoneIntl}`}>
                    <Icon name="phone" /> {canal.llamar}
                  </a>
                ) : (
                  <a className="btn btn--ghost" href={whatsapp(textoWa, canal.id)}>
                    <Icon name="whatsapp" /> {canal.escribir}
                  </a>
                )}
              </div>
            </div>
            {foto ? (
              <figure className="area-head__media area-head__media--card">
                <Foto img={foto} sizes="(min-width: 960px) 44vw, 92vw" prioridad />
                <figcaption className="objetivo-card">
                  <span className="objetivo-card__icono">
                    <LineIcon name="objetivo" />
                  </span>
                  <span>
                    <small>El objetivo</small>
                    <strong>{objetivoArea[s.area]}</strong>
                    {s.destinatario && <span className="objetivo-card__para">{s.destinatario}</span>}
                  </span>
                </figcaption>
              </figure>
            ) : (
              <Composicion icono={iconoArea[s.area]} etiqueta="El objetivo" titulo={objetivoArea[s.area]} texto={s.destinatario} />
            )}
          </div>
        </div>
      </section>

      {s.urgencia && (
        <section className="section section--tight">
          <div className="wrap">
            <div className="urgencia">
              <h2 className="h-icono">
                <LineIcon name="reloj" /> Qué no puede esperar
              </h2>
              <ul className="checks">
                {s.urgencia.map((u) => (
                  <li key={u}>{u}</li>
                ))}
              </ul>
              <div className="actions">
                <a className="btn btn--red" href={`tel:${canal.phoneIntl}`}>
                  <Icon name="phone" /> {canal.llamar}
                </a>
                <Link className="btn btn--ghost" href={llamada!}>
                  Solicitar que me llamen
                </Link>
              </div>
              <p className="small muted">
                Atendemos según disponibilidad: la solicitud no confirma la asistencia ni suspende ninguna citación o plazo. Si estás en peligro, llama al 112.
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="section">
        <div className="wrap service-page__grid">
          {s.revisamos && (
            <div>
              <h2 className="h-icono">
                <LineIcon name="analisis" /> Qué revisamos
              </h2>
              <ul className="checks">
                {s.revisamos.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          )}
          {s.proceso && (
            <div>
              <h2 className="h-icono">
                <LineIcon name="estrategia" /> Cómo trabajamos
              </h2>
              <ol className="method-steps method-steps--compact">
                {s.proceso.map((p) => (
                  <li key={p}>
                    <p>{p}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </section>

      {s.documentacion && (
        <section className="section section--stone">
          <div className="wrap service-page__docs">
            <div>
              <h2 className="h-icono">
                <LineIcon name="documento" /> Qué documentación ayuda
              </h2>
              <p>
                Es orientativa: no hace falta tenerla toda para consultar. <strong>No la adjuntes en el formulario</strong>; si hace falta,
                te la pediremos después por un canal seguro.
              </p>
            </div>
            <ul className="checks">
              {s.documentacion.map((d) => (
                <li key={docLabel(d)}>{docLabel(d)}</li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {(!!s.faqs?.length || guias.length > 0 || !!s.fuentes?.length) && (
        <section className="section">
          <div className="wrap">
            {s.faqs && s.faqs.length > 0 && <Faq items={s.faqs} />}
            {guias.length > 0 && (
              <div className="service-page__reads">
                <h2>Para leer antes</h2>
                <PostList posts={guias} showCategory={false} />
              </div>
            )}
            {s.fuentes && (
              <div className="service-page__sources">
                <h2>Normas citadas</h2>
                <ul>
                  {s.fuentes.map((f) => (
                    <li key={f.href}>
                      <a href={f.href} rel="noopener">
                        {f.label}
                      </a>
                    </li>
                  ))}
                </ul>
                {s.alcance && <p className="small muted">{s.alcance}</p>}
                <p className="small muted">
                  Información general, no asesoramiento sobre tu caso. La aplicación de cada norma depende de los hechos y documentos concretos.
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {relacionados.length > 0 && (
        <section className="section section--stone">
          <div className="wrap">
            <h2>Asuntos relacionados</h2>
            <ul className="relacionados">
              {relacionados.map((r) => (
                <li key={r.id}>
                  <Link href={r.pagina!}>{r.nombre}</Link>
                  {r.resumen && <span className="small muted"> {r.resumen}</span>}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <CtaBand
        title={cta}
        text="Cuéntanos qué quieres conseguir. Revisamos tu caso y te explicamos las opciones, el trabajo y los honorarios antes de empezar."
        href={consulta}
        canal={canal.id}
        whatsappText={textoWa}
      />
    </div>
  );
}
