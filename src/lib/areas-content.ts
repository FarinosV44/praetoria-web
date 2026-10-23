// Contenido de las páginas de área. Textos tomados de la web anterior, ordenados y sin repeticiones.
import { mensajes, type CategoryKey } from './site';
import type { ServicioArea } from './servicios';

export type Img = { src: string; alt: string };

export type AreaContent = {
  slug: string;
  group: 'empresas' | 'particulares';
  title: string; // <title>
  description: string; // meta description
  h1: string;
  lede: string;
  intro: string[];
  audience?: { title: string; items: string[] };
  /** Clave del área en el modelo de servicios (src/lib/servicios.ts) y en el formulario de contacto */
  id: ServicioArea;
  servicesTitle: string;
  closing: string;
  image: Img;
  gallery?: Img[];
  category?: CategoryKey;
  whatsappText: string;
};

export const areaContent: AreaContent[] = [
  {
    slug: 'logistica-y-transporte-internacional',
    id: 'transporte',
    group: 'empresas',
    title: 'Abogado de transporte y logística',
    description:
      'Asesoramiento a agencias y empresas de transporte: contratos, órdenes de carga, DECA, CMR, impagos, daños, seguros y subcontratación.',
    h1: 'Abogado de transporte y logística para empresas y agencias',
    lede: 'Impagos, daños, reservas en el CMR, aseguradoras, subcontratación y órdenes de carga: respuesta jurídica práctica, basada en cómo funciona de verdad el sector.',
    intro: [
      'Los problemas del transporte no esperan. Conocemos ese entorno de cerca: cómo funciona un operador, una agencia, una ruta de exportación, una reclamación ante un cargador o un siniestro ante el seguro. Por eso intervenimos en los puntos críticos: contratos, reclamaciones, conflictos entre partes y prevención de riesgos.',
      'Juan José Farinós Ibáñez une el ejercicio de la abogacía con experiencia empresarial directa en el transporte y la logística internacional. Conocemos el sector, su lenguaje y sus ritmos, y ofrecemos soluciones rápidas y concretas, orientadas a reducir riesgos y proteger la rentabilidad del negocio.',
    ],
    audience: {
      title: 'A quién ayudamos',
      items: [
        'Agencias de transporte y transitarios',
        'Transportistas con flota propia',
        'Operadores logísticos',
        'Empresas que subcontratan servicios',
        'Exportadores e importadores',
        'Gerencia y departamentos de tráfico o administración',
      ],
    },
    servicesTitle: 'Qué hacemos en transporte',
    closing:
      'Una orden de carga bien redactada no elimina todas las responsabilidades, pero permite acreditar cómo se contrató el servicio, exigir el cumplimiento al proveedor y reclamar los perjuicios de una declaración falsa o de una subcontratación irregular.',
    image: { src: '/media/despacho-sala-reunion.webp', alt: 'Sala de reuniones acristalada del despacho Praetoria en El Puig' },
    category: 'transporte',
    whatsappText: mensajes.transporte,
  },
  {
    slug: 'derecho-mercantil',
    id: 'mercantil',
    group: 'empresas',
    title: 'Derecho Mercantil | Contratos, sociedades y reclamaciones',
    description:
      'Asesoría en derecho mercantil: contratos, sociedades, reclamaciones comerciales y conflictos entre empresas. Soluciones jurídicas claras para negocios y autónomos en Valencia.',
    h1: 'Abogado mercantil para empresas y autónomos',
    lede: 'Las decisiones legales no pueden tomarse al margen de la estrategia del negocio. Resolvemos los problemas jurídicos dentro de su contexto empresarial.',
    intro: [
      'Sabemos lo que implica dirigir una empresa. Por eso no solo resolvemos problemas jurídicos: los entendemos dentro del contexto empresarial y proponemos soluciones que encajan con tus objetivos y con la realidad de tu actividad.',
      'Conocemos el funcionamiento interno de las empresas, desde pymes familiares hasta estructuras más complejas, y tenemos experiencia real en gestión y en la toma de decisiones. No hablamos desde fuera: hemos estado ahí.',
      'Ofrecemos un acompañamiento completo, ágil y proactivo, tanto para negocios consolidados como para quienes empiezan, combinando el conocimiento legal con la experiencia en logística, relaciones contractuales, estructura societaria y gestión patrimonial.',
    ],
    servicesTitle: 'Qué hacemos en mercantil',
    closing:
      'Si buscas un abogado que entienda tu empresa como un sistema vivo, que sepa cómo se toman decisiones reales y que te acompañe con visión estratégica, hablemos.',
    image: { src: '/media/despacho-planta-abierta.webp', alt: 'Oficina de planta abierta del despacho Praetoria con mamparas de cristal' },
    category: 'mercantil',
    whatsappText: mensajes.mercantil,
  },
  {
    slug: 'derecho-civil',
    id: 'civil',
    group: 'particulares',
    title: 'Derecho Civil | Contratos, herencias y conflictos civiles',
    description:
      'Asesoría en derecho civil: contratos, herencias, propiedad, reclamaciones y resolución de conflictos. Soluciones jurídicas claras para particulares y empresas en Valencia.',
    h1: 'Abogado de derecho civil en El Puig y Valencia',
    lede: 'Herencias, reclamaciones, contratos, propiedades y deudas: te ayudamos a afrontarlas con claridad, seguridad y estrategia.',
    intro: [
      'En el ámbito civil se resuelven muchas de las situaciones más comunes, y también más delicadas, de la vida: herencias, reclamaciones, contratos, problemas con propiedades, deudas y desacuerdos entre particulares o con la administración.',
      'No ofrecemos soluciones estándar. Analizamos tu caso en profundidad, valoramos las opciones legales y proponemos el camino más eficaz y realista para proteger tus intereses, ya sea mediante negociación, acuerdo o procedimiento judicial.',
    ],
    servicesTitle: 'Asuntos que llevamos con más frecuencia',
    closing:
      'Queremos que tomes decisiones con toda la información, sabiendo que cuentas con un respaldo legal sólido. En derecho civil, como en casi todo, lo importante no es solo tener razón, sino saber cómo defenderla.',
    image: { src: '/media/despacho-zona-mesas.webp', alt: 'Zona de mesas del despacho Praetoria en El Puig' },
    category: 'civil-vivienda',
    whatsappText: mensajes.civil,
  },
  {
    slug: 'familia',
    id: 'familia',
    group: 'particulares',
    title: 'Derecho de Familia | Divorcios, custodias y herencias',
    description:
      'Asesoría en derecho de familia: divorcios, custodias, herencias y protección familiar. Soluciones claras, estratégicas y orientadas a acuerdos duraderos en Valencia.',
    h1: 'Abogado de familia y divorcios en Valencia',
    lede: 'Detrás de cada caso hay vínculos personales y decisiones que marcan años. Combinamos rigor técnico con un trato cercano y discreto.',
    intro: [
      'Abordamos cada asunto de familia con sensibilidad, discreción y una visión práctica orientada a soluciones estables.',
      'Asistimos en divorcios y separaciones, custodia de menores, régimen de visitas, pensión alimenticia y compensatoria, modificación de medidas y patrimonio familiar. Buscamos acuerdos equilibrados que eviten conflictos innecesarios y, cuando no es posible, defendemos con firmeza tus intereses ante los tribunales.',
    ],
    servicesTitle: 'Qué hacemos en familia',
    closing:
      'Te ayudamos a entender tus derechos, poner orden y tomar decisiones seguras. Una separación es una etapa, no una condena, y puede resolverse de forma digna, eficaz y con futuro.',
    image: { src: '/media/despacho-atencion-cliente.webp', alt: 'Espacio de atención a clientes del despacho Praetoria' },
    category: 'familia',
    whatsappText: mensajes.familia,
  },
  {
    slug: 'arte-y-patrimonio',
    id: 'arte',
    group: 'particulares',
    title: 'Arte y Patrimonio | Protección jurídica de obras y colecciones',
    description:
      'Asesoramiento legal en arte, patrimonio cultural y protección jurídica de obras, colecciones y bienes históricos: autenticidad, propiedad, sucesiones y compraventas.',
    h1: 'Asesoramiento jurídico en arte y patrimonio',
    lede: 'Las obras de arte no son solo objetos. Son valor, historia y legado, y también un conflicto potencial si no se gestionan bien.',
    intro: [
      'Herencias que incluyen colecciones, compras internacionales, cesiones a museos, atribuciones discutidas, movimientos transfronterizos o ventas privadas: todo esto requiere conocimiento jurídico, pero también sensibilidad, formación específica y experiencia directa.',
      'Juan José Farinós tiene formación en Derecho y en Historia del Arte. Asesoramos a particulares, coleccionistas, inversores, herederos, galeristas e instituciones para que tomen decisiones bien fundadas y acordes al valor cultural y económico de cada pieza.',
    ],
    servicesTitle: 'Qué hacemos en arte y patrimonio',
    closing:
      'Aquí el derecho no es solo un marco legal: es una herramienta para preservar, proteger y transmitir patrimonio con seguridad, criterio y visión a largo plazo.',
    image: { src: '/media/arte-museo-visitantes.webp', alt: 'Visitantes observando cuadros en la sala de un museo' },
    gallery: [
      { src: '/media/arte-muestras-color-800.webp', alt: 'Panel de muestras de color expuesto en una pared' },
      { src: '/media/arte-obra-textil-800.webp', alt: 'Obra textil bordada con plumas naranjas' },
      { src: '/media/arte-obra-abstracta-800.webp', alt: 'Obra abstracta en tonos rojos con estructura de rejilla' },
    ],
    whatsappText: mensajes.arte,
  },
];
