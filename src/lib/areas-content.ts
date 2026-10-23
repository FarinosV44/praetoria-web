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
  /** Recorridos por tipo de problema, al principio de la página (#6): cada uno lleva a su servicio o guía */
  /** Laboral: la llamada principal va a Lucía López (solo llamadas, sin WhatsApp propio) */
  contactoLaboral?: boolean;
  /** Nota sobre a quién se representa y la revisión de conflictos (Laboral) */
  nota?: string;
  recorridos?: { titulo: string; texto: string; enlaces: { label: string; href: string }[] }[];
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
    recorridos: [
      {
        titulo: 'No me pagan un porte',
        texto: 'Facturas de transporte pendientes, también cuando quien te contrató es una agencia o un intermediario.',
        enlaces: [
          { label: 'Cómo lo reclamamos', href: '/reclamacion-portes-impagados/' },
          { label: 'Qué es la acción directa', href: '/accion-directa-en-el-transporte-como-reclamar-al-cargador-cuando-no-te-paga-tu-cliente/' },
        ],
      },
      {
        titulo: 'La mercancía llegó dañada, se perdió o llegó tarde',
        texto: 'Reservas, responsabilidad de cada parte, límites de indemnización y reclamaciones frente a la aseguradora.',
        enlaces: [
          { label: 'Qué revisamos', href: '#transporte-mercancias' },
          { label: 'Consultar mi caso', href: '/contacto/?servicio=transporte-mercancias' },
        ],
      },
      {
        titulo: 'Dudas con el DeCA, la documentación o los contratos',
        texto: 'Órdenes de carga, subcontratación, quién debe emitir el DeCA y cómo repartir las obligaciones.',
        enlaces: [
          { label: 'Ver el servicio', href: '#transporte-deca-subcontratacion' },
          { label: 'Guías sobre el DeCA', href: '#deca' },
        ],
      },
    ],
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
    slug: 'abogado-laboralista-valencia',
    id: 'laboral',
    group: 'particulares',
    title: 'Abogado laboralista en Valencia y El Puig',
    description:
      'Despidos, salarios y finiquitos, incapacidad permanente, altas médicas y accidentes laborales. Revisamos tu caso y te explicamos tus opciones antes de actuar.',
    h1: 'Abogados laboralistas en Valencia y El Puig',
    lede: 'Despidos, cantidades pendientes, incapacidad, altas médicas y accidentes de trabajo. Revisamos tu caso con atención a las fechas, que en lo laboral son cortas, y te explicamos las opciones antes de dar ningún paso.',
    intro: [
      'Los asuntos laborales llegan casi siempre con prisa: una carta de despido, un finiquito que no cuadra, un alta médica con la que no estás de acuerdo o un accidente en el trabajo. En muchos de ellos los plazos para reclamar son de días, así que lo primero que hacemos es revisar las fechas.',
      'Lucía López, experta en Derecho Laboral, atiende las consultas laborales del despacho. Te explicamos qué se puede hacer, el trabajo que supone y los honorarios antes de empezar, y no prometemos resultados ni indemnizaciones: dependen de los hechos y de las pruebas de cada caso.',
    ],
    servicesTitle: 'Qué hacemos en laboral',
    closing:
      'No envíes informes médicos ni documentos por el formulario: si hacen falta, te los pediremos por un canal seguro. Si tu asunto es una deuda, una cotización o un embargo de la Seguridad Social, corresponde al área de Hacienda y Seguridad Social.',
    nota: 'Si consultas en nombre de una empresa, indícalo en el formulario. Antes de aceptar cualquier encargo revisamos que no exista un conflicto de intereses con otros clientes del despacho.',
    image: { src: '/media/despacho-zona-espera.webp', alt: 'Zona de espera del despacho Praetoria en El Puig' },
    category: 'laboral',
    whatsappText: mensajes.laboral,
    contactoLaboral: true,
    recorridos: [
      {
        titulo: 'Me han despedido',
        texto: 'Carta de despido, fin de contrato o despido sin carta. Revisamos la carta, el finiquito y las fechas.',
        enlaces: [
          { label: 'Cómo lo revisamos', href: '/impugnar-despido/' },
          { label: 'Qué hacer las primeras 48 horas', href: '/despido-valencia-que-hacer/' },
        ],
      },
      {
        titulo: 'Me deben dinero o el finiquito no cuadra',
        texto: 'Nóminas, pagas, horas o vacaciones sin pagar, o un finiquito mal calculado.',
        enlaces: [{ label: 'Cómo lo reclamamos', href: '/reclamar-salarios-y-finiquito/' }],
      },
      {
        titulo: 'Baja, alta médica o incapacidad',
        texto: 'Incapacidad permanente denegada o en un grado inferior, o un alta con la que no estás de acuerdo.',
        enlaces: [
          { label: 'Incapacidad permanente', href: '/incapacidad-permanente/' },
          { label: 'Altas médicas', href: '#laboral-altas' },
        ],
      },
      {
        titulo: 'He tenido un accidente laboral',
        texto: 'Accidentes de trabajo, también al ir o volver, y enfermedades profesionales.',
        enlaces: [{ label: 'Qué revisamos', href: '/accidente-laboral/' }],
      },
      {
        titulo: 'Acoso o cambios en mis condiciones',
        texto: 'Acoso, vulneración de derechos o cambios de horario, funciones, salario o centro de trabajo.',
        enlaces: [
          { label: 'Acoso', href: '#laboral-acoso' },
          { label: 'Cambios de condiciones', href: '#laboral-condiciones' },
        ],
      },
    ],
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
    recorridos: [
      {
        titulo: 'Divorcio de mutuo acuerdo',
        texto: 'Si estáis de acuerdo en todo, comprueba en dos minutos si tu caso entra en el precio cerrado.',
        enlaces: [{ label: 'Comprobar mi caso', href: '/abogado-divorcio-horta-nord-valencia/#comprobar' }],
      },
      {
        titulo: 'Divorcio sin acuerdo, hijos o bienes',
        texto: 'Custodia, pensiones, vivienda o reparto de bienes: necesita un estudio personalizado antes de decidir.',
        enlaces: [
          { label: 'Pedir una valoración', href: '/contacto/?servicio=familia-divorcio' },
          { label: 'Custodia y pensiones', href: '#familia-custodia' },
        ],
      },
      {
        titulo: 'Cambiar medidas o hacer cumplir una sentencia',
        texto: 'Modificación de medidas por un cambio de circunstancias, impagos de pensión o incumplimientos.',
        enlaces: [{ label: 'Consultar mi caso', href: '/contacto/?servicio=familia-modificacion-medidas' }],
      },
    ],
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
