// Contenido de las páginas de área. Textos tomados de la web anterior, ordenados y sin repeticiones.
import { mensajes, type CategoryKey } from './site';
import type { ServicioArea } from './servicios';
import type { LineIcon } from '@/components/Icon';


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
  /** Id de la imagen editorial (src/content/imagenes.json); si está pendiente, la cabecera es tipográfica */
  imagen: string;
  category?: CategoryKey;
  whatsappText: string;
  /** Recorridos por tipo de problema, al principio de la página (#6): cada uno lleva a su servicio o guía */
  /** Laboral: el contacto contextual es el del área laboral (llamadas y WhatsApp, #28) */
  contactoLaboral?: boolean;
  /** Nota de alcance: a quién se representa y conflictos (Laboral), qué no hacemos (Arte) */
  nota?: string;
  /** Texto por defecto del botón de cada servicio del área */
  ctaServicios?: string;
  recorridos?: { titulo: string; texto: string; icono?: LineIcon; enlaces: { label: string; href: string }[] }[];
  /** Asuntos que pueden ser urgentes: la cabecera ofrece «Que me llame un abogado» y la llamada al despacho (#33) */
  urgente?: boolean;
  /** Estado de revisión jurídica del texto del área (#32) */
  revision?: 'pendiente' | 'revisado';
  /** false: noindex y fuera del sitemap hasta la revisión jurídica (#32). Por defecto, indexable. */
  indexable?: boolean;
};

