// Modelo de servicios (#5). Un servicio es algo concreto que el despacho hace por alguien, con un siguiente paso.
// Se diferencia de:
//  - el ÁREA (página /<area>/), que agrupa servicios para un público;
//  - el ARTÍCULO (blog), que informa y enlaza al servicio que corresponde.
// Los campos ampliados (problema, revisamos, proceso, documentación, faqs) los completan los embudos por área (#6, #7, #8).
// No se inventan precios, plazos, resultados ni equipo: solo lo que ya está publicado o ha facilitado el propietario.
// Sin alias de importación: Node lo carga directamente para generar docs/SERVICIOS.md.

export type ServicioArea = 'transporte' | 'mercantil' | 'hacienda' | 'civil' | 'familia' | 'arte' | 'laboral';

export type Servicio = {
  /** Identificador estable: se usa en /contacto/?servicio=<id> y en el registro de la consulta. No cambiar. */
  id: string;
  area: ServicioArea;
  nombre: string;
  resumen?: string;
  /** Qué le pasa a quien lo necesita, en sus palabras */
  problema?: string;
  /** A quién se dirige */
  destinatario?: string;
  /** Qué revisa y hace el despacho */
  revisamos?: string[];
  proceso?: string[];
  /** Documentación orientativa: se pide después por canal seguro, nunca en el formulario público */
  documentacion?: string[];
  faqs?: { q: string; a: string }[];
  /** Artículos del blog relacionados (slug) */
  articulos?: string[];
  /** Página propia del servicio, si la tiene (landing existente) */
  pagina?: string;
  /** Texto del botón de consulta; por defecto «Consultar sobre esto» */
  cta?: string;
  /** El siguiente paso que se ofrece, si no es el formulario de contacto general */
  siguientePaso?: { label: string; href: string };
  /** Normas citadas en el texto, con enlace a la fuente oficial (BOE) */
  fuentes?: { label: string; href: string }[];
  /** Transporte: tipo de incidencia que se preelige en el formulario */
  incidencia?: Incidencia;
  /** Estado de revisión jurídica del texto ampliado por el despacho. Sin revisar no debería publicarse (ver docs/SERVICIOS.md) */
  revision?: 'pendiente' | 'revisado';
  /** Título y descripción SEO de la página propia */
  seo?: { title: string; description: string; h1: string };
};

/** Tipos de incidencia del formulario de transporte (#6) */
export const INCIDENCIAS = [
  { id: 'impago', label: 'Porte o factura impagada' },
  { id: 'mercancia', label: 'Mercancía dañada, perdida o con retraso' },
  { id: 'deca', label: 'DeCA, documentación o contratos' },
  { id: 'otra', label: 'Otra incidencia' },
] as const;
export type Incidencia = (typeof INCIDENCIAS)[number]['id'];

const BOE_LCTTM = 'https://www.boe.es/eli/es/l/2009/11/11/15/con';
const BOE_L9_2013 = 'https://www.boe.es/eli/es/l/2013/07/04/9/con';

