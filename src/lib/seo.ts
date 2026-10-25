// Metadatos comunes de cada página (equivalente a lo que hacía layouts/Base.astro).
import type { Metadata } from 'next';
import { contactos, site } from './site';
import { imagen, ogImagen } from './imagenes';

/** Imagen para compartir de una imagen editorial publicada; si está pendiente, la genérica del despacho. */
export const ogDe = (id?: string | null) => {
  const img = imagen(id);
  return img ? ogImagen(img) : undefined;
};

type MetaInput = {
  title: string;
  description: string;
  /** Ruta con barra final, p. ej. "/contacto/" */
  path: string;
  image?: string;
  type?: 'website' | 'article';
  noindex?: boolean;
  /** Texto pendiente de revisión jurídica (#32): lo marca con <meta name="revision-juridica"> para las comprobaciones */
  revisionPendiente?: boolean;
  published?: Date;
  modified?: Date;
  locale?: string;
};

export function pageTitle(title: string) {
  return title.includes('Praetoria') ? title : `${title} | ${site.name}`;
}

export function buildMetadata({ title, description, path, image: imagenOg,  type = 'website', noindex, revisionPendiente, published, modified, locale = 'es_ES' }: MetaInput): Metadata {
  const url = new URL(path, site.url).href;
  const image = imagenOg ?? '/media/og-praetoria.jpg';
  return {
    title: { absolute: pageTitle(title) },
    description,
    alternates: { canonical: url },
    robots: noindex ? { index: false, follow: true } : undefined,
    ...(revisionPendiente ? { other: { 'revision-juridica': noindex ? 'pendiente-noindex' : 'pendiente' } } : {}),
    openGraph: {
      type,
      siteName: site.name,
      locale,
      title,
      description,
      url,
      images: [{ url: new URL(image, site.url).href }],
      ...(type === 'article' && published ? { publishedTime: published.toISOString(), modifiedTime: modified?.toISOString() } : {}),
    },
    twitter: { card: 'summary_large_image' },
  };
}

export const legalServiceLd = {
  '@context': 'https://schema.org',
  '@type': 'LegalService',
  '@id': `${site.url}/#despacho`,
  name: site.name,
  legalName: site.legalName,
  url: site.url,
  image: `${site.url}/media/og-praetoria.jpg`,
  logo: `${site.url}/media/logo-praetoria-sin-fondo.png`,
  telephone: site.phoneIntl,
  email: site.email,
  priceRange: '€€',
  address: {
    '@type': 'PostalAddress',
    streetAddress: site.address.street,
    postalCode: site.address.postalCode,
    addressLocality: site.address.locality,
    addressRegion: site.address.region,
    addressCountry: site.address.country,
  },
  // Mercado atendido (#28): Valencia. La dirección real (El Puig de Santa María) se mantiene en address.
  areaServed: ['Valencia', 'Provincia de Valencia', 'España'],
  contactPoint: [
    { '@type': 'ContactPoint', name: contactos.general.etiqueta, telephone: contactos.general.phoneIntl, contactType: 'customer service', availableLanguage: 'es' },
    { '@type': 'ContactPoint', name: contactos.laboral.etiqueta, telephone: contactos.laboral.phoneIntl, contactType: 'customer service', availableLanguage: 'es' },
  ],
  founder: {
    '@type': 'Person',
    name: site.lawyer,
    jobTitle: 'Abogado',
    memberOf: { '@type': 'Organization', name: site.college },
    sameAs: [site.linkedin],
  },
  sameAs: [site.linkedin],
};
