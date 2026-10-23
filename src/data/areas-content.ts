// Contenido de las páginas de área. Textos tomados de la web anterior, ordenados y sin repeticiones.
import type { CategoryKey } from './site';

export type Service = { name: string; text?: string; links?: { label: string; href: string }[] };
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
  servicesTitle: string;
  services: Service[];
  closing: string;
  image: Img;
  gallery?: Img[];
  category?: CategoryKey;
  whatsappText: string;
};

export const areaContent: AreaContent[] = [
  {
    slug: 'logistica-y-transporte-internacional',
    group: 'empresas',
    title: 'Abogado de transporte y logística en Valencia',
    description:
      'Asesoramiento a agencias, transportistas y cargadores: órdenes de carga, contratos, DECA, CMR, portes impagados, daños, seguros y subcontratación.',
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
    services: [
      {
        name: 'Redacción y revisión de órdenes de carga',
        text: 'Órdenes de carga adaptadas a la operativa real de la empresa para prevenir conflictos con transportistas, agencias, clientes y colaboradores.',
      },
      {
        name: 'Contratos de transporte y logística',
        text: 'Contratos de transporte, logística, almacenaje, distribución, colaboración y prestación continuada de servicios.',
      },
      {
        name: 'DECA y subcontratación',
        text: 'Cláusulas para identificar al transportista efectivo, regular la subcontratación y repartir las obligaciones del Documento Electrónico de Control Administrativo.',
        links: [
          { label: 'Guía legal del DECA', href: '/deca-obligatorio-en-2026-guia-legal-para-transportistas-y-cargadores/' },
          { label: 'DECA y subcontratación', href: '/deca-y-subcontratacion-que-debe-hacer-realmente-una-agencia-de-transporte/' },
        ],
      },
      {
        name: 'Reclamación de portes impagados',
        text: 'Reclamación extrajudicial y judicial de facturas de transporte, con revisión de órdenes, CMR, albaranes y comunicaciones.',
        links: [
          { label: 'La acción directa en el transporte', href: '/accion-directa-en-el-transporte-como-reclamar-al-cargador-cuando-no-te-paga-tu-cliente/' },
        ],
      },
      {
        name: 'Pérdida, avería y retraso de mercancías',
        text: 'Análisis de responsabilidades, limitaciones indemnizatorias, reservas, prueba del daño y reclamaciones derivadas del transporte.',
      },
      {
        name: 'Convenio CMR y transporte internacional',
        text: 'Transporte internacional por carretera: documentación CMR, jurisdicción, plazos y responsabilidad del porteador.',
      },
      {
        name: 'Reclamaciones frente a aseguradoras',
        text: 'Defensa ante rechazos de cobertura, discrepancias en la valoración de daños y conflictos con seguros de transporte.',
        links: [{ label: 'Fraudes y aseguradoras', href: '/fraudes-transporte-aseguradora/' }],
      },
      {
        name: 'Conflictos entre cargadores, agencias y transportistas',
        text: 'Determinación de responsabilidades dentro de la cadena de transporte y defensa frente a reclamaciones de terceros.',
      },
      {
        name: 'Prevención de riesgos contractuales',
        text: 'Revisión de procedimientos, condiciones generales, órdenes de carga y comunicaciones para reducir problemas antes de que se produzcan.',
        links: [
          {
            label: 'Cómo proteger legalmente tu empresa de transporte',
            href: '/como-proteger-legalmente-tu-empresa-de-transporte-contratos-condiciones-y-claves-para-evitar-problemas/',
          },
        ],
      },
      {
        name: 'Apoyo jurídico para gerencia',
        text: 'Asesoramiento puntual o continuado para tomar decisiones comerciales y operativas con mayor seguridad jurídica.',
      },
    ],
    closing:
      'Una orden de carga bien redactada no elimina todas las responsabilidades, pero permite acreditar cómo se contrató el servicio, exigir el cumplimiento al proveedor y reclamar los perjuicios de una declaración falsa o de una subcontratación irregular.',
    image: { src: '/media/despacho-sala-reunion.webp', alt: 'Sala de reuniones acristalada del despacho Praetoria en El Puig' },
    category: 'transporte',
    whatsappText: 'Hola, quiero consultar un asunto relacionado con un transporte.',
  },
  {
    slug: 'derecho-mercantil',
    group: 'empresas',
    title: 'Abogado mercantil en Valencia para empresas y autónomos',
    description:
      'Constitución de sociedades, estatutos y pactos de socios, conflictos societarios, reestructuraciones y contratos mercantiles para empresas de Valencia.',
    h1: 'Abogado mercantil para empresas y autónomos',
    lede: 'Las decisiones legales no pueden tomarse al margen de la estrategia del negocio. Resolvemos los problemas jurídicos dentro de su contexto empresarial.',
    intro: [
      'Sabemos lo que implica dirigir una empresa. Por eso no solo resolvemos problemas jurídicos: los entendemos dentro del contexto empresarial y proponemos soluciones que encajan con tus objetivos y con la realidad de tu actividad.',
      'Conocemos el funcionamiento interno de las empresas, desde pymes familiares hasta estructuras más complejas, y tenemos experiencia real en gestión y en la toma de decisiones. No hablamos desde fuera: hemos estado ahí.',
      'Ofrecemos un acompañamiento completo, ágil y proactivo, tanto para negocios consolidados como para quienes empiezan, combinando el conocimiento legal con la experiencia en logística, relaciones contractuales, estructura societaria y gestión patrimonial.',
    ],
    servicesTitle: 'Qué hacemos en mercantil',
    services: [
      { name: 'Constitución de sociedades', text: 'Asesoramiento sobre la forma jurídica más adecuada para tu actividad.' },
      {
        name: 'Estatutos, pactos de socios y contratos internos',
        text: 'Redacción y revisión de estatutos, pactos de socios, acuerdos de confidencialidad y otros contratos internos.',
      },
      {
        name: 'Conflictos societarios',
        text: 'Impugnación de acuerdos y defensa de socios minoritarios.',
        links: [
          {
            label: 'Problemas con mi socio: empresas al 50 %',
            href: '/problemas-con-mi-socio-que-hacer-cuando-una-empresa-al-50-se-convierte-en-un-conflicto/',
          },
        ],
      },
      {
        name: 'Reestructuraciones empresariales',
        text: 'Ampliaciones de capital y compraventa de participaciones.',
      },
      { name: 'Contratos mercantiles nacionales e internacionales' },
      { name: 'Asesoramiento a administradores', text: 'Asesoramiento jurídico integral para directivos y órganos de administración.' },
    ],
    closing:
      'Si buscas un abogado que entienda tu empresa como un sistema vivo, que sepa cómo se toman decisiones reales y que te acompañe con visión estratégica, hablemos.',
    image: { src: '/media/despacho-planta-abierta.webp', alt: 'Oficina de planta abierta del despacho Praetoria con mamparas de cristal' },
    category: 'mercantil',
    whatsappText: 'Hola, quiero consultar un asunto mercantil de mi empresa.',
  },
  {
    slug: 'derecho-civil',
    group: 'particulares',
    title: 'Abogado de derecho civil en El Puig y Valencia',
    description:
      'Reclamaciones de cantidad, responsabilidad civil, contratos, herencias, alquileres y desahucios para particulares y empresas en El Puig y Valencia.',
    h1: 'Abogado de derecho civil en El Puig y Valencia',
    lede: 'Herencias, reclamaciones, contratos, propiedades y deudas: te ayudamos a afrontarlas con claridad, seguridad y estrategia.',
    intro: [
      'En el ámbito civil se resuelven muchas de las situaciones más comunes, y también más delicadas, de la vida: herencias, reclamaciones, contratos, problemas con propiedades, deudas y desacuerdos entre particulares o con la administración.',
      'No ofrecemos soluciones estándar. Analizamos tu caso en profundidad, valoramos las opciones legales y proponemos el camino más eficaz y realista para proteger tus intereses, ya sea mediante negociación, acuerdo o procedimiento judicial.',
    ],
    servicesTitle: 'Asuntos que llevamos con más frecuencia',
    services: [
      { name: 'Reclamaciones de cantidad' },
      { name: 'Responsabilidad civil' },
      { name: 'Contratos civiles y privados' },
      {
        name: 'Herencias, testamentos y sucesiones',
        links: [{ label: 'Herencia: qué hacer', href: '/herencia-que-hacer/' }],
      },
      {
        name: 'Vivienda, alquileres, desahucios y conflictos vecinales',
        links: [
          { label: 'Si te han demandado por un alquiler', href: '/demanda-contrato-alquiler-que-hacer/' },
          { label: 'Ocupación y alquiler en Valencia', href: '/ocupacion-alquiler-valencia/' },
        ],
      },
      {
        name: 'Recursos ante el Tribunal Supremo',
        links: [
          { label: 'El recurso de casación civil', href: '/como-abordar-un-recurso-de-casacion-civil-y-no-fracasar-en-el-intento/' },
        ],
      },
    ],
    closing:
      'Queremos que tomes decisiones con toda la información, sabiendo que cuentas con un respaldo legal sólido. En derecho civil, como en casi todo, lo importante no es solo tener razón, sino saber cómo defenderla.',
    image: { src: '/media/despacho-zona-mesas.webp', alt: 'Zona de mesas del despacho Praetoria en El Puig' },
    category: 'civil-vivienda',
    whatsappText: 'Hola, quiero consultar un asunto civil.',
  },
  {
    slug: 'familia',
    group: 'particulares',
    title: 'Abogado de familia y divorcios en Valencia',
    description:
      'Divorcios y separaciones, custodia, pensiones, convenios reguladores y modificación de medidas, con discreción y soluciones estables.',
    h1: 'Abogado de familia y divorcios en Valencia',
    lede: 'Detrás de cada caso hay vínculos personales y decisiones que marcan años. Combinamos rigor técnico con un trato cercano y discreto.',
    intro: [
      'Abordamos cada asunto de familia con sensibilidad, discreción y una visión práctica orientada a soluciones estables.',
      'Asistimos en divorcios y separaciones, custodia de menores, régimen de visitas, pensión alimenticia y compensatoria, modificación de medidas y patrimonio familiar. Buscamos acuerdos equilibrados que eviten conflictos innecesarios y, cuando no es posible, defendemos con firmeza tus intereses ante los tribunales.',
    ],
    servicesTitle: 'Qué hacemos en familia',
    services: [
      { name: 'Asesoramiento previo', text: 'Antes de tomar cualquier decisión, tanto si estás dudando como si ya lo tienes claro.' },
      { name: 'Convenios reguladores', text: 'Redacción y negociación.' },
      {
        name: 'Divorcios y separaciones',
        text: 'De mutuo acuerdo y contenciosos.',
        links: [{ label: 'Divorcio de mutuo acuerdo con precio cerrado', href: '/abogado-divorcio-horta-nord-valencia/' }],
      },
      { name: 'Custodia, visitas y pensiones' },
      { name: 'Modificación de medidas y ejecución de sentencias' },
      { name: 'Protección del patrimonio familiar' },
    ],
    closing:
      'Te ayudamos a entender tus derechos, poner orden y tomar decisiones seguras. Una separación es una etapa, no una condena, y puede resolverse de forma digna, eficaz y con futuro.',
    image: { src: '/media/despacho-atencion-cliente.webp', alt: 'Espacio de atención a clientes del despacho Praetoria' },
    category: 'familia',
    whatsappText: 'Hola, quiero consultar un asunto de familia.',
  },
  {
    slug: 'arte-y-patrimonio',
    group: 'particulares',
    title: 'Abogado de arte y patrimonio en Valencia',
    description:
      'Asesoramiento jurídico en arte y patrimonio: compraventa y cesión de obras, herencias con colecciones, atribución, museos y casas de subastas.',
    h1: 'Asesoramiento jurídico en arte y patrimonio',
    lede: 'Las obras de arte no son solo objetos. Son valor, historia y legado, y también un conflicto potencial si no se gestionan bien.',
    intro: [
      'Herencias que incluyen colecciones, compras internacionales, cesiones a museos, atribuciones discutidas, movimientos transfronterizos o ventas privadas: todo esto requiere conocimiento jurídico, pero también sensibilidad, formación específica y experiencia directa.',
      'Juan José Farinós tiene formación en Derecho y en Historia del Arte. Asesoramos a particulares, coleccionistas, inversores, herederos, galeristas e instituciones para que tomen decisiones bien fundadas y acordes al valor cultural y económico de cada pieza.',
    ],
    servicesTitle: 'Qué hacemos en arte y patrimonio',
    services: [
      { name: 'Valoración legal de obras y antigüedades', text: 'En herencias, compraventas o procesos de separación.' },
      {
        name: 'Compra de arte',
        text: 'En galerías, ferias o adquisiciones internacionales, cuidando autenticidad, procedencia y condiciones legales.',
      },
      { name: 'Contratos de cesión', text: 'Compraventa, depósito o reproducción de obras.' },
      { name: 'Herencias con patrimonio artístico o documental' },
      { name: 'Defensa de derechos', text: 'De artistas, coleccionistas y propietarios frente a terceros.' },
      { name: 'Relación con museos', text: 'Fundaciones, comisarios y casas de subastas.' },
      { name: 'Atribución, conservación y exportación de obra' },
    ],
    closing:
      'Aquí el derecho no es solo un marco legal: es una herramienta para preservar, proteger y transmitir patrimonio con seguridad, criterio y visión a largo plazo.',
    image: { src: '/media/arte-museo-visitantes.webp', alt: 'Visitantes observando cuadros en la sala de un museo' },
    gallery: [
      { src: '/media/arte-muestras-color-800.webp', alt: 'Panel de muestras de color expuesto en una pared' },
      { src: '/media/arte-obra-textil-800.webp', alt: 'Obra textil bordada con plumas naranjas' },
      { src: '/media/arte-obra-abstracta-800.webp', alt: 'Obra abstracta en tonos rojos con estructura de rejilla' },
    ],
    whatsappText: 'Hola, quiero consultar un asunto de arte y patrimonio.',
  },
];