export const servicios: Servicio[] = [
  // Transporte y logística -------------------------------------------------------------------
  { id: 'transporte-ordenes-carga', area: 'transporte', incidencia: 'deca', nombre: 'Redacción y revisión de órdenes de carga', resumen: 'Órdenes de carga adaptadas a la operativa real de la empresa para prevenir conflictos con transportistas, agencias, clientes y colaboradores.', cta: 'Revisar mis órdenes de carga' },
  { id: 'transporte-contratos', area: 'transporte', incidencia: 'deca', nombre: 'Contratos de transporte y logística', resumen: 'Contratos de transporte, logística, almacenaje, distribución, colaboración y prestación continuada de servicios.' },
  { id: 'transporte-deca-subcontratacion', area: 'transporte', incidencia: 'deca', nombre: 'DECA y subcontratación', resumen: 'Cláusulas para identificar al transportista efectivo, regular la subcontratación y repartir las obligaciones del Documento Electrónico de Control Administrativo.', articulos: ['deca-obligatorio-en-2026-guia-legal-para-transportistas-y-cargadores', 'deca-y-subcontratacion-que-debe-hacer-realmente-una-agencia-de-transporte'] },
  {
    id: 'transporte-portes-impagados',
    area: 'transporte',
    nombre: 'Reclamación de portes impagados',
    resumen: 'Reclamación extrajudicial y judicial de facturas de transporte, con revisión de órdenes, CMR, albaranes y comunicaciones.',
    articulos: ['accion-directa-en-el-transporte-como-reclamar-al-cargador-cuando-no-te-paga-tu-cliente', 'impagos-transporte-reclamar-factura'],
    cta: 'Reclamar un porte impagado',
    pagina: '/reclamacion-portes-impagados/',
    incidencia: 'impago',
    revision: 'pendiente',
    seo: {
      title: 'Reclamación de portes impagados',
      h1: 'Reclamación de portes impagados para transportistas y agencias',
      description: 'Has hecho el porte y no te pagan. Revisamos la cadena de contratación y la documentación, y reclamamos al cliente o, si procede, al cargador.',
    },
    problema: 'Has hecho el porte, la mercancía se entregó y la factura sigue sin pagarse. A veces quien te contrató es una agencia o un intermediario que ha dejado de responder o no tiene con qué pagar.',
    destinatario: 'Transportistas, autónomos con vehículo propio, agencias y operadores logísticos con facturas de transporte pendientes de cobro.',
    revisamos: [
      'Quién te contrató y quién es el cargador real: cómo se ha estructurado la cadena de subcontratación.',
      'Si cabe la acción directa: el transportista que realizó el porte puede reclamar la parte impagada al cargador principal y a quienes le preceden en la cadena.',
      'La documentación que acredita el encargo, el transporte y la entrega.',
      'Qué se puede reclamar además de la factura, como los intereses de demora y los costes de cobro.',
      'Las fechas del caso, porque las acciones derivadas del transporte prescriben en plazos cortos.',
    ],
    proceso: [
      'Revisamos la documentación y la cadena de contratación.',
      'Te explicamos a quién conviene reclamar, por qué vía, el trabajo necesario y los honorarios.',
      'Enviamos un requerimiento formal de pago.',
      'Si no hay pago, preparamos la reclamación judicial del importe, los intereses y, en su caso, las costas.',
    ],
    documentacion: ['Orden de carga o encargo del transporte', 'CMR o carta de porte, mejor firmada en destino', 'Albaranes u otra prueba de entrega', 'Factura o facturas pendientes', 'Comunicaciones: correos, mensajes y avisos de pago'],
    faqs: [
      { q: 'Mi cliente es una agencia que no me paga. ¿Puedo reclamar al cargador?', a: 'Puede ser posible. La disposición adicional sexta de la Ley 9/2013 reconoce al transportista que realizó el porte una acción directa por la parte impagada frente al cargador principal y los demás intervinientes anteriores en la cadena de subcontratación. Hay que estudiar cómo se contrató el transporte y qué documentación existe.' },
      { q: '¿Cuánto tiempo tengo para reclamar?', a: 'Con carácter general, las acciones derivadas del contrato de transporte terrestre prescriben en un año (artículo 79 de la Ley 15/2009), con supuestos especiales y causas de suspensión. El plazo de tu caso depende de sus fechas y documentos: conviene revisarlo cuanto antes.' },
      { q: '¿Qué puedo reclamar además de la factura?', a: 'Según el caso, los intereses de demora y los costes de cobro. Lo valoramos al revisar la documentación.' },
      { q: 'No tengo el CMR firmado. ¿Puedo reclamar igualmente?', a: 'La reclamación es más difícil, pero otras pruebas, como órdenes de carga, albaranes, correos o mensajes, pueden ayudar a acreditar el servicio y la entrega. Lo revisamos contigo.' },
    ],
    fuentes: [
      { label: 'Ley 15/2009, del contrato de transporte terrestre de mercancías (art. 79, prescripción)', href: `${BOE_LCTTM}#a79` },
      { label: 'Ley 9/2013, que modifica la Ley de Ordenación de los Transportes Terrestres (disposición adicional sexta, acción directa)', href: BOE_L9_2013 },
    ],
  },
  {
    id: 'transporte-mercancias',
    area: 'transporte',
    nombre: 'Pérdida, avería y retraso de mercancías',
    resumen: 'Análisis de responsabilidades, limitaciones indemnizatorias, reservas, prueba del daño y reclamaciones derivadas del transporte.',
    incidencia: 'mercancia',
    revision: 'pendiente',
    revisamos: [
      'Si se hicieron reservas por escrito y a tiempo: en la entrega, o en 7 días naturales si el daño no era aparente; para el retraso, en 21 días desde la entrega.',
      'Quién responde en la cadena: cargador, agencia, transportista efectivo o aseguradora.',
      'El límite de indemnización aplicable y si hay motivos para superarlo.',
      'Si el transporte fue internacional y se rige por el Convenio CMR.',
    ],
    documentacion: ['CMR o carta de porte, con las reservas anotadas', 'Fotografías y, si existe, informe pericial', 'Orden de carga y factura de la mercancía', 'Póliza de seguro y comunicaciones con la aseguradora'],
    fuentes: [
      { label: 'Ley 15/2009, art. 57 (límite de indemnización)', href: `${BOE_LCTTM}#a57` },
      { label: 'Ley 15/2009, art. 60 (reservas por pérdidas, averías o retraso)', href: `${BOE_LCTTM}#a60` },
    ],
  },
  { id: 'transporte-cmr-internacional', area: 'transporte', nombre: 'Convenio CMR y transporte internacional', resumen: 'Transporte internacional por carretera: documentación CMR, jurisdicción, plazos y responsabilidad del porteador.' },
  { id: 'transporte-aseguradoras', area: 'transporte', incidencia: 'mercancia', nombre: 'Reclamaciones frente a aseguradoras', resumen: 'Defensa ante rechazos de cobertura, discrepancias en la valoración de daños y conflictos con seguros de transporte.', articulos: ['fraudes-transporte-aseguradora'] },
  { id: 'transporte-conflictos-cadena', area: 'transporte', nombre: 'Conflictos entre cargadores, agencias y transportistas', resumen: 'Determinación de responsabilidades dentro de la cadena de transporte y defensa frente a reclamaciones de terceros.' },
  { id: 'transporte-prevencion', area: 'transporte', nombre: 'Prevención de riesgos contractuales', resumen: 'Revisión de procedimientos, condiciones generales, órdenes de carga y comunicaciones para reducir problemas antes de que se produzcan.', articulos: ['como-proteger-legalmente-tu-empresa-de-transporte-contratos-condiciones-y-claves-para-evitar-problemas'] },
  { id: 'transporte-gerencia', area: 'transporte', nombre: 'Apoyo jurídico para gerencia', resumen: 'Asesoramiento puntual o continuado para tomar decisiones comerciales y operativas con mayor seguridad jurídica.' },

  // Mercantil y sociedades -------------------------------------------------------------------
  { id: 'mercantil-constitucion', area: 'mercantil', nombre: 'Constitución de sociedades', resumen: 'Asesoramiento sobre la forma jurídica más adecuada para tu actividad.' },
  { id: 'mercantil-pactos-socios', area: 'mercantil', nombre: 'Estatutos, pactos de socios y contratos internos', resumen: 'Redacción y revisión de estatutos, pactos de socios, acuerdos de confidencialidad y otros contratos internos.' },
  { id: 'mercantil-conflictos-socios', area: 'mercantil', nombre: 'Conflictos societarios', resumen: 'Impugnación de acuerdos y defensa de socios minoritarios.', articulos: ['problemas-con-mi-socio-que-hacer-cuando-una-empresa-al-50-se-convierte-en-un-conflicto'], cta: 'Consultar un conflicto con mi socio' },
  { id: 'mercantil-reestructuraciones', area: 'mercantil', nombre: 'Reestructuraciones empresariales', resumen: 'Ampliaciones de capital y compraventa de participaciones.' },
  { id: 'mercantil-contratos', area: 'mercantil', nombre: 'Contratos mercantiles nacionales e internacionales' },
  { id: 'mercantil-administradores', area: 'mercantil', nombre: 'Asesoramiento a administradores', resumen: 'Asesoramiento jurídico integral para directivos y órganos de administración.' },

  // Hacienda y Seguridad Social ---------------------------------------------------------------
  { id: 'hacienda-requerimientos', area: 'hacienda', nombre: 'Requerimientos, liquidaciones y sanciones de Hacienda', resumen: 'Requerimientos de información, justificación de ingresos y movimientos bancarios, comprobaciones de IRPF, IVA o Sociedades, propuestas de liquidación y expedientes sancionadores.', articulos: ['hacienda-me-pide-justificar-ingresos', 'has-recibido-una-carta-requerimiento-liquidacion-sancion-o-reclamacion-de-deuda-de-hacienda-o-de-la-seguridad-social'], pagina: '/abogado-hacienda-y-seguridad-social-en-valencia/', siguientePaso: { label: 'Revisar qué he recibido', href: '/abogado-hacienda-y-seguridad-social-en-valencia/#diagnostico' } },
  { id: 'hacienda-seguridad-social', area: 'hacienda', nombre: 'Deudas, apremios y embargos de la Seguridad Social', resumen: 'Reclamaciones de deuda, providencias de apremio, embargos, diferencias de cotización, actas de liquidación y cuotas de autónomos.', pagina: '/abogado-hacienda-y-seguridad-social-en-valencia/', siguientePaso: { label: 'Revisar qué he recibido', href: '/abogado-hacienda-y-seguridad-social-en-valencia/#diagnostico' } },
  { id: 'hacienda-derivacion', area: 'hacienda', nombre: 'Derivación de responsabilidad al administrador', resumen: 'Alegaciones y recursos frente a expedientes que trasladan al administrador las deudas de su empresa.', pagina: '/abogado-hacienda-y-seguridad-social-en-valencia/' },
  { id: 'hacienda-devoluciones', area: 'hacienda', nombre: 'Devolución de ingresos indebidos', resumen: 'Reclamación de cantidades pagadas indebidamente a Hacienda o a la Seguridad Social.', articulos: ['reclamar-devolucion-impuesto-de-matriculacion'] },

  // Civil, herencias y vivienda ---------------------------------------------------------------
  { id: 'civil-reclamaciones', area: 'civil', nombre: 'Reclamaciones de cantidad' },
  { id: 'civil-responsabilidad', area: 'civil', nombre: 'Responsabilidad civil' },
  { id: 'civil-contratos', area: 'civil', nombre: 'Contratos civiles y privados' },
  { id: 'civil-herencias', area: 'civil', nombre: 'Herencias, testamentos y sucesiones', articulos: ['herencia-que-hacer'], cta: 'Consultar una herencia' },
  { id: 'civil-vivienda', area: 'civil', nombre: 'Vivienda, alquileres, desahucios y conflictos vecinales', articulos: ['demanda-contrato-alquiler-que-hacer', 'ocupacion-alquiler-valencia', 'nuevo-decreto-2026-desahucio', 'registro-alquiler-turistico-2026'], cta: 'Consultar un problema de vivienda' },
  { id: 'civil-casacion', area: 'civil', nombre: 'Recursos ante el Tribunal Supremo', articulos: ['como-abordar-un-recurso-de-casacion-civil-y-no-fracasar-en-el-intento'] },

  // Familia y divorcio ---------------------------------------------------------------------------
  { id: 'familia-asesoramiento-previo', area: 'familia', nombre: 'Asesoramiento previo', resumen: 'Antes de tomar cualquier decisión, tanto si estás dudando como si ya lo tienes claro.' },
  { id: 'familia-convenio', area: 'familia', nombre: 'Convenios reguladores', resumen: 'Redacción y negociación.' },
  { id: 'familia-divorcio', area: 'familia', nombre: 'Divorcios y separaciones', resumen: 'De mutuo acuerdo y contenciosos.', pagina: '/abogado-divorcio-horta-nord-valencia/', siguientePaso: { label: 'Comprobar si mi divorcio entra en el precio cerrado', href: '/abogado-divorcio-horta-nord-valencia/#comprobar' } },
  { id: 'familia-custodia', area: 'familia', nombre: 'Custodia, visitas y pensiones' },
  { id: 'familia-modificacion-medidas', area: 'familia', nombre: 'Modificación de medidas y ejecución de sentencias', pagina: '/abogado-divorcio-horta-nord-valencia/' },
  { id: 'familia-patrimonio', area: 'familia', nombre: 'Protección del patrimonio familiar' },
  { id: 'familia-filiacion', area: 'familia', nombre: 'Filiación y reconocimiento de la maternidad o paternidad', articulos: ['puede-mi-pareja-ser-reconocida-legalmente-como-madre-en-espana-si-mi-hijo-ha-nacido-en-el-extranjero'] },

  // Arte y patrimonio ------------------------------------------------------------------------
  { id: 'arte-valoracion', area: 'arte', nombre: 'Valoración legal de obras y antigüedades', resumen: 'En herencias, compraventas o procesos de separación.' },
  { id: 'arte-compra', area: 'arte', nombre: 'Compra de arte', resumen: 'En galerías, ferias o adquisiciones internacionales, cuidando autenticidad, procedencia y condiciones legales.' },
  { id: 'arte-cesion', area: 'arte', nombre: 'Contratos de cesión', resumen: 'Compraventa, depósito o reproducción de obras.' },
  { id: 'arte-herencias', area: 'arte', nombre: 'Herencias con patrimonio artístico o documental' },
  { id: 'arte-derechos', area: 'arte', nombre: 'Defensa de derechos', resumen: 'De artistas, coleccionistas y propietarios frente a terceros.' },
  { id: 'arte-museos', area: 'arte', nombre: 'Relación con museos', resumen: 'Fundaciones, comisarios y casas de subastas.' },
  { id: 'arte-atribucion', area: 'arte', nombre: 'Atribución, conservación y exportación de obra' },
];

export const servicioPorId = (id: string) => servicios.find((s) => s.id === id);
export const serviciosDe = (area: ServicioArea) => servicios.filter((s) => s.area === area);

/** Enlace de consulta con el servicio preseleccionado (el formulario permite cambiarlo). */
export const enlaceConsulta = (s: Pick<Servicio, 'id'>) => `/contacto/?servicio=${encodeURIComponent(s.id)}`;
/** Servicios que citan un artículo: el artículo enlaza al servicio que corresponde */
export const serviciosConArticulo = (slug: string) => servicios.filter((s) => s.articulos?.includes(slug));
