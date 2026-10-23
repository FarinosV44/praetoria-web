// Datos generales del despacho. Cambia aquí teléfono, correo o dirección y se actualiza toda la web.
export const site = {
  name: 'Praetoria División Jurídica',
  shortName: 'Praetoria',
  legalName: 'PRAETORIA SL',
  cif: 'B21810452',
  url: 'https://praetoriaabogados.es',
  lawyer: 'Juan José Farinós Ibáñez',
  college: 'Ilustre Colegio de Abogados de Valencia (ICAV)',
  collegeNumber: '13.981',
  phone: '607 527 719',
  phoneIntl: '+34607527719',
  email: 'juanfarinos@icav.es',
  address: {
    street: 'C/ Pintor Francisco Ribalta, 4A',
    postalCode: '46540',
    locality: 'El Puig de Santa María',
    region: 'Valencia',
    country: 'ES',
  },
  linkedin: 'https://www.linkedin.com/in/juan-farin%C3%B3s-ib%C3%A1%C3%B1ez-81b0a892/',
  googleReviews:
    'https://www.google.com/maps/search/?api=1&query=Juan%20Jos%C3%A9%20Farin%C3%B3s%20Ib%C3%A1%C3%B1ez%20Abogado%20El%20Puig%20Valencia',
  decaUrl: 'https://www.decaprofesional.es/',
};

export const whatsapp = (text?: string) =>
  `https://wa.me/${site.phoneIntl.replace('+', '')}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

export const deca = (campaign: string) =>
  `${site.decaUrl}?utm_source=praetoria&utm_medium=referral&utm_campaign=${campaign}`;

/** Las seis áreas de práctica, agrupadas por a quién se dirigen. */
export type AreaRef = { slug: string; name: string; short: string; group: 'empresas' | 'particulares' };

export const areas: AreaRef[] = [
  {
    slug: 'logistica-y-transporte-internacional',
    name: 'Transporte y logística',
    short: 'Órdenes de carga, CMR, portes impagados, DECA y reclamaciones a aseguradoras.',
    group: 'empresas',
  },
  {
    slug: 'derecho-mercantil',
    name: 'Mercantil y sociedades',
    short: 'Constitución de sociedades, pactos de socios, conflictos societarios y contratos.',
    group: 'empresas',
  },
  {
    slug: 'abogado-hacienda-y-seguridad-social-en-valencia',
    name: 'Hacienda y Seguridad Social',
    short: 'Requerimientos, liquidaciones, sanciones, apremios y embargos.',
    group: 'empresas',
  },
  {
    slug: 'derecho-civil',
    name: 'Civil, herencias y vivienda',
    short: 'Reclamaciones de cantidad, contratos, herencias, alquileres y desahucios.',
    group: 'particulares',
  },
  {
    slug: 'familia',
    name: 'Familia y divorcio',
    short: 'Divorcios, custodia, pensiones y modificación de medidas.',
    group: 'particulares',
  },
  {
    slug: 'arte-y-patrimonio',
    name: 'Arte y patrimonio',
    short: 'Compraventa y cesión de obras, herencias con colecciones y atribución.',
    group: 'particulares',
  },
];

export const groups = {
  empresas: { title: 'Empresas y autónomos', href: '/areas/#empresas' },
  particulares: { title: 'Particulares y familias', href: '/areas/#particulares' },
} as const;

/** Categorías del blog. Cada una enlaza, si existe, con su área de práctica. */
export const categories = {
  transporte: { name: 'Transporte y DECA', area: 'logistica-y-transporte-internacional' },
  mercantil: { name: 'Mercantil y sociedades', area: 'derecho-mercantil' },
  hacienda: { name: 'Hacienda y Seguridad Social', area: 'abogado-hacienda-y-seguridad-social-en-valencia' },
  'civil-vivienda': { name: 'Civil, herencias y vivienda', area: 'derecho-civil' },
  familia: { name: 'Familia', area: 'familia' },
  laboral: { name: 'Laboral', area: null },
  extranjeria: { name: 'Extranjería', area: null },
  'elegir-abogado': { name: 'Cómo elegir abogado', area: null },
} as const;

export type CategoryKey = keyof typeof categories;

export const nav = [
  { label: 'Empresas', group: 'empresas' as const },
  { label: 'Particulares', group: 'particulares' as const },
  { label: 'Blog', href: '/blog/' },
  { label: 'El despacho', href: '/el-despacho/' },
  { label: 'Contacto', href: '/contacto/' },
];
