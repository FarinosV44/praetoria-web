import Link from 'next/link';
import { getPosts } from '@/lib/content';
import { buildMetadata, ogDe } from '@/lib/seo';
import { areas, contactos, publicoDe, mensajes, whatsapp } from '@/lib/site';
import { iconoArea, metodo, objetivoArea } from '@/lib/iconos';
import { servicios } from '@/lib/servicios';
import { PostList } from '@/components/PostList';
import { DecaBand } from '@/components/DecaBand';
import { CtaBand } from '@/components/CtaBand';
import { Icon, LineIcon } from '@/components/Icon';
import { ContactosArea } from '@/components/ContactosArea';
import { Foto } from '@/components/Foto';
import { imagen } from '@/lib/imagenes';

export const metadata = buildMetadata({
  title: 'Abogados en Valencia para empresas y particulares | Praetoria',
  description:
    'Praetoria, abogados en Valencia. Entendemos qué quieres conseguir y diseñamos la estrategia jurídica: laboral, transporte, mercantil, civil, familia, Hacienda y patrimonio.',
  path: '/',
  image: ogDe('portada'),
});

/** Accesos por objetivo: lo que la persona quiere conseguir, enlazado al área que lo trabaja */
const objetivos = [
  { icono: 'euro', texto: 'Recuperar lo que te deben', href: '/reclamacion-portes-impagados/' },
  { icono: 'trabajo', texto: 'Defender tus derechos laborales', href: '/abogado-laboralista-valencia/' },
  { icono: 'negociar', texto: 'Resolver un conflicto', href: '/derecho-mercantil/' },
  { icono: 'vivienda', texto: 'Proteger tu patrimonio', href: '/derecho-civil/' },
  { icono: 'maletin', texto: 'Dar seguridad a una decisión de empresa', href: '/derecho-mercantil/' },
] as const;

const urgentes = [
  {
    icono: 'hacienda',
    titulo: 'Me ha llegado una carta de Hacienda o de la Seguridad Social',
    texto: 'Requerimientos, liquidaciones, sanciones, apremios o embargos. Indica qué has recibido y lo revisamos antes de que corra el plazo.',
    cta: 'Revisar mi notificación',
    href: '/abogado-hacienda-y-seguridad-social-en-valencia/',
  },
  {
    icono: 'trabajo',
    titulo: 'Me han despedido',
    texto: 'La acción contra el despido tiene un plazo corto. Revisamos la carta, el finiquito y las fechas antes de firmar o reclamar.',
    cta: 'Revisar mi despido',
    href: '/impugnar-despido/',
  },
  {
    icono: 'camion',
    titulo: 'Un cliente no me paga un porte',
    texto: 'Reclamación de facturas de transporte y, cuando procede, acción directa contra el cargador.',
    cta: 'Ver cómo reclamamos',
    href: '/reclamacion-portes-impagados/',
  },
] as const;

