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

/**
 * Área Laboral (#7, #28). Llamadas y WhatsApp autorizados por el propietario el 24/10/2026 (#28),
 * que sustituye la restricción anterior de «solo llamadas». Sin correo propio: el correo es el general.
 * El nombre se menciona con discreción (contacto, el despacho); los botones hablan del «área laboral».
 */
export const laboral = {
  name: 'Lucía López',
  role: 'Experta en Derecho Laboral',
  phone: '649 181 290',
  phoneIntl: '+34649181290',
};

/**
 * Mensajes predefinidos de WhatsApp (#3): siempre dirigidos a Praetoria y al servicio jurídico,
 * nunca al soporte de DeCA Profesional. Nunca llevan respuestas de cuestionarios ni datos del caso (#28).
 */
export const mensajes = {
  general: 'Hola, Praetoria. Quiero consultar mi caso con un abogado.',
  transporte: 'Hola, Praetoria. Quiero consultar con un abogado un asunto de transporte.',
  mercantil: 'Hola, Praetoria. Quiero consultar con un abogado un asunto mercantil de mi empresa.',
  hacienda: 'Hola, Praetoria. He recibido una notificación de Hacienda o de la Seguridad Social y quiero que la revise un abogado.',
  civil: 'Hola, Praetoria. Quiero consultar con un abogado un asunto civil.',
  familia: 'Hola, Praetoria. Quiero consultar con un abogado un asunto de familia.',
  divorcio: 'Hola, Praetoria. Quiero hablar con un abogado sobre mi caso de divorcio.',
  modificacionMedidas: 'Hola, Praetoria. Quiero consultar con un abogado una modificación de medidas.',
  arte: 'Hola, Praetoria. Quiero consultar con un abogado un asunto de arte y patrimonio.',
  laboral: 'Hola, Praetoria. Quiero consultar un asunto laboral con el área laboral del despacho.',
  elPuig: 'Hola, Praetoria. Necesito información sobre vuestros servicios jurídicos en El Puig.',
  plazoProximo: 'Hola, Praetoria. Acabo de enviar una consulta desde la web y tiene un plazo próximo.',
} as const;

/**
 * Canales de contacto del despacho por área (#28). Los botones nombran el canal, no a la persona,
 * y el número se muestra en zonas secundarias (contacto, pie, barra móvil), etiquetado por área.
 */
export type CanalId = 'general' | 'laboral';
export const contactos = {
  general: {
    id: 'general' as CanalId,
    etiqueta: 'Atención jurídica general',
    phone: site.phone,
    phoneIntl: site.phoneIntl,
    llamar: 'Llamar al despacho',
    escribir: 'Consultar por WhatsApp',
    consulta: 'Solicitar una valoración',
  },
  laboral: {
    id: 'laboral' as CanalId,
    etiqueta: 'Área laboral',
    phone: laboral.phone,
    phoneIntl: laboral.phoneIntl,
    llamar: 'Llamar al área laboral',
    escribir: 'WhatsApp del área laboral',
    consulta: 'Enviar consulta laboral',
  },
};
export const canalDe = (area?: string | null) => (area === 'laboral' ? contactos.laboral : contactos.general);

export const whatsapp = (text: string = mensajes.general, canal: CanalId = 'general') =>
  `https://wa.me/${contactos[canal].phoneIntl.replace('+', '')}?text=${encodeURIComponent(text)}`;

export const deca = (campaign: string) =>
  `${site.decaUrl}?utm_source=praetoria&utm_medium=referral&utm_campaign=${campaign}`;

/** Las siete áreas de práctica, agrupadas por a quién se dirigen. */
export type Group = 'empresas' | 'particulares';
export type AreaRef = {
  id: 'transporte' | 'mercantil' | 'hacienda' | 'civil' | 'familia' | 'arte' | 'laboral';
  slug: string;
  name: string;
  short: string;
  /** Público principal: decide la miga de pan y el orden. */
  group: Group;
  /** Otros públicos desde los que también se enlaza (misma URL, sin duplicar contenido ni canonical) (#31). */
  tambien?: Group[];
};

export const areas: AreaRef[] = [
  {
    id: 'transporte',
    slug: 'logistica-y-transporte-internacional',
    name: 'Transporte y logística',
    short: 'Órdenes de carga, CMR, portes impagados, DECA y reclamaciones a aseguradoras.',
    group: 'empresas',
  },
  {
    id: 'mercantil',
    slug: 'derecho-mercantil',
    name: 'Mercantil y sociedades',
    short: 'Constitución de sociedades, pactos de socios, conflictos societarios y contratos.',
    group: 'empresas',
  },
  {
    id: 'hacienda',
    slug: 'abogado-hacienda-y-seguridad-social-en-valencia',
    name: 'Hacienda y Seguridad Social',
    short: 'Requerimientos, liquidaciones, sanciones, apremios y embargos.',
    group: 'empresas',
    tambien: ['particulares'],
  },
  {
    id: 'laboral',
    slug: 'abogado-laboralista-valencia',
    name: 'Laboral',
    short: 'Despidos, salarios y finiquitos, incapacidad, altas médicas y accidentes laborales.',
    group: 'particulares',
  },
  {
    id: 'civil',
    slug: 'derecho-civil',
    name: 'Civil, herencias y vivienda',
    short: 'Reclamaciones de cantidad, contratos, herencias, alquileres y desahucios.',
    group: 'particulares',
  },
  {
    id: 'familia',
    slug: 'familia',
    name: 'Familia y divorcio',
    short: 'Divorcios, custodia, pensiones y modificación de medidas.',
    group: 'particulares',
  },
  {
    id: 'arte',
    slug: 'arte-y-patrimonio',
    name: 'Arte y patrimonio',
    short: 'Compraventa y cesión de obras, herencias con colecciones y atribución.',
    group: 'particulares',
  },
];

/** Áreas que se muestran en un público: las suyas y las que también le sirven. */
export const areasDe = (g: Group) => areas.filter((a) => a.group === g || a.tambien?.includes(g));
/** Etiqueta de público de un área: «Empresas y particulares» si se dirige a ambos. */
export const publicoDe = (a: AreaRef) => (a.tambien?.length ? 'Empresas y particulares' : groups[a.group].title);

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
  laboral: { name: 'Laboral', area: 'abogado-laboralista-valencia' },
  extranjeria: { name: 'Extranjería', area: null },
  'elegir-abogado': { name: 'Cómo elegir abogado', area: null },
} as const;

export type CategoryKey = keyof typeof categories;

export type NavItem = { label: string; group: Group } | { label: string; href: string };

export const nav: NavItem[] = [
  { label: 'Empresas', group: 'empresas' },
  { label: 'Particulares', group: 'particulares' },
  { label: 'Blog', href: '/blog/' },
  { label: 'El despacho', href: '/el-despacho/' },
  { label: 'Contacto', href: '/contacto/' },
];