export const areaContent: AreaContent[] = [
  {
    slug: 'logistica-y-transporte-internacional',
    id: 'transporte',
    group: 'empresas',
    title: 'Abogados de transporte y logística en Valencia',
    description:
      'Abogados de transporte en Valencia para agencias, transportistas y cargadores: impagos, daños en la mercancía, CMR, seguros, DeCA, contratos y subcontratación.',
    h1: 'Abogados de transporte y logística en Valencia',
    lede: 'Impagos, daños, reservas en el CMR, aseguradoras, subcontratación y órdenes de carga: respuesta jurídica práctica, basada en cómo funciona de verdad el sector.',
    intro: [
      'Los problemas del transporte no esperan. Conocemos ese entorno de cerca: cómo funciona un operador, una agencia, una ruta de exportación, una reclamación ante un cargador o un siniestro ante el seguro. Por eso intervenimos en los puntos críticos: contratos, reclamaciones, conflictos entre partes y prevención de riesgos.',
      'El área une el ejercicio de la abogacía con experiencia empresarial directa en el transporte y la logística internacional. Conocemos el sector, su lenguaje y sus ritmos, y ofrecemos soluciones rápidas y concretas, orientadas a reducir riesgos y proteger la rentabilidad del negocio.',
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
    imagen: 'transporte',
    category: 'transporte',
    whatsappText: mensajes.transporte,
    recorridos: [
      {
        titulo: 'No me pagan un porte',
        icono: 'euro',
        texto: 'Facturas de transporte pendientes, también cuando quien te contrató es una agencia o un intermediario.',
        enlaces: [
          { label: 'Cómo lo reclamamos', href: '/reclamacion-portes-impagados/' },
          { label: 'Qué es la acción directa', href: '/accion-directa-en-el-transporte-como-reclamar-al-cargador-cuando-no-te-paga-tu-cliente/' },
        ],
      },
      {
        titulo: 'La mercancía llegó dañada, se perdió o llegó tarde',
        icono: 'camion',
        texto: 'Reservas, responsabilidad de cada parte, límites de indemnización y reclamaciones frente a la aseguradora.',
        enlaces: [
          { label: 'Qué revisamos', href: '#transporte-mercancias' },
          { label: 'Consultar mi caso', href: '/contacto/?servicio=transporte-mercancias' },
        ],
      },
      {
        titulo: 'Dudas con el DeCA, la documentación o los contratos',
        icono: 'documento',
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
    title: 'Abogados de derecho mercantil en Valencia | Contratos, sociedades y reclamaciones',
    description:
      'Asesoría en derecho mercantil: contratos, sociedades, reclamaciones comerciales y conflictos entre empresas. Soluciones jurídicas claras para negocios y autónomos en Valencia.',
    h1: 'Abogados de derecho mercantil en Valencia',
    lede: 'Las decisiones legales no pueden tomarse al margen de la estrategia del negocio. Resolvemos los problemas jurídicos dentro de su contexto empresarial.',
    intro: [
      'Sabemos lo que implica dirigir una empresa. Por eso no solo resolvemos problemas jurídicos: los entendemos dentro del contexto empresarial y proponemos soluciones que encajan con tus objetivos y con la realidad de tu actividad.',
      'Conocemos el funcionamiento interno de las empresas, desde pymes familiares hasta estructuras más complejas, y tenemos experiencia real en gestión y en la toma de decisiones. No hablamos desde fuera: hemos estado ahí.',
      'Ofrecemos un acompañamiento completo, ágil y proactivo, tanto para negocios consolidados como para quienes empiezan, combinando el conocimiento legal con la experiencia en logística, relaciones contractuales, estructura societaria y gestión patrimonial.',
    ],
    servicesTitle: 'Qué hacemos en mercantil',
    closing:
      'Si buscas un abogado que entienda tu empresa como un sistema vivo, que sepa cómo se toman decisiones reales y que te acompañe con visión estratégica, hablemos.',
    imagen: 'mercantil',
    category: 'mercantil',
    whatsappText: mensajes.mercantil,
    recorridos: [
      {
        titulo: 'Un conflicto con mi socio',
        icono: 'negociar',
        texto: 'Bloqueos en la junta, acuerdos que perjudican a un socio o una empresa al 50 % que ya no funciona.',
        enlaces: [
          { label: 'Conflictos societarios', href: '#mercantil-conflictos-socios' },
          { label: 'Qué hacer en una empresa al 50 %', href: '/problemas-con-mi-socio-que-hacer-cuando-una-empresa-al-50-se-convierte-en-un-conflicto/' },
        ],
      },
      {
        titulo: 'Un contrato que redactar o revisar',
        icono: 'documento',
        texto: 'Contratos mercantiles, pactos de socios, estatutos o acuerdos de confidencialidad.',
        enlaces: [
          { label: 'Contratos mercantiles', href: '#mercantil-contratos' },
          { label: 'Pactos y estatutos', href: '#mercantil-pactos-socios' },
        ],
      },
      {
        titulo: 'Un cliente o proveedor no cumple',
        icono: 'euro',
        texto: 'Facturas impagadas o incumplimientos entre empresas. Si es un porte, ve a transporte.',
        enlaces: [
          { label: 'Reclamaciones entre empresas', href: '#mercantil-reclamaciones' },
          { label: '¿Es un porte impagado?', href: '/reclamacion-portes-impagados/' },
        ],
      },
    ],
  },
  {
    slug: 'abogado-laboralista-valencia',
    id: 'laboral',
    group: 'particulares',
    title: 'Abogado laboralista en Valencia: despidos, finiquitos e incapacidad',
    description:
      'Abogado laboralista en Valencia para trabajadores y empresas: despidos, salarios y finiquitos, incapacidad permanente, altas médicas y accidentes laborales. Revisamos tu caso antes de actuar.',
    h1: 'Abogado laboralista en Valencia',
    lede: 'Despidos, cantidades pendientes, incapacidad, altas médicas y accidentes de trabajo. Revisamos tu caso con atención a las fechas, que en lo laboral son cortas, y te explicamos las opciones antes de dar ningún paso.',
    intro: [
      'Los asuntos laborales llegan casi siempre con prisa: una carta de despido, un finiquito que no cuadra, un alta médica con la que no estás de acuerdo o un accidente en el trabajo. En muchos de ellos los plazos para reclamar son de días, así que lo primero que hacemos es revisar las fechas.',
      'Como abogado laboralista en Valencia, el despacho asesora a trabajadores y empresas en despidos, reclamaciones salariales, incapacidad permanente, altas médicas, accidentes laborales y cambios en las condiciones de trabajo: desde la primera consulta hasta el acto de conciliación y, si no hay acuerdo, el juicio.',
      'El área laboral del despacho tiene su propio teléfono y su propio WhatsApp, y la atiende una experta en Derecho Laboral. Te explicamos qué se puede hacer, el trabajo que supone y los honorarios antes de empezar, y no prometemos resultados ni indemnizaciones: dependen de los hechos y de las pruebas de cada caso.',
    ],
    servicesTitle: 'Qué hacemos en laboral',
    closing:
      'No envíes informes médicos ni documentos por el formulario: si hacen falta, te los pediremos por un canal seguro. Si tu asunto es una deuda, una cotización o un embargo de la Seguridad Social, corresponde al área de Hacienda y Seguridad Social.',
    nota: 'Si consultas en nombre de una empresa, indícalo en el formulario. Antes de aceptar cualquier encargo revisamos que no exista un conflicto de intereses con otros clientes del despacho.',
    imagen: 'laboral',
    category: 'laboral',
    whatsappText: mensajes.laboral,
    contactoLaboral: true,
    recorridos: [
      {
        titulo: 'Me han despedido',
        icono: 'trabajo',
        texto: 'Carta de despido, fin de contrato o despido sin carta. Revisamos la carta, el finiquito y las fechas.',
        enlaces: [
          { label: 'Cómo lo revisamos', href: '/impugnar-despido/' },
          { label: 'Qué hacer las primeras 48 horas', href: '/despido-valencia-que-hacer/' },
        ],
      },
      {
        titulo: 'Me deben dinero o el finiquito no cuadra',
        icono: 'euro',
        texto: 'Nóminas, pagas, horas o vacaciones sin pagar, o un finiquito mal calculado.',
        enlaces: [{ label: 'Cómo lo reclamamos', href: '/reclamar-salarios-y-finiquito/' }],
      },
      {
        titulo: 'Baja, alta médica o incapacidad',
        icono: 'acompanar',
        texto: 'Incapacidad permanente denegada o en un grado inferior, o un alta con la que no estás de acuerdo.',
        enlaces: [
          { label: 'Incapacidad permanente', href: '/incapacidad-permanente/' },
          { label: 'Altas médicas', href: '#laboral-altas' },
        ],
      },
      {
        titulo: 'He tenido un accidente laboral',
        icono: 'reloj',
        texto: 'Accidentes de trabajo, también al ir o volver, y enfermedades profesionales.',
        enlaces: [{ label: 'Qué revisamos', href: '/accidente-laboral/' }],
      },
      {
        titulo: 'Acoso o cambios en mis condiciones',
        icono: 'negociar',
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
    title: 'Derecho civil en Valencia | Herencias, vivienda y reclamaciones',
    description:
      'Asesoría en derecho civil: contratos, herencias, propiedad, reclamaciones y resolución de conflictos. Soluciones jurídicas claras para particulares y empresas en Valencia.',
    h1: 'Abogados de derecho civil en Valencia',
    lede: 'Herencias, reclamaciones, contratos, propiedades y deudas: te ayudamos a afrontarlas con claridad, seguridad y estrategia.',
    intro: [
      'En el ámbito civil se resuelven muchas de las situaciones más comunes, y también más delicadas, de la vida: herencias, reclamaciones, contratos, problemas con propiedades, deudas y desacuerdos entre particulares o con la administración.',
      'No ofrecemos soluciones estándar. Analizamos tu caso en profundidad, valoramos las opciones legales y proponemos el camino más eficaz y realista para proteger tus intereses, ya sea mediante negociación, acuerdo o procedimiento judicial.',
    ],
    servicesTitle: 'Asuntos que llevamos con más frecuencia',
    closing:
      'Queremos que tomes decisiones con toda la información, sabiendo que cuentas con un respaldo legal sólido. En derecho civil, como en casi todo, lo importante no es solo tener razón, sino saber cómo defenderla.',
    imagen: 'civil',
    category: 'civil-vivienda',
    whatsappText: mensajes.civil,
    recorridos: [
      {
        titulo: 'Una herencia',
        icono: 'documento',
        texto: 'Aceptar o renunciar, repartir entre herederos, testamentos y conflictos familiares por la herencia.',
        enlaces: [
          { label: 'Herencias', href: '#civil-herencias' },
          { label: 'Qué hacer con una herencia', href: '/herencia-que-hacer/' },
        ],
      },
      {
        titulo: 'Mi vivienda o un alquiler',
        icono: 'vivienda',
        texto: 'Contratos de alquiler, impagos, desahucios, ocupación y compraventa de vivienda.',
        enlaces: [{ label: 'Vivienda y alquileres', href: '#civil-vivienda' }],
      },
      {
        titulo: 'Un contrato o una reclamación',
        icono: 'euro',
        texto: 'Alguien no cumple lo pactado, te deben dinero o te reclaman a ti.',
        enlaces: [
          { label: 'Reclamaciones de cantidad', href: '#civil-reclamaciones' },
          { label: 'Contratos', href: '#civil-contratos' },
        ],
      },
      {
        titulo: 'Vecinos o comunidad',
        icono: 'edificio',
        texto: 'Conflictos con vecinos o con la comunidad de propietarios.',
        enlaces: [{ label: 'Consultar mi caso', href: '/contacto/?servicio=civil-vivienda' }],
      },
    ],
  },
  {
    slug: 'familia',
    id: 'familia',
    group: 'particulares',
    title: 'Abogados de familia en Valencia | Divorcios, custodia y pensiones',
    description:
      'Asesoría en derecho de familia: divorcios, custodias, herencias y protección familiar. Soluciones claras, estratégicas y orientadas a acuerdos duraderos en Valencia.',
    h1: 'Abogados de familia y divorcio en Valencia',
    lede: 'Detrás de cada caso hay vínculos personales y decisiones que marcan años. Combinamos rigor técnico con un trato cercano y discreto.',
    intro: [
      'Abordamos cada asunto de familia con sensibilidad, discreción y una visión práctica orientada a soluciones estables.',
      'Asistimos en divorcios y separaciones, custodia de menores, régimen de visitas, pensión alimenticia y compensatoria, modificación de medidas y patrimonio familiar. Buscamos acuerdos equilibrados que eviten conflictos innecesarios y, cuando no es posible, defendemos con firmeza tus intereses ante los tribunales.',
    ],
    servicesTitle: 'Qué hacemos en familia',
    closing:
      'Te ayudamos a entender tus derechos, poner orden y tomar decisiones seguras. Una separación es una etapa, no una condena, y puede resolverse de forma digna, eficaz y con futuro.',
    imagen: 'familia',
    category: 'familia',
    whatsappText: mensajes.familia,
    recorridos: [
      {
        titulo: 'Divorcio de mutuo acuerdo',
        icono: 'familia',
        texto: 'Si estáis de acuerdo en todo, comprueba en dos minutos si tu caso entra en el precio cerrado.',
        enlaces: [{ label: 'Comprobar mi caso', href: '/abogado-divorcio-horta-nord-valencia/#comprobar' }],
      },
      {
        titulo: 'Divorcio sin acuerdo, hijos o bienes',
        icono: 'analisis',
        texto: 'Custodia, pensiones, vivienda o reparto de bienes: necesita un estudio personalizado antes de decidir.',
        enlaces: [
          { label: 'Pedir una valoración', href: '/contacto/?servicio=familia-divorcio' },
          { label: 'Custodia y pensiones', href: '#familia-custodia' },
        ],
      },
      {
        titulo: 'Cambiar medidas o hacer cumplir una sentencia',
        icono: 'documento',
        texto: 'Modificación de medidas por un cambio de circunstancias, impagos de pensión o incumplimientos.',
        enlaces: [{ label: 'Consultar mi caso', href: '/contacto/?servicio=familia-modificacion-medidas' }],
      },
    ],
  },
  {
    slug: 'arte-y-patrimonio',
    id: 'arte',
    group: 'particulares',
    title: 'Abogados de arte y patrimonio en Valencia | Obras y colecciones',
    description:
      'Asesoramiento jurídico en Valencia sobre arte, patrimonio cultural y protección de obras, colecciones y bienes históricos: autenticidad, propiedad, sucesiones y compraventas.',
    h1: 'Asesoramiento jurídico en arte y patrimonio',
    lede: 'Las obras de arte no son solo objetos. Son valor, historia y legado, y también un conflicto potencial si no se gestionan bien.',
    intro: [
      'Herencias que incluyen colecciones, compras internacionales, cesiones a museos, atribuciones discutidas, movimientos transfronterizos o ventas privadas: todo esto requiere conocimiento jurídico, pero también sensibilidad, formación específica y experiencia directa.',
      'El área la dirige un abogado con formación en Derecho y en Historia del Arte. Asesoramos a particulares, coleccionistas, inversores, herederos, galeristas e instituciones para que tomen decisiones bien fundadas y acordes al valor cultural y económico de cada pieza.',
    ],
    servicesTitle: 'Qué hacemos en arte y patrimonio',
    closing:
      'Aquí el derecho no es solo un marco legal: es una herramienta para preservar, proteger y transmitir patrimonio con seguridad, criterio y visión a largo plazo.',
    imagen: 'arte',
    whatsappText: mensajes.arte,
    nota: 'Nuestro trabajo es jurídico. Cuando hace falta una tasación, un peritaje de autenticidad o un informe de conservación, lo realiza un especialista independiente; nosotros valoramos su informe desde el punto de vista legal y lo integramos en la estrategia.',
    ctaServicios: 'Solicitar una consulta especializada',
  },
  {
    // #32. Redactado a partir de la Constitución, la LECrim y el Código Penal (BOE consolidado, 24/10/2026).
    // Pendiente de revisión jurídica: noindex y fuera del sitemap hasta que el despacho lo valide.
    slug: 'abogado-penalista-valencia',
    id: 'penal',
    group: 'particulares',
    title: 'Abogados penalistas en Valencia | Detenciones, citaciones y juicios rápidos',
    description:
      'Asistencia al detenido, citaciones y juicios rápidos, alcoholemias, lesiones, hurtos y estafas. Revisamos tu situación y te explicamos tus derechos y opciones antes de actuar.',
    h1: 'Abogados penalistas en Valencia',
    lede: 'Detenciones, citaciones del juzgado, juicios rápidos, alcoholemias, lesiones, hurtos y estafas. Te explicamos tus derechos y tus opciones con calma, también cuando el asunto no puede esperar.',
    intro: [
      'Un asunto penal suele empezar de golpe: una detención, una citación del juzgado para dentro de unos días o una denuncia que no esperabas. Lo primero es saber qué derechos tienes y qué fechas hay, y después decidir con información qué conviene hacer.',
      'Atendemos tanto a la persona investigada o acusada como a la víctima que quiere denunciar o reclamar. Antes de aceptar un asunto revisamos que no exista un conflicto de intereses, te explicamos el trabajo que supone y los honorarios, y no prometemos resultados: dependen de los hechos y de las pruebas de cada caso.',
    ],
    servicesTitle: 'Qué hacemos en penal',
    closing:
      'Si estás en peligro o presencias un delito que se está cometiendo, llama al 112. Para todo lo demás, cuéntanos qué ha pasado y qué fechas tienes: la solicitud de llamada no suspende ninguna citación ni ningún plazo.',
    nota: 'No envíes atestados, informes médicos ni otros documentos por el formulario: si hacen falta, te los pediremos por un canal seguro. Atendemos según disponibilidad; no ofrecemos un servicio de guardia permanente.',
    imagen: 'penal',
    whatsappText: mensajes.penal,
    ctaServicios: 'Consultar sobre esto',
    urgente: true,
    revision: 'revisado',
    indexable: true,
    recorridos: [
      {
        titulo: 'Me han detenido o han detenido a un familiar',
        icono: 'acompanar',
        texto: 'Derechos de la persona detenida, abogado de confianza, declaración y puesta a disposición judicial.',
        enlaces: [{ label: 'Qué derechos tiene', href: '/asistencia-al-detenido/' }],
      },
      {
        titulo: 'Me han citado al juzgado',
        icono: 'documento',
        texto: 'Citación como investigado, para un juicio rápido o para un juicio por delito leve.',
        enlaces: [{ label: 'Cómo prepararte', href: '/citacion-juzgado-juicio-rapido/' }],
      },
      {
        titulo: 'Alcoholemia o un delito de tráfico',
        icono: 'ruta',
        texto: 'Positivo en un control, exceso de velocidad grave, conducción sin permiso o negativa a las pruebas.',
        enlaces: [{ label: 'Cuándo es delito', href: '/alcoholemia-y-seguridad-vial/' }],
      },
      {
        titulo: 'Una pelea, una agresión o unas lesiones',
        icono: 'negociar',
        texto: 'Si te han agredido y quieres denunciar, o si te han denunciado por unas lesiones.',
        enlaces: [{ label: 'Denuncia y defensa', href: '/lesiones-y-agresiones/' }],
      },
      {
        titulo: 'Un hurto o un robo',
        icono: 'edificio',
        texto: 'Defensa si te acusan y denuncia si lo has sufrido. La cuantía y la forma de los hechos lo cambian todo.',
        enlaces: [{ label: 'Diferencias y penas', href: '/hurto-y-robo/' }],
      },
      {
        titulo: 'Me han estafado o me acusan de estafa',
        icono: 'euro',
        texto: 'Engaños para pagar o transferir dinero, fraudes por internet o con tarjeta.',
        enlaces: [{ label: 'Qué hacer', href: '/estafas/' }],
      },
      {
        titulo: 'Amenazas, coacciones o violencia en casa',
        icono: 'acompanar',
        texto: 'Orientación con discreción, a víctimas y a personas denunciadas. Si estás en peligro, llama al 112.',
        enlaces: [{ label: 'Cómo te ayudamos', href: '#penal-violencia-amenazas' }],
      },
      {
        titulo: 'Necesito que me llame un abogado',
        icono: 'reloj',
        texto: 'Si tu asunto tiene una fecha muy próxima, pide que te llamemos. Atendemos según disponibilidad.',
        enlaces: [{ label: 'Solicitar llamada', href: '/que-me-llame-un-abogado/?area=penal' }],
      },
    ],
  },
];