export default function HomePage() {
  // Últimos artículos sin que el DECA acapare la portada: uno por categoría, en orden de fecha
  const seen = new Set<string>();
  const latest = getPosts()
    .filter((p) => p.lang === 'es')
    .filter((p) => {
      if (seen.has(p.category)) return false;
      seen.add(p.category);
      return true;
    })
    .slice(0, 4);

  // Guías con más tráfico orgánico (Search Console, ago-oct 2026): la portada les transmite autoridad (DinoRANK, enlazado interno)
  const MAS_CONSULTADAS = [
    'deca-para-empresas-cargadoras-obligaciones-del-departamento-de-logistica-y-como-cumplir-en-2026',
    'deca-con-varios-lugares-de-carga-y-descarga-que-dice-la-ley-y-como-hacerlo-correctamente',
    'quien-debe-hacer-el-deca-el-cargador-o-el-transportista-que-ocurre-en-una-inspeccion-y-que-pasa-si-cada-parte-utiliza-una-plataforma-diferente',
    'deca-y-subcontratacion-que-debe-hacer-realmente-una-agencia-de-transporte',
    'reclamar-devolucion-impuesto-de-matriculacion',
    'hacienda-me-pide-justificar-ingresos',
  ];
  const todos = getPosts();
  const masConsultadas = MAS_CONSULTADAS.map((s) => todos.find((p) => p.slug === s)).filter((p): p is NonNullable<typeof p> => !!p);
  const laboralArea = areas.find((a) => a.id === 'laboral')!;
  const resto = areas.filter((a) => a.id !== 'laboral');
  // Trabajo jurídico con personas, no oficinas vacías (#28). Pendiente => portada solo tipográfica.
  const fotoPortada = imagen('portada');

  return (
    <div className="page-home">
      <section className={fotoPortada ? 'portada' : 'portada portada--tipografica'}>
        {fotoPortada && (
          <div className="portada__media">
            <Foto img={fotoPortada} sizes="(min-width: 960px) 56vw, 100vw" prioridad ancho={1200} />
          </div>
        )}
        <div className="wrap portada__grid">
          <div className="portada__texto">
            <h1>
              <span className="portada__lema">
                Tus objetivos. <em>Nuestra estrategia jurídica.</em>
              </span>
              <span className="portada__lugar">Abogados en Valencia para empresas y particulares</span>
            </h1>
            <p className="portada__lede">
              Entendemos qué quieres conseguir, analizamos las opciones y diseñamos una estrategia para defender tus intereses.
              Negociamos y actuamos con un objetivo claro.
            </p>
            <div className="actions">
              <Link className="btn btn--red" href="/contacto/">
                Cuéntanos qué quieres conseguir <LineIcon name="flecha" />
              </Link>
              <a className="btn btn--light" href={whatsapp(mensajes.general)}>
                <Icon name="whatsapp" /> {contactos.general.escribir}
              </a>
            </div>
          </div>
        </div>
        <div className="wrap">
          <nav className="objetivos" aria-label="¿Qué quieres conseguir?">
            <p className="objetivos__titulo">¿Qué quieres conseguir?</p>
            <ul>
              {objetivos.map((o) => (
                <li key={o.texto}>
                  <Link href={o.href}>
                    <LineIcon name={o.icono} />
                    <span>{o.texto}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="seccion-cabecera">
            <p className="antetitulo">Áreas de práctica</p>
            <h2>Una estrategia para cada asunto</h2>
            <p className="lede">
              Organizamos el despacho por áreas para que cada asunto lo trabaje quien conoce sus reglas, sus plazos y su forma de
              negociar.
            </p>
          </div>
          <div className="areas-grid">
            <article className="area-card area-card--destacada">
              <div className="area-card__icono">
                <LineIcon name={iconoArea.laboral} />
              </div>
              <p className="area-card__grupo">Trabajadores · Área destacada</p>
              <h3>
                <Link href={`/${laboralArea.slug}/`}>{laboralArea.name}</Link>
              </h3>
              <p className="area-card__objetivo">{objetivoArea.laboral}</p>
              <ul className="area-card__servicios">
                {servicios
                  .filter((sv) => sv.area === 'laboral' && sv.pagina)
                  .map((sv) => (
                    <li key={sv.id}>
                      <Link href={sv.pagina!}>
                        <LineIcon name="flecha" /> {sv.nombre}
                      </Link>
                    </li>
                  ))}
              </ul>
              <div className="area-card__acciones">
                <Link className="btn btn--red" href={`/${laboralArea.slug}/`}>
                  Ver el área laboral
                </Link>
                <a className="btn btn--ghost" href={`tel:${contactos.laboral.phoneIntl}`}>
                  <Icon name="phone" /> {contactos.laboral.llamar}
                </a>
              </div>
            </article>
            {resto.map((a) => (
              <article key={a.slug} className="area-card">
                <div className="area-card__icono">
                  <LineIcon name={iconoArea[a.id]} />
                </div>
                <p className="area-card__grupo">{publicoDe(a)}</p>
                <h3>
                  <Link href={`/${a.slug}/`}>{a.name}</Link>
                </h3>
                <p className="area-card__objetivo">{objetivoArea[a.id]}</p>
                <p>{a.short}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--ink metodo-seccion">
        <div className="wrap metodo-seccion__grid">
          <div className="seccion-cabecera">
            <p className="antetitulo">Método</p>
            <h2>Primero tu objetivo. Después, la estrategia.</h2>
            <p className="lede">
              Cada asunto sigue el mismo método, tanto si es una reclamación urgente como una decisión de empresa. Sin promesas de
              resultado: te decimos con claridad dónde estás, qué se puede conseguir y qué cuesta intentarlo.
            </p>
          </div>
          <ol className="metodo">
            {metodo.map((m, i) => (
              <li key={m.titulo}>
                <span className="metodo__icono">
                  <LineIcon name={m.icono} />
                </span>
                <span className="metodo__num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                <h3>{m.titulo}</h3>
                <p>{m.texto}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="seccion-cabecera">
            <p className="antetitulo">Si te urge</p>
            <h2>Empieza por aquí</h2>
          </div>
          <div className="urgentes">
            {urgentes.map((u) => (
              <Link key={u.titulo} className="urgente" href={u.href}>
                <LineIcon name={u.icono} />
                <h3>{u.titulo}</h3>
                <p>{u.texto}</p>
                <span className="urgente__ir">
                  {u.cta} <LineIcon name="flecha" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--stone">
        <div className="wrap">
          <div className="seccion-cabecera">
            <p className="antetitulo">Contacto</p>
            <h2>Contacta con el despacho</h2>
            <p className="lede">Cada consulta llega al área que la atiende. Te respondemos por el medio que prefieras.</p>
          </div>
          <ContactosArea />
        </div>
      </section>

      <section className="section section--tight">
        <div className="wrap">
          <DecaBand campaign="home" />
        </div>
      </section>

      {masConsultadas.length > 0 && (
        <section className="section">
          <div className="wrap">
            <div className="head-row">
              <h2>Guías más consultadas</h2>
              <Link href="/blog/">Todos los artículos</Link>
            </div>
            <PostList posts={masConsultadas} />
          </div>
        </section>
      )}

      <section className="section section--stone">
        <div className="wrap">
          <div className="head-row">
            <h2>Últimas guías del despacho</h2>
            <Link href="/blog/">Todos los artículos</Link>
          </div>
          <PostList posts={latest} />
        </div>
      </section>

      <CtaBand />
    </div>
  );
}
