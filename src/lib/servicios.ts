// Modelo de servicios (#5). Un servicio es algo concreto que el despacho hace por alguien, con un siguiente paso.
// Se diferencia de:
//  - el ÁREA (página /<area>/), que agrupa servicios para un público;
//  - el ARTÍCULO (blog), que informa y enlaza al servicio que corresponde.
// Los campos ampliados (problema, revisamos, proceso, documentación, faqs) los completan los embudos por área (#6, #7, #8).
// No se inventan precios, plazos, resultados ni equipo: solo lo que ya está publicado o ha facilitado el propietario.
// Sin alias de importación: Node lo carga directamente para generar docs/SERVICIOS.md.

export type ServicioArea = 'transporte' | 'mercantil' | 'hacienda' | 'civil' | 'familia' | 'arte' | 'laboral' | 'penal';

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
  /** Documentación orientativa: se pide después por canal seguro, nunca en el formulario público.
   *  Un documento `sensible` (p. ej. informes médicos) solo se pedirá por el futuro portal, nunca por la web pública. */
  documentacion?: Documento[];
  faqs?: { q: string; a: string }[];
  /** Artículos del blog relacionados (slug) */
  articulos?: string[];
  /** Página propia del servicio, si la tiene (landing existente) */
  pagina?: string;
  /** Imagen editorial de la página propia (id en src/content/imagenes.json). Sin ella, la cabecera es tipográfica (#28). */
  imagen?: string;
  /** Texto del botón de consulta; por defecto «Consultar sobre esto» */
  cta?: string;
  /** El siguiente paso que se ofrece, si no es el formulario de contacto general */
  siguientePaso?: { label: string; href: string };
  /** Normas citadas en el texto, con enlace a la fuente oficial (BOE) */
  fuentes?: { label: string; href: string }[];
  /** Transporte: tipo de incidencia que se preelige en el formulario */
  incidencia?: Incidencia;
  /** Laboral: tipo de problema que se preelige en el formulario */
  problemaLaboral?: ProblemaLaboral;
  /** Qué no incluye o dónde se trata (para delimitar servicios que se solapan) */
  alcance?: string;
  /** Una pregunta mínima pertinente que se hace en el formulario al elegir este servicio (#8) */
  preguntaMinima?: { label: string; opciones: string[] };
  /** Estado de revisión jurídica del texto ampliado por el despacho. Sin revisar no debería publicarse (ver docs/SERVICIOS.md) */
  revision?: 'pendiente' | 'revisado';
  /** Título y descripción SEO de la página propia */
  seo?: { title: string; description: string; h1: string };
  /** Qué no puede esperar (#32): factores que hacen urgente el asunto. Activan el botón «Que me llame un abogado» (#33). */
  urgencia?: string[];
  /** Otros servicios relacionados (ids), enlazados al final de la página */
  relacionados?: string[];
  /** false: la página propia lleva noindex y queda fuera del sitemap hasta la revisión jurídica (#32). Por defecto, indexable. */
  indexable?: boolean;
};

/** Modelo de checklist documental, reutilizable por el futuro portal de clientes (#7). Sin almacenamiento en la web pública. */
export type Documento = string | { label: string; sensible: true };
export const docLabel = (d: Documento) => (typeof d === 'string' ? d : d.label);
export const docSensible = (d: Documento) => typeof d !== 'string';

export { PROBLEMAS_LABORALES, INCIDENCIAS, type ProblemaLaboral, type Incidencia } from './servicios-listas.ts';
import type { ProblemaLaboral, Incidencia } from './servicios-listas.ts';

const BOE_LCTTM = 'https://www.boe.es/eli/es/l/2009/11/11/15/con';
const BOE_L9_2013 = 'https://www.boe.es/eli/es/l/2013/07/04/9/con';
const BOE_ET = 'https://www.boe.es/eli/es/rdlg/2015/10/23/2/con';
const BOE_LGSS = 'https://www.boe.es/eli/es/rdlg/2015/10/30/8/con';
const BOE_CE = 'https://www.boe.es/eli/es/c/1978/12/27/(1)/con';
const BOE_LECRIM = 'https://www.boe.es/eli/es/rd/1882/09/14/(1)/con';
const BOE_CP = 'https://www.boe.es/eli/es/lo/1995/11/23/10/con';
const BOE_RGC = 'https://www.boe.es/eli/es/rd/2003/11/21/1428/con';
const BOE_LOTT = 'https://www.boe.es/eli/es/l/1987/07/30/16/con';
const BOE_LO1_2025 = 'https://www.boe.es/eli/es/lo/2025/01/02/1/con';
const BOE_HABEAS = 'https://www.boe.es/eli/es/lo/1984/05/24/6/con';
const MEDICOS: Documento = { label: 'Informes médicos: solo cuando te los pidamos, y por un canal seguro', sensible: true };

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
    imagen: 'portes-impagados',
    pagina: '/reclamacion-portes-impagados/',
    incidencia: 'impago',
    revision: 'revisado',
    seo: {
      title: 'Reclamación de portes impagados',
      h1: 'Reclamación de portes impagados para transportistas y agencias',
      description: 'Has hecho el porte y no te pagan. Revisamos la cadena de contratación y la documentación, y reclamamos al cliente o, si procede, al cargador.',
    },
    problema: 'Has hecho el porte, la mercancía se entregó y la factura sigue sin pagarse. A veces quien te contrató es una agencia o un intermediario que ha dejado de responder o no tiene con qué pagar.',
    destinatario: 'Transportistas, autónomos con vehículo propio, agencias y operadores logísticos con facturas de transporte pendientes de cobro.',
    revisamos: [
      'Quién te contrató y quién es el cargador real: cómo se ha estructurado la cadena de subcontratación.',
      'Si cabe la acción directa: cuando quien contrató el porte no paga, el transportista que lo realizó efectivamente puede reclamar la parte impagada al cargador principal y a quienes le preceden en la cadena de subcontratación.',
      'La documentación que acredita el encargo, el transporte y la entrega.',
      'Qué se puede reclamar además de la factura, como los intereses de demora y los costes de cobro.',
      'Las fechas del caso, porque las acciones derivadas del transporte prescriben en plazos cortos.',
      'La cuantía: en las controversias de transporte de hasta 15.000 euros se presume, salvo rechazo expreso previo, el sometimiento a la Junta Arbitral del Transporte (artículo 38 de la Ley de Ordenación de los Transportes Terrestres).',
    ],
    proceso: [
      'Revisamos la documentación y la cadena de contratación.',
      'Te explicamos a quién conviene reclamar, por qué vía, el trabajo necesario y los honorarios.',
      'Enviamos un requerimiento de pago fehaciente con una propuesta de negociación, de forma que sirva también como el intento de solución extrajudicial (MASC) que la Ley Orgánica 1/2025 exige antes de acudir a los tribunales.',
      'Si no hay acuerdo, presentamos la reclamación ante la Junta Arbitral del Transporte o el juzgado, según corresponda, por el importe, los intereses y, en su caso, las costas.',
    ],
    documentacion: ['Orden de carga o encargo del transporte', 'CMR o carta de porte, mejor firmada en destino', 'Albaranes u otra prueba de entrega', 'Factura o facturas pendientes', 'Comunicaciones: correos, mensajes y avisos de pago'],
    faqs: [
      { q: 'Mi cliente es una agencia que no me paga. ¿Puedo reclamar al cargador?', a: 'Puede ser posible. La disposición adicional sexta de la Ley 9/2013 reconoce al transportista que realizó el porte una acción directa por la parte impagada frente al cargador principal y los demás intervinientes anteriores en la cadena de subcontratación. Hay que estudiar cómo se contrató el transporte y qué documentación existe.' },
      { q: '¿Cuánto tiempo tengo para reclamar?', a: 'Con carácter general, las acciones derivadas del contrato de transporte terrestre prescriben en un año (artículo 79 de la Ley 15/2009), con supuestos especiales y causas de suspensión. El plazo de tu caso depende de sus fechas y documentos: conviene revisarlo cuanto antes.' },
      { q: '¿Qué puedo reclamar además de la factura?', a: 'Según el caso, los intereses de demora y los costes de cobro. Lo valoramos al revisar la documentación.' },
      { q: '¿Tengo que intentar negociar antes de demandar?', a: 'En general, sí. Desde el 3 de abril de 2025, para presentar una demanda civil o mercantil, incluido el procedimiento monitorio según el criterio mayoritario de los juzgados, hay que acreditar un intento previo de solución extrajudicial (MASC). Preparamos el requerimiento de forma que sirva para ese requisito.' },
      { q: 'No tengo el CMR firmado. ¿Puedo reclamar igualmente?', a: 'La reclamación es más difícil, pero otras pruebas, como órdenes de carga, albaranes, correos o mensajes, pueden ayudar a acreditar el servicio y la entrega. Lo revisamos contigo.' },
    ],
    fuentes: [
      { label: 'Ley 15/2009, del contrato de transporte terrestre de mercancías (art. 79, prescripción)', href: `${BOE_LCTTM}#a79` },
      { label: 'Ley 9/2013, que modifica la Ley de Ordenación de los Transportes Terrestres (disposición adicional sexta, acción directa)', href: BOE_L9_2013 },
      { label: 'Ley 16/1987, de Ordenación de los Transportes Terrestres (art. 38, Juntas Arbitrales del Transporte)', href: `${BOE_LOTT}#a38` },
      { label: 'Ley Orgánica 1/2025, de medidas en materia de eficiencia del Servicio Público de Justicia (requisito de procedibilidad)', href: BOE_LO1_2025 },
    ],
  },
  {
    id: 'transporte-mercancias',
    area: 'transporte',
    nombre: 'Pérdida, avería y retraso de mercancías',
    resumen: 'Análisis de responsabilidades, limitaciones indemnizatorias, reservas, prueba del daño y reclamaciones derivadas del transporte.',
    incidencia: 'mercancia',
    revision: 'revisado',
    revisamos: [
      'Si se hicieron reservas por escrito y a tiempo: en la entrega, o en 7 días naturales si el daño no era aparente; para el retraso, en 21 días desde la entrega (no son necesarias si la mercancía se examinó conjuntamente).',
      'Quién responde en la cadena: cargador, agencia, transportista efectivo o aseguradora.',
      'El límite de indemnización aplicable y si hay motivos para superarlo.',
      'Si el transporte fue internacional y se rige por el Convenio CMR, que tiene sus propios plazos de reserva, límites de indemnización y prescripción.',
      'Los plazos: la acción prescribe, con carácter general, en un año desde la entrega, y antes de demandar hay que intentar una solución extrajudicial (MASC); hasta 15.000 euros puede corresponder a la Junta Arbitral del Transporte.',
    ],
    documentacion: ['CMR o carta de porte, con las reservas anotadas', 'Fotografías y, si existe, informe pericial', 'Orden de carga y factura de la mercancía', 'Póliza de seguro y comunicaciones con la aseguradora'],
    fuentes: [
      { label: 'Ley 15/2009, art. 57 (límite de indemnización)', href: `${BOE_LCTTM}#a57` },
      { label: 'Ley 15/2009, art. 60 (reservas por pérdidas, averías o retraso)', href: `${BOE_LCTTM}#a60` },
      { label: 'Ley 15/2009, art. 79 (prescripción)', href: `${BOE_LCTTM}#a79` },
      { label: 'Ley 16/1987, de Ordenación de los Transportes Terrestres (art. 38, Juntas Arbitrales del Transporte)', href: `${BOE_LOTT}#a38` },
      { label: 'Ley Orgánica 1/2025, de medidas en materia de eficiencia del Servicio Público de Justicia (requisito de procedibilidad)', href: BOE_LO1_2025 },
    ],
  },
  { id: 'transporte-cmr-internacional', area: 'transporte', nombre: 'Convenio CMR y transporte internacional', resumen: 'Transporte internacional por carretera: documentación CMR, jurisdicción, plazos y responsabilidad del porteador.' },
  { id: 'transporte-aseguradoras', area: 'transporte', incidencia: 'mercancia', nombre: 'Reclamaciones frente a aseguradoras', resumen: 'Defensa ante rechazos de cobertura, discrepancias en la valoración de daños y conflictos con seguros de transporte.', articulos: ['aseguradora-rechaza-siniestro-transporte-estafa-robo-mercancia', 'fraudes-transporte-aseguradora'] },
  { id: 'transporte-conflictos-cadena', area: 'transporte', nombre: 'Conflictos entre cargadores, agencias y transportistas', resumen: 'Determinación de responsabilidades dentro de la cadena de transporte y defensa frente a reclamaciones de terceros.' },
  { id: 'transporte-prevencion', area: 'transporte', nombre: 'Prevención de riesgos contractuales', resumen: 'Revisión de procedimientos, condiciones generales, órdenes de carga y comunicaciones para reducir problemas antes de que se produzcan.', articulos: ['como-proteger-legalmente-tu-empresa-de-transporte-contratos-condiciones-y-claves-para-evitar-problemas'] },
  { id: 'transporte-gerencia', area: 'transporte', nombre: 'Apoyo jurídico para gerencia', resumen: 'Asesoramiento puntual o continuado para tomar decisiones comerciales y operativas con mayor seguridad jurídica.' },

  // Laboral (#7). Atiende Lucía López. Textos ampliados revisados el 26/10/2026 contra la normativa vigente. ---
  {
    id: 'laboral-despidos',
    area: 'laboral',
    nombre: 'Despidos e impugnación',
    resumen: 'Revisión de la carta y del finiquito, conciliación e impugnación del despido disciplinario, objetivo o colectivo.',
    articulos: ['despido-valencia-que-hacer'],
    cta: 'Solicitar revisión de mi despido',
    imagen: 'despidos',
    pagina: '/impugnar-despido/',
    problemaLaboral: 'despido',
    revision: 'revisado',
    seo: {
      title: 'Impugnar un despido: revisión de la carta y el finiquito',
      h1: 'Impugnar un despido: revisamos tu carta y tu finiquito',
      description: 'Te han despedido y no sabes si firmar ni qué reclamar. Revisamos la carta, el finiquito y las fechas, y te explicamos tus opciones antes de actuar.',
    },
    problema: 'Te han entregado una carta de despido, o te han comunicado el despido sin carta. No sabes si firmar, si el finiquito es correcto ni qué puedes reclamar.',
    destinatario: 'Personas trabajadoras que han recibido una comunicación de despido o de fin de un contrato temporal.',
    revisamos: [
      'La carta: el tipo de despido, los hechos o las causas que se alegan y la fecha de efectos.',
      'El finiquito y, si la hay, la indemnización ofrecida: si se han liquidado bien salario, vacaciones y pagas.',
      'Si el despido podría ser procedente, improcedente o nulo, y qué consecuencias tendría cada caso.',
      'Las fechas: la acción contra el despido caduca a los veinte días hábiles. Presentar la solicitud de conciliación suspende ese plazo, pero no lo reinicia.',
    ],
    proceso: [
      'Revisamos la carta, el finiquito y tu situación.',
      'Te explicamos las opciones, el trabajo necesario y los honorarios.',
      'Presentamos la solicitud de conciliación previa y negociamos si hay margen.',
      'Si no hay acuerdo, preparamos la demanda y te acompañamos al juicio.',
    ],
    documentacion: ['Carta de despido o comunicación recibida', 'Contrato y, si las hay, prórrogas o modificaciones', 'Últimas nóminas', 'Finiquito o liquidación ofrecida, firmada o no', 'Informe de vida laboral'],
    faqs: [
      { q: '¿Tengo que firmar la carta de despido?', a: 'Firmar solo acredita que la has recibido. Puedes escribir «no conforme» junto a tu firma para dejar constancia de que no estás de acuerdo.' },
      { q: '¿Cuánto tiempo tengo para reclamar?', a: 'La acción contra el despido caduca a los veinte días hábiles siguientes al despido (artículo 59.3 del Estatuto de los Trabajadores). La solicitud de conciliación suspende el plazo, que se reanuda después del acto de conciliación o, si no se celebra, a los quince días hábiles de presentarla (artículo 65.1 de la Ley Reguladora de la Jurisdicción Social). El cómputo depende de tu caso: consulta cuanto antes.' },
      { q: '¿Qué diferencia hay entre finiquito e indemnización?', a: 'El finiquito liquida lo que ya se te debía: salario de los últimos días, vacaciones no disfrutadas y partes proporcionales de pagas. La indemnización compensa la extinción del contrato y depende del tipo de despido. Son conceptos distintos.' },
      { q: 'Ya he firmado el finiquito. ¿Puedo reclamar?', a: 'Depende de lo que hayas firmado y de cómo lo hayas hecho. Firmar el finiquito no siempre impide reclamar, pero conviene revisarlo cuanto antes.' },
    ],
    fuentes: [
      { label: 'Estatuto de los Trabajadores, art. 55 (forma y efectos del despido disciplinario)', href: `${BOE_ET}#a55` },
      { label: 'Estatuto de los Trabajadores, art. 59 (prescripción y caducidad)', href: `${BOE_ET}#a59` },
    ],
  },
  {
    id: 'laboral-cantidades',
    area: 'laboral',
    nombre: 'Salarios y finiquitos',
    resumen: 'Reclamación de salarios, horas, pagas o finiquitos que no se han pagado o se han calculado mal.',
    cta: 'Revisar lo que me deben',
    imagen: 'salarios-finiquito',
    pagina: '/reclamar-salarios-y-finiquito/',
    problemaLaboral: 'cantidades',
    revision: 'revisado',
    seo: {
      title: 'Reclamar salarios atrasados o un finiquito mal calculado',
      h1: 'Reclamar salarios, horas o un finiquito mal calculado',
      description: 'Te deben nóminas, pagas o horas, o el finiquito no cuadra. Revisamos contrato, convenio y nóminas, y reclamamos lo que corresponda.',
    },
    problema: 'La empresa te debe nóminas, pagas extra, horas o vacaciones, o el finiquito que te ofrecen no cuadra con lo que te corresponde.',
    destinatario: 'Personas trabajadoras en activo o que ya han dejado la empresa y tienen cantidades pendientes.',
    revisamos: [
      'Qué conceptos se deben y en qué se basan: contrato, convenio colectivo y nóminas.',
      'Si el finiquito liquida bien el salario, las vacaciones no disfrutadas y las partes proporcionales de pagas.',
      'Las fechas de cada cantidad: con carácter general, la reclamación de percepciones económicas prescribe al año desde que pudo ejercitarse.',
      'Si la empresa ha cerrado o es insolvente, qué vías existen para cobrar.',
    ],
    proceso: [
      'Revisamos las nóminas, el contrato y el convenio.',
      'Calculamos lo que se reclama y te explicamos el trabajo y los honorarios.',
      'Presentamos la solicitud de conciliación previa.',
      'Si no hay pago, presentamos la demanda de reclamación de cantidad.',
    ],
    documentacion: ['Contrato de trabajo', 'Nóminas del periodo reclamado', 'Finiquito o liquidación', 'Registro de jornada u otra prueba de las horas, si se reclaman', 'Comunicaciones con la empresa'],
    faqs: [
      { q: '¿Cuánto tiempo tengo para reclamar salarios atrasados?', a: 'Con carácter general, un año desde que cada cantidad pudo reclamarse (artículo 59 del Estatuto de los Trabajadores). Por eso conviene revisar cuanto antes las cantidades más antiguas.' },
      { q: '¿Puedo reclamar si sigo trabajando en la empresa?', a: 'Sí: la reclamación de cantidad no exige haber dejado la empresa. Valoramos contigo cómo y cuándo plantearla.' },
      { q: '¿Y si la empresa ha cerrado o no tiene con qué pagar?', a: 'Hay que estudiar la situación de la empresa. En determinados casos de insolvencia interviene el Fondo de Garantía Salarial (FOGASA), con sus propios límites.' },
    ],
    fuentes: [
      { label: 'Estatuto de los Trabajadores, art. 29 (liquidación y pago del salario)', href: `${BOE_ET}#a29` },
      { label: 'Estatuto de los Trabajadores, art. 59 (prescripción y caducidad)', href: `${BOE_ET}#a59` },
    ],
  },
  {
    id: 'laboral-incapacidad',
    area: 'laboral',
    nombre: 'Incapacidad permanente',
    resumen: 'Solicitud, revisión y reclamación de la incapacidad permanente ante la Seguridad Social.',
    cta: 'Revisar mi caso de incapacidad',
    pagina: '/incapacidad-permanente/',
    problemaLaboral: 'incapacidad',
    revision: 'revisado',
    alcance: 'Las deudas, cotizaciones, apremios y embargos de la Seguridad Social se tratan en Hacienda y Seguridad Social.',
    seo: {
      title: 'Abogado de incapacidad permanente',
      h1: 'Incapacidad permanente: solicitud, revisión y reclamación',
      description: '¿Te han denegado la incapacidad permanente o te la han reconocido en un grado inferior? Revisamos la resolución y te explicamos cómo reclamar.',
    },
    problema: 'Llevas tiempo de baja o con limitaciones para trabajar y quieres saber si puedes pedir una incapacidad permanente, o te la han denegado o reconocido en un grado inferior al que esperabas.',
    destinatario: 'Personas trabajadoras, en activo o de baja, con secuelas o limitaciones duraderas.',
    revisamos: [
      'En qué fase estás: baja, solicitud, resolución del INSS o reclamación previa.',
      'Qué grado podría corresponder (parcial, total, absoluta o gran incapacidad) según tu profesión habitual y tus limitaciones.',
      'Si la resolución está motivada y qué plazo de reclamación indica.',
      'Cómo afecta a tu contrato: desde la Ley 2/2025, la incapacidad permanente ya no extingue el contrato automáticamente, y tienes diez días naturales desde la notificación para comunicar por escrito si quieres mantener la relación laboral.',
    ],
    proceso: [
      'Revisamos la resolución o tu situación y la documentación disponible.',
      'Te explicamos las opciones, el trabajo y los honorarios.',
      'Preparamos la solicitud o la reclamación previa ante el INSS.',
      'Si se desestima, presentamos la demanda ante el juzgado de lo social.',
    ],
    documentacion: ['Resolución del INSS y, si lo tienes, dictamen-propuesta del Equipo de Valoración de Incapacidades (EVI)', 'Informe de vida laboral', 'Descripción de tu puesto y de tus tareas habituales', MEDICOS],
    faqs: [
      { q: '¿Qué grados de incapacidad permanente existen?', a: 'Parcial, total, absoluta y gran incapacidad (artículo 194 de la Ley General de la Seguridad Social). El grado depende de cómo afectan tus limitaciones a tu profesión habitual o a cualquier trabajo.' },
      { q: 'Me han denegado la incapacidad. ¿Puedo reclamar?', a: 'Cabe reclamación previa ante el INSS, con carácter general en el plazo de treinta días desde la notificación (artículo 71 de la Ley Reguladora de la Jurisdicción Social), y después demanda. Comprueba el plazo que indica tu resolución y no esperes para revisarla.' },
      { q: '¿Tengo que enviar mis informes médicos por el formulario?', a: 'No. No los incluyas en el formulario ni en el mensaje. Si hacen falta, te los pediremos por un canal seguro.' },
    ],
    fuentes: [
      { label: 'Ley General de la Seguridad Social, art. 194 (grados de incapacidad permanente)', href: `${BOE_LGSS}#a194` },
      { label: 'Estatuto de los Trabajadores, art. 49.1.n) (extinción por incapacidad permanente)', href: `${BOE_ET}#a49` },
    ],
  },
  {
    id: 'laboral-altas',
    area: 'laboral',
    nombre: 'Altas médicas y prestaciones',
    resumen: 'Disconformidad con un alta médica, prestaciones por incapacidad temporal y su efecto sobre el contrato.',
    problemaLaboral: 'incapacidad',
    revision: 'revisado',
    alcance: 'La incapacidad permanente tiene su propio servicio. Las deudas y cotizaciones de la Seguridad Social se tratan en Hacienda y Seguridad Social.',
    revisamos: [
      'La fecha del alta y quién la ha emitido: servicio público de salud, INSS o mutua.',
      'Si cabe manifestar disconformidad o reclamar, y en qué plazo, que suele ser muy breve.',
      'Qué ocurre con tu puesto y tu salario mientras se resuelve: salvo en los supuestos en que la disconformidad prorroga la baja, el alta obliga a reincorporarte al trabajo aunque la impugnes.',
      'Las prestaciones afectadas y si se han calculado bien.',
    ],
    documentacion: ['Parte o resolución de alta', 'Comunicaciones de la mutua o del INSS', 'Nóminas recientes', MEDICOS],
  },
  {
    id: 'laboral-accidentes',
    area: 'laboral',
    nombre: 'Accidentes laborales y responsabilidad empresarial',
    resumen: 'Accidentes de trabajo y enfermedades profesionales: calificación, prestaciones, recargo e indemnización por daños.',
    cta: 'Consultar mi accidente laboral',
    pagina: '/accidente-laboral/',
    problemaLaboral: 'accidente',
    revision: 'revisado',
    seo: {
      title: 'Abogado de accidentes laborales',
      h1: 'Accidente laboral: prestaciones, recargo e indemnización',
      description: 'Has sufrido un accidente de trabajo o una enfermedad profesional. Revisamos la calificación, las prestaciones y la responsabilidad de la empresa.',
    },
    problema: 'Has sufrido un accidente en el trabajo o de camino a él, o una enfermedad causada por tu trabajo, y no sabes qué te corresponde ni quién debe responder.',
    destinatario: 'Personas trabajadoras accidentadas y sus familias.',
    revisamos: [
      'Si lo ocurrido se ha calificado como accidente de trabajo o enfermedad profesional, o debería haberse calificado así.',
      'Las prestaciones que corresponden y si se han reconocido correctamente.',
      'Si hubo falta de medidas de seguridad que permita pedir el recargo de las prestaciones, de entre el 30 % y el 50 %.',
      'Si cabe reclamar una indemnización por los daños y perjuicios que las prestaciones no cubren.',
    ],
    proceso: [
      'Revisamos lo ocurrido, la calificación y las prestaciones.',
      'Te explicamos las vías posibles, el trabajo y los honorarios.',
      'Iniciamos las reclamaciones ante la Seguridad Social, la mutua o la empresa.',
      'Si es necesario, acudimos al juzgado de lo social.',
    ],
    documentacion: ['Parte de accidente de trabajo, si se emitió', 'Datos de testigos y fotografías del lugar, si los hay', 'Resoluciones de la mutua o del INSS', 'Nóminas anteriores al accidente', MEDICOS],
    faqs: [
      { q: '¿Qué es el recargo de prestaciones?', a: 'Si el accidente de trabajo o la enfermedad profesional se debe a la falta de medidas de seguridad, las prestaciones económicas se incrementan entre un 30 % y un 50 %, según la gravedad de la falta, a cargo de la empresa (artículo 164 de la Ley General de la Seguridad Social).' },
      { q: '¿Un accidente de camino al trabajo es accidente laboral?', a: 'El accidente al ir o volver del trabajo («in itinere») puede tener la consideración de accidente de trabajo. Depende del trayecto y de las circunstancias.' },
      { q: 'Además de las prestaciones, ¿puedo pedir una indemnización?', a: 'En algunos casos sí, por los daños y perjuicios que las prestaciones no cubren. Hay que estudiar la responsabilidad de la empresa y los daños sufridos.' },
    ],
    fuentes: [
      { label: 'Ley General de la Seguridad Social, art. 156 (concepto de accidente de trabajo)', href: `${BOE_LGSS}#a156` },
      { label: 'Ley General de la Seguridad Social, art. 164 (recargo de prestaciones)', href: `${BOE_LGSS}#a164` },
    ],
  },
  {
    id: 'laboral-acoso',
    area: 'laboral',
    nombre: 'Acoso y vulneración de derechos',
    resumen: 'Acoso laboral, discriminación y vulneración de derechos fundamentales en el trabajo: medidas, reclamación y, en su caso, extinción del contrato.',
    problemaLaboral: 'acoso',
    revision: 'revisado',
    revisamos: [
      'Los hechos, desde cuándo ocurren y qué pruebas existen.',
      'Si la empresa conocía la situación y qué medidas tomó o debió tomar.',
      'Las vías posibles: denuncia interna, Inspección de Trabajo, demanda de tutela de derechos fundamentales o extinción del contrato.',
      'Antes de dejar de ir al trabajo: salvo que el juzgado acuerde medidas cautelares, en la extinción del contrato por incumplimiento de la empresa normalmente hay que seguir trabajando mientras se tramita.',
    ],
    documentacion: ['Comunicaciones, correos o mensajes relacionados', 'Datos de posibles testigos', 'Denuncias internas y respuestas de la empresa'],
  },
  {
    id: 'laboral-condiciones',
    area: 'laboral',
    nombre: 'Modificaciones de condiciones y conflictos laborales',
    resumen: 'Cambios de horario, turnos, funciones o salario, y extinción del contrato por incumplimientos graves de la empresa.',
    articulos: ['baja-laboral-de-larga-duracion-como-dejar-tu-empresa-con-indemnizacion-y-derecho-a-paro'],
    problemaLaboral: 'condiciones',
    revision: 'revisado',
    revisamos: [
      'Si el cambio es una modificación sustancial de condiciones y si se ha seguido el procedimiento.',
      'Las opciones: aceptar, impugnar o, si el cambio te perjudica y afecta a jornada, horario, turnos, salario o funciones, extinguir el contrato con una indemnización de veinte días por año, con un máximo de nueve meses (artículo 41.3 del Estatuto de los Trabajadores). Si la empresa no ha seguido el procedimiento y el cambio menoscaba tu dignidad, puede caber la extinción del artículo 50, con la indemnización del despido improcedente.',
      'Las fechas: la impugnación de una modificación sustancial caduca a los veinte días hábiles desde su notificación. No exige conciliación previa, por lo que la demanda debe presentarse dentro de ese plazo.',
    ],
    documentacion: ['Comunicación escrita del cambio', 'Contrato y nóminas', 'Comunicaciones con la empresa'],
    fuentes: [
      { label: 'Estatuto de los Trabajadores, art. 41 (modificación sustancial de condiciones)', href: `${BOE_ET}#a41` },
      { label: 'Estatuto de los Trabajadores, art. 50 (extinción por voluntad del trabajador)', href: `${BOE_ET}#a50` },
    ],
  },

  // Mercantil y sociedades -------------------------------------------------------------------
  { id: 'mercantil-constitucion', area: 'mercantil', nombre: 'Constitución de sociedades', resumen: 'Asesoramiento sobre la forma jurídica más adecuada para tu actividad.' },
  { id: 'mercantil-pactos-socios', area: 'mercantil', nombre: 'Estatutos, pactos de socios y contratos internos', resumen: 'Redacción y revisión de estatutos, pactos de socios, acuerdos de confidencialidad y otros contratos internos.' },
  { id: 'mercantil-conflictos-socios', area: 'mercantil', preguntaMinima: { label: '¿Qué participación tienes?', opciones: ['Mayoritaria', 'Al 50 %', 'Minoritaria', 'No soy socio (administrador u otro)'] }, nombre: 'Conflictos societarios', resumen: 'Impugnación de acuerdos y defensa de socios minoritarios.', articulos: ['problemas-con-mi-socio-que-hacer-cuando-una-empresa-al-50-se-convierte-en-un-conflicto'], cta: 'Consultar un conflicto con mi socio' },
  { id: 'mercantil-reestructuraciones', area: 'mercantil', nombre: 'Reestructuraciones empresariales', resumen: 'Ampliaciones de capital y compraventa de participaciones.' },
  { id: 'mercantil-contratos', area: 'mercantil', nombre: 'Contratos mercantiles nacionales e internacionales' },
  {
    id: 'mercantil-reclamaciones',
    area: 'mercantil',
    nombre: 'Reclamaciones entre empresas',
    resumen: 'Facturas impagadas e incumplimientos de contrato con clientes, proveedores o socios comerciales.',
    alcance: 'Los portes y servicios de transporte impagados se tratan en Transporte y logística, con su propia vía de reclamación.',
    revision: 'revisado',
    preguntaMinima: { label: '¿Quién reclama?', opciones: ['Mi empresa reclama a otra', 'Reclaman a mi empresa'] },
    revisamos: [
      'El contrato, los pedidos, las facturas y las comunicaciones que acreditan la deuda o el incumplimiento.',
      'Si la reclamación es de transporte: en ese caso se trata en su área, porque tiene reglas propias.',
      'La vía más adecuada: negociación o requerimiento fehaciente, que sirve como el intento de solución extrajudicial (MASC) exigido antes de demandar, y después procedimiento monitorio, juicio cambiario o demanda.',
      'Si reclaman a tu empresa: si la deuda existe, si ha prescrito y cómo responder al requerimiento o a la demanda.',
    ],
    documentacion: ['Contrato o condiciones pactadas', 'Pedidos, albaranes y facturas', 'Comunicaciones con la otra empresa'],
  },
  { id: 'mercantil-administradores', area: 'mercantil', nombre: 'Asesoramiento a administradores', resumen: 'Asesoramiento jurídico integral para directivos y órganos de administración.' },

  // Hacienda y Seguridad Social ---------------------------------------------------------------
  { id: 'hacienda-requerimientos', area: 'hacienda', nombre: 'Requerimientos, liquidaciones y sanciones de Hacienda', resumen: 'Requerimientos de información, justificación de ingresos y movimientos bancarios, comprobaciones de IRPF, IVA o Sociedades, propuestas de liquidación y expedientes sancionadores.', articulos: ['hacienda-me-pide-justificar-ingresos', 'has-recibido-una-carta-requerimiento-liquidacion-sancion-o-reclamacion-de-deuda-de-hacienda-o-de-la-seguridad-social'], pagina: '/abogado-hacienda-y-seguridad-social-en-valencia/', siguientePaso: { label: 'Revisar qué he recibido', href: '/abogado-hacienda-y-seguridad-social-en-valencia/#diagnostico' } },
  { id: 'hacienda-seguridad-social', area: 'hacienda', nombre: 'Deudas, apremios y embargos de la Seguridad Social', resumen: 'Reclamaciones de deuda, providencias de apremio, embargos, diferencias de cotización, actas de liquidación y cuotas de autónomos.', pagina: '/abogado-hacienda-y-seguridad-social-en-valencia/', siguientePaso: { label: 'Revisar qué he recibido', href: '/abogado-hacienda-y-seguridad-social-en-valencia/#diagnostico' } },
  { id: 'hacienda-derivacion', area: 'hacienda', nombre: 'Derivación de responsabilidad al administrador', resumen: 'Alegaciones y recursos frente a expedientes que trasladan al administrador las deudas de su empresa.', pagina: '/abogado-hacienda-y-seguridad-social-en-valencia/' },
  { id: 'hacienda-devoluciones', area: 'hacienda', nombre: 'Devolución de ingresos indebidos', resumen: 'Reclamación de cantidades pagadas indebidamente a Hacienda o a la Seguridad Social.', articulos: ['reclamar-devolucion-impuesto-de-matriculacion'] },

  // Civil, herencias y vivienda ---------------------------------------------------------------
  { id: 'civil-reclamaciones', area: 'civil', nombre: 'Reclamaciones de cantidad', preguntaMinima: { label: '¿Con quién es el problema?', opciones: ['Una empresa o un banco', 'Un particular', 'Un profesional o autónomo'] } },
  { id: 'civil-responsabilidad', area: 'civil', nombre: 'Responsabilidad civil', preguntaMinima: { label: '¿Con quién es el problema?', opciones: ['Una empresa o un banco', 'Un particular', 'Un profesional o autónomo'] } },
  { id: 'civil-contratos', area: 'civil', nombre: 'Contratos civiles y privados', preguntaMinima: { label: '¿Con quién es el problema?', opciones: ['Una empresa o un banco', 'Un particular', 'Un profesional o autónomo'] } },
  { id: 'civil-herencias', area: 'civil', nombre: 'Herencias, testamentos y sucesiones', articulos: ['herencia-que-hacer'], cta: 'Consultar una herencia', preguntaMinima: { label: '¿Hay testamento?', opciones: ['Sí', 'No', 'No lo sé'] } },
  { id: 'civil-vivienda', area: 'civil', nombre: 'Vivienda, alquileres, desahucios y conflictos vecinales', preguntaMinima: { label: '¿Cuál es tu posición?', opciones: ['Propietario o arrendador', 'Inquilino', 'Comprador o vendedor', 'Vecino o comunidad de propietarios'] }, articulos: ['demanda-contrato-alquiler-que-hacer', 'ocupacion-alquiler-valencia', 'nuevo-decreto-2026-desahucio', 'registro-alquiler-turistico-2026'], cta: 'Consultar un problema de vivienda' },
  { id: 'civil-casacion', area: 'civil', nombre: 'Recursos ante el Tribunal Supremo', articulos: ['como-abordar-un-recurso-de-casacion-civil-y-no-fracasar-en-el-intento'] },

  // Familia y divorcio ---------------------------------------------------------------------------
  { id: 'familia-asesoramiento-previo', area: 'familia', nombre: 'Asesoramiento previo', resumen: 'Antes de tomar cualquier decisión, tanto si estás dudando como si ya lo tienes claro.' },
  { id: 'familia-convenio', area: 'familia', nombre: 'Convenios reguladores', resumen: 'Redacción y negociación.' },
  { id: 'familia-divorcio', area: 'familia', nombre: 'Divorcios y separaciones', resumen: 'De mutuo acuerdo y contenciosos.', pagina: '/abogado-divorcio-horta-nord-valencia/', siguientePaso: { label: 'Comprobar si mi divorcio entra en el precio cerrado', href: '/abogado-divorcio-horta-nord-valencia/#comprobar' } },
  { id: 'familia-custodia', area: 'familia', nombre: 'Custodia, visitas y pensiones', articulos: ['gastos-ordinarios-y-extraordinarios-hijos-divorcio'], preguntaMinima: { label: '¿Hay ya una sentencia o un convenio?', opciones: ['Sí', 'No', 'No lo sé'] } },
  { id: 'familia-modificacion-medidas', area: 'familia', nombre: 'Modificación de medidas y ejecución de sentencias', pagina: '/abogado-divorcio-horta-nord-valencia/' },
  { id: 'familia-patrimonio', area: 'familia', nombre: 'Protección del patrimonio familiar', articulos: ['reservas-empresa-gananciales-divorcio-tribunal-supremo'] },
  { id: 'familia-filiacion', area: 'familia', nombre: 'Filiación y reconocimiento de la maternidad o paternidad', articulos: ['puede-mi-pareja-ser-reconocida-legalmente-como-madre-en-espana-si-mi-hijo-ha-nacido-en-el-extranjero'] },

  // Arte y patrimonio ------------------------------------------------------------------------
  { id: 'arte-valoracion', area: 'arte', nombre: 'Valoración legal de obras y antigüedades', resumen: 'En herencias, compraventas o procesos de separación.' },
  { id: 'arte-compra', area: 'arte', nombre: 'Compra de arte', resumen: 'En galerías, ferias o adquisiciones internacionales, cuidando autenticidad, procedencia y condiciones legales.' },
  { id: 'arte-cesion', area: 'arte', nombre: 'Contratos de cesión', resumen: 'Compraventa, depósito o reproducción de obras.' },
  { id: 'arte-herencias', area: 'arte', nombre: 'Herencias con patrimonio artístico o documental' },
  { id: 'arte-derechos', area: 'arte', nombre: 'Defensa de derechos', resumen: 'De artistas, coleccionistas y propietarios frente a terceros.' },
  { id: 'arte-museos', area: 'arte', nombre: 'Relación con museos', resumen: 'Fundaciones, comisarios y casas de subastas.' },
  { id: 'arte-atribucion', area: 'arte', nombre: 'Atribución, conservación y exportación de obra' },

  // Penal (#32) -------------------------------------------------------------------------------
  // Texto redactado a partir de la Constitución, la LECrim, el Código Penal y el Reglamento General de Circulación
  // (versiones consolidadas del BOE consultadas el 24/10/2026). Revisado el 26/10/2026, incluida la LO 1/2026
  // de multirreincidencia: indexable y en el sitemap.
  {
    id: 'penal-detenido',
    area: 'penal',
    nombre: 'Asistencia al detenido',
    resumen: 'Detención propia o de un familiar: derechos, abogado de confianza, declaración y puesta a disposición judicial.',
    cta: 'Consultar una detención',
    pagina: '/asistencia-al-detenido/',
    revision: 'revisado',
    indexable: true,
    seo: {
      title: 'Abogado para un detenido en Valencia: derechos y primeros pasos',
      h1: 'Asistencia al detenido: derechos y primeros pasos',
      description: 'Te han detenido o han detenido a un familiar. Qué derechos tiene la persona detenida, cuánto puede durar la detención y cómo designar un abogado de confianza.',
    },
    problema: 'Te han detenido, o han detenido a alguien de tu familia, y necesitas saber qué derechos tiene, qué va a pasar y cómo designar un abogado.',
    destinatario: 'Personas detenidas y familiares que quieren designar un abogado de confianza.',
    revisamos: [
      'Dónde está la persona detenida, desde cuándo y por qué hechos, en la medida en que se conozcan.',
      'Que se le hayan comunicado sus derechos por escrito y en un idioma que comprenda.',
      'Si conviene declarar o no hacerlo hasta conocer las actuaciones, algo que se decide con el abogado.',
      'La puesta en libertad o a disposición judicial y, si procede, el procedimiento de habeas corpus.',
    ],
    proceso: [
      'Nos cuentas, por teléfono o con la solicitud de llamada, dónde está la persona detenida y qué sabes.',
      'Te explicamos si podemos asumir la asistencia y en qué condiciones, sujeto a disponibilidad.',
      'Si la persona detenida nos designa, el abogado se entrevista con ella y la asiste en su declaración.',
      'Preparamos la comparecencia ante el juzgado y los pasos siguientes.',
    ],
    urgencia: [
      'La detención no puede durar más del tiempo estrictamente necesario ni, como máximo, setenta y dos horas. Hay reglas especiales para menores de edad y para algunos delitos graves.',
      'La persona detenida puede designar un abogado de confianza; si no lo hace, se le asigna uno de oficio, salvo en los supuestos excepcionales de incomunicación.',
      'Lo que se declare en dependencias policiales puede condicionar el resto del procedimiento.',
    ],
    documentacion: ['Nombre completo de la persona detenida', 'Lugar de la detención y dependencia policial, si se conoce', 'Hora aproximada de la detención', 'Cualquier citación o documento que se haya entregado'],
    faqs: [
      { q: '¿Qué derechos tiene una persona detenida?', a: 'Entre otros, a guardar silencio o declarar solo ante el juez, a no declarar contra sí misma, a designar abogado y ser asistida sin demora injustificada, a acceder a los elementos esenciales para impugnar la detención, a comunicar la detención a un familiar, a un intérprete gratuito si no entiende el idioma y a ser reconocida por un médico (artículo 520 de la Ley de Enjuiciamiento Criminal).' },
      { q: '¿Cuánto tiempo puede durar la detención?', a: 'El tiempo estrictamente necesario para las averiguaciones y, como máximo, setenta y dos horas; después, la persona debe ser puesta en libertad o a disposición judicial (artículo 17.2 de la Constitución).' },
      { q: '¿Puede la familia elegir el abogado?', a: 'La familia puede contactar con un abogado y facilitarle los datos, pero la designación corresponde a la persona detenida. Te explicamos cómo hacerlo en tu caso.' },
      { q: '¿Qué es el habeas corpus?', a: 'Un procedimiento para que un juez revise de inmediato una detención que se considera ilegal. Pueden pedirlo la persona privada de libertad, su familia cercana, su abogado, el Ministerio Fiscal o el Defensor del Pueblo, y, desde que acuerda iniciarlo, el juez debe resolver en un plazo de veinticuatro horas (artículos 6 y 7 de la Ley Orgánica 6/1984).' },
    ],
    relacionados: ['penal-citacion', 'penal-seguridad-vial'],
    fuentes: [
      { label: 'Constitución Española, art. 17 (libertad y detención)', href: `${BOE_CE}#a17` },
      { label: 'Ley de Enjuiciamiento Criminal, art. 520 (derechos de la persona detenida)', href: `${BOE_LECRIM}#a520` },
      { label: 'Ley Orgánica 6/1984, reguladora del procedimiento de habeas corpus', href: BOE_HABEAS },
    ],
  },
  {
    id: 'penal-citacion',
    area: 'penal',
    nombre: 'Citaciones y juicios rápidos',
    resumen: 'Citación como investigado, juicio rápido ante el juzgado de guardia o juicio por delito leve.',
    cta: 'Revisar mi citación',
    pagina: '/citacion-juzgado-juicio-rapido/',
    revision: 'revisado',
    indexable: true,
    seo: {
      title: 'Citación del juzgado o juicio rápido: qué hacer y cómo preparar la defensa',
      h1: 'Me han citado al juzgado: citaciones y juicios rápidos',
      description: 'Has recibido una citación como investigado o para un juicio rápido o por delito leve. Revisamos la citación, la fecha y las opciones de defensa antes de que comparezcas.',
    },
    problema: 'Has recibido una citación del juzgado o de la policía, como investigado o para un juicio, y no sabes qué significa ni cómo prepararte.',
    destinatario: 'Personas citadas como investigadas, para un juicio rápido o para un juicio por delito leve, y también denunciantes y perjudicados.',
    revisamos: [
      'Qué tipo de citación es, quién la emite, en qué calidad se te cita y para qué fecha.',
      'Si se trata de un juicio rápido, de diligencias previas o de un juicio por delito leve, porque cada uno tiene reglas distintas.',
      'Si la conformidad es posible y conveniente, o si conviene ir a juicio y defender tu posición.',
      'Qué pruebas, testigos o documentos conviene llevar.',
    ],
    proceso: [
      'Revisamos la citación y lo que sabes de los hechos.',
      'Te explicamos las opciones, el trabajo necesario y los honorarios.',
      'Si nos encargas el asunto, accedemos a las actuaciones y preparamos la comparecencia.',
      'Te acompañamos ante el juzgado y en los pasos siguientes.',
    ],
    urgencia: [
      'En los juicios rápidos, la citación ante el juzgado de guardia suele ser para muy pocos días después.',
      'La conformidad ante el juzgado de guardia, cuando procede, se presta en ese momento.',
      'Si no puedes acudir en la fecha, hay que comunicarlo y justificarlo antes.',
    ],
    documentacion: ['La citación recibida (cédula o diligencia)', 'Atestado o denuncia, si te lo han entregado', 'Datos de testigos y pruebas que tengas', 'Resoluciones anteriores del mismo asunto'],
    faqs: [
      { q: '¿Qué es un juicio rápido?', a: 'Un procedimiento para delitos castigados con prisión de hasta cinco años, u otras penas de hasta diez años, que empieza con un atestado policial y la detención o citación ante el juzgado de guardia, en los casos que prevé el artículo 795 de la Ley de Enjuiciamiento Criminal.' },
      { q: '¿Qué supone conformarse en el juzgado de guardia?', a: 'Si se cumplen los requisitos del artículo 801 de la Ley de Enjuiciamiento Criminal (entre otros, que el delito tenga una pena de hasta tres años de prisión y que la pena pedida no supere ese límite), se dicta sentencia de conformidad con la pena solicitada reducida en un tercio. Es una decisión con consecuencias: conviene tomarla con un abogado y conociendo las actuaciones.' },
      { q: '¿Necesito abogado para un juicio por delito leve?', a: 'No siempre es obligatorio: la citación informa de que puedes acudir asistido de abogado si lo deseas. Si el delito leve lleva pena de multa con un máximo de seis meses o más, se aplican las reglas generales de defensa (artículo 967 de la Ley de Enjuiciamiento Criminal).' },
      { q: '¿Y si me citan como investigado?', a: 'Ser investigado no significa que se te acuse: es la condición que permite ejercer el derecho de defensa desde el principio. Tienes derecho a no declarar y, si declaras ante el juez, lo harás siempre asistido de abogado.' },
    ],
    relacionados: ['penal-detenido', 'penal-seguridad-vial', 'penal-lesiones'],
    fuentes: [
      { label: 'Ley de Enjuiciamiento Criminal, art. 795 (ámbito del juicio rápido)', href: `${BOE_LECRIM}#a795` },
      { label: 'Ley de Enjuiciamiento Criminal, art. 801 (conformidad ante el juzgado de guardia)', href: `${BOE_LECRIM}#a801` },
      { label: 'Ley de Enjuiciamiento Criminal, art. 967 (juicio por delito leve)', href: `${BOE_LECRIM}#a967` },
    ],
  },
  {
    id: 'penal-seguridad-vial',
    area: 'penal',
    nombre: 'Alcoholemia y seguridad vial',
    resumen: 'Alcoholemias, conducción sin permiso, exceso de velocidad grave, negativa a las pruebas y accidentes.',
    cta: 'Consultar mi caso de tráfico',
    imagen: 'penal-seguridad-vial',
    pagina: '/alcoholemia-y-seguridad-vial/',
    revision: 'revisado',
    indexable: true,
    seo: {
      title: 'Abogado de alcoholemia y delitos de tráfico en Valencia',
      h1: 'Alcoholemia y delitos contra la seguridad vial',
      description: 'Te han hecho una prueba de alcoholemia o te han citado por un delito de tráfico. Diferencia entre sanción administrativa y delito, juicio rápido y retirada del permiso.',
    },
    problema: 'Has dado positivo en un control de alcoholemia o drogas, te han parado por velocidad, conducías sin permiso o has tenido un accidente, y te han citado al juzgado.',
    destinatario: 'Conductores citados por un delito contra la seguridad vial, también profesionales del transporte.',
    revisamos: [
      'Si los hechos son una infracción administrativa o un delito: no todo positivo es delito.',
      'Cómo se hicieron las pruebas: el etilómetro, las dos mediciones y la información que se te dio.',
      'Las consecuencias para tu permiso de conducir y, si conduces por trabajo, para tu actividad.',
      'Si conviene la conformidad en el juicio rápido o ir a juicio y defender tu posición.',
    ],
    proceso: [
      'Revisamos la citación, el atestado y los tiques de las pruebas.',
      'Te explicamos las opciones, el trabajo y los honorarios.',
      'Preparamos la comparecencia ante el juzgado de guardia o el juicio.',
      'Te orientamos sobre el permiso y los pasos posteriores.',
    ],
    urgencia: [
      'Con frecuencia, estos casos se tramitan como juicio rápido (artículo 795 de la Ley de Enjuiciamiento Criminal), con citación ante el juzgado de guardia en pocos días.',
      'La pena incluye siempre la privación del derecho a conducir, de más de uno y hasta cuatro años en los supuestos del artículo 379.',
      'Si la privación supera dos años, el permiso pierde su vigencia y hay que obtenerlo de nuevo (artículo 47 del Código Penal).',
    ],
    documentacion: ['Citación judicial', 'Copia del atestado o de las diligencias que te entregaron', 'Tiques del etilómetro', 'Permiso de conducir', 'Si conduces por trabajo, contrato o actividad'],
    faqs: [
      { q: '¿Cuándo es delito una alcoholemia?', a: 'Es delito conducir bajo la influencia del alcohol o las drogas y, en todo caso, con una tasa de alcohol en aire espirado superior a 0,60 mg/l o en sangre superior a 1,2 g/l (artículo 379.2 del Código Penal). Por debajo de esa tasa puede ser también delito si hay influencia en la conducción, o infracción administrativa.' },
      { q: '¿Cuáles son los límites administrativos?', a: 'Con carácter general, 0,25 mg/l en aire espirado (0,5 g/l en sangre). Para conductores profesionales de determinados vehículos y durante los dos primeros años de permiso, 0,15 mg/l (0,3 g/l en sangre), según el artículo 20 del Reglamento General de Circulación.' },
      { q: '¿Qué pasa si me niego a hacer la prueba?', a: 'Negarse a las pruebas legalmente establecidas cuando lo requiere un agente es un delito propio (artículo 383 del Código Penal), con pena de prisión de seis meses a un año y privación del derecho a conducir de más de uno y hasta cuatro años.' },
      { q: '¿Y el exceso de velocidad?', a: 'Es delito superar en más de 60 km/h la velocidad permitida en vía urbana, o en más de 80 km/h en vía interurbana (artículo 379.1 del Código Penal).' },
    ],
    relacionados: ['penal-citacion', 'penal-lesiones'],
    fuentes: [
      { label: 'Código Penal, art. 379 (velocidad, alcohol y drogas)', href: `${BOE_CP}#a379` },
      { label: 'Código Penal, art. 383 (negativa a las pruebas)', href: `${BOE_CP}#a383` },
      { label: 'Reglamento General de Circulación, art. 20 (tasas de alcohol)', href: `${BOE_RGC}#a20` },
    ],
  },
  {
    id: 'penal-lesiones',
    area: 'penal',
    nombre: 'Lesiones y agresiones',
    resumen: 'Peleas, agresiones y lesiones, como persona denunciada o como víctima que quiere denunciar.',
    cta: 'Consultar unas lesiones',
    imagen: 'penal-lesiones',
    pagina: '/lesiones-y-agresiones/',
    revision: 'revisado',
    indexable: true,
    seo: {
      title: 'Abogado de lesiones y agresiones en Valencia: denuncia y defensa',
      h1: 'Lesiones y agresiones: denuncia y defensa',
      description: 'Una pelea, una agresión o unas lesiones. Te explicamos qué distingue un delito de lesiones de un delito leve, qué hacer si quieres denunciar y cómo preparar la defensa.',
    },
    problema: 'Has sufrido una agresión y quieres denunciar, o te han denunciado por una pelea o por unas lesiones.',
    destinatario: 'Víctimas de una agresión y personas denunciadas o citadas por lesiones.',
    revisamos: [
      'Qué ocurrió, quién lo vio y qué pruebas existen: partes médicos, imágenes, mensajes o testigos.',
      'Si las lesiones necesitaron tratamiento médico o quirúrgico además de la primera asistencia: de eso depende en gran parte la calificación.',
      'Si la persona agredida puede reclamar una indemnización por las lesiones y los daños.',
      'Si hay una relación familiar o de pareja, que cambia el procedimiento y las medidas posibles.',
    ],
    proceso: [
      'Revisamos los partes médicos, la denuncia o la citación.',
      'Te explicamos las opciones, el trabajo y los honorarios.',
      'Presentamos la denuncia o preparamos la defensa.',
      'Te acompañamos en las declaraciones y en el juicio.',
    ],
    urgencia: [
      'Si has sufrido una agresión, acude primero a un centro sanitario: el parte médico es una prueba importante.',
      'Algunas lesiones leves solo se persiguen mediante denuncia de la persona agraviada.',
      'Las imágenes de cámaras se conservan poco tiempo (por lo general, como máximo un mes; artículo 22.3 de la Ley Orgánica 3/2018): si existen, conviene identificarlas cuanto antes.',
    ],
    documentacion: ['Partes médicos y de urgencias', { label: 'Informes médicos posteriores (no los envíes por el formulario)', sensible: true }, 'Denuncia o citación', 'Fotografías, mensajes o vídeos', 'Datos de testigos'],
    faqs: [
      { q: '¿Cuándo son delito unas lesiones?', a: 'Cuando la lesión necesita objetivamente, además de una primera asistencia, tratamiento médico o quirúrgico; la simple vigilancia o seguimiento no se considera tratamiento (artículo 147.1 del Código Penal). Las de menor entidad son delito leve, y también lo es golpear o maltratar de obra sin causar lesión (artículo 147.2 y 3).' },
      { q: '¿Necesito denunciar para que se investigue?', a: 'En los delitos leves de lesiones del artículo 147.2 y 3, sí: solo se persiguen mediante denuncia de la persona agraviada o de su representante legal (artículo 147.4 del Código Penal). Si los hechos se producen en la pareja o en el ámbito familiar, se aplican otros preceptos (artículo 153 del Código Penal) y no hace falta la denuncia de la víctima para investigarlos.' },
      { q: '¿Puedo reclamar una indemnización?', a: 'La responsabilidad civil derivada del delito se puede reclamar en el propio procedimiento penal. Depende de las lesiones, del tiempo de curación y de las secuelas, y conviene valorarla con los informes médicos.' },
      { q: '¿Y si la agresión es de mi pareja o expareja?', a: 'La violencia en la pareja o en la familia tiene un tratamiento específico. Si estás en peligro, llama al 112. Para orientación especializada, el 016 atiende de forma gratuita a víctimas de violencia contra las mujeres.' },
    ],
    relacionados: ['penal-citacion', 'penal-detenido'],
    fuentes: [{ label: 'Código Penal, art. 147 (lesiones)', href: `${BOE_CP}#a147` }],
  },
  {
    id: 'penal-hurto-robo',
    area: 'penal',
    nombre: 'Hurto y robo',
    resumen: 'Defensa en causas por hurto o robo, y denuncia si eres la persona perjudicada.',
    cta: 'Consultar un hurto o un robo',
    imagen: 'penal-hurtos',
    pagina: '/hurto-y-robo/',
    revision: 'revisado',
    indexable: true,
    seo: {
      title: 'Abogado de hurto y robo en Valencia: diferencias y defensa',
      h1: 'Hurto y robo: diferencias, penas y defensa',
      description: 'Te acusan de un hurto o de un robo, o lo has sufrido. Qué los diferencia, qué importa la cuantía de 400 euros y cómo se tramita el procedimiento.',
    },
    problema: 'Te han detenido o citado por un hurto o un robo, o has sufrido uno y quieres saber cómo actuar.',
    destinatario: 'Personas investigadas por hurto o robo, y personas o comercios perjudicados.',
    revisamos: [
      'Si los hechos son hurto, robo con fuerza o robo con violencia o intimidación: las penas son muy distintas.',
      'El valor de lo sustraído, que separa el delito leve de hurto del delito menos grave.',
      'Si hay antecedentes que puedan agravar la pena.',
      'Las pruebas: grabaciones, testigos, el atestado y la recuperación de los objetos.',
    ],
    proceso: [
      'Revisamos la citación o el atestado y lo que sabes de los hechos.',
      'Te explicamos las opciones, el trabajo y los honorarios.',
      'Preparamos la defensa o la denuncia y la reclamación de los daños.',
      'Te acompañamos ante el juzgado.',
    ],
    urgencia: [
      'Muchos casos se tramitan como juicio rápido o como juicio por delito leve, con fechas muy próximas.',
      'Si eres la persona perjudicada, conserva tiques, facturas y grabaciones para acreditar el valor y los hechos.',
    ],
    documentacion: ['Citación o atestado', 'Denuncia presentada, si eres la persona perjudicada', 'Facturas o justificantes del valor de lo sustraído', 'Grabaciones o datos de testigos'],
    faqs: [
      { q: '¿Qué diferencia hay entre hurto y robo?', a: 'En el hurto se toma, con ánimo de lucro, una cosa mueble ajena sin la voluntad de su dueño y sin fuerza ni violencia. En el robo se emplea fuerza en las cosas para acceder al lugar donde están, o violencia o intimidación sobre las personas (artículos 234 y 237 del Código Penal). El robo no tiene umbral de 400 euros: es delito cualquiera que sea el valor.' },
      { q: '¿Qué importancia tienen los 400 euros?', a: 'Si lo sustraído supera 400 euros, el hurto se castiga con prisión de seis a dieciocho meses; si no los supera, con multa de uno a tres meses, salvo que concurra alguna circunstancia del artículo 235 (por ejemplo, desde abril de 2026, que lo sustraído sea un teléfono móvil u otro dispositivo con datos personales). Además, si la persona ya ha sido condenada por al menos tres delitos de la misma naturaleza, uno de ellos leve, se aplica la pena de prisión aunque no se superen los 400 euros (artículo 234.2 del Código Penal, reformado por la Ley Orgánica 1/2026).' },
      { q: '¿Qué penas tiene el robo?', a: 'El robo con fuerza en las cosas, de uno a tres años de prisión (artículo 240); el robo con violencia o intimidación, de dos a cinco años, y más si se comete en casa habitada (artículo 242 del Código Penal).' },
    ],
    relacionados: ['penal-citacion', 'penal-detenido'],
    fuentes: [
      { label: 'Código Penal, art. 234 (hurto)', href: `${BOE_CP}#a234` },
      { label: 'Código Penal, art. 237 (robo)', href: `${BOE_CP}#a237` },
      { label: 'Código Penal, art. 240 (robo con fuerza en las cosas)', href: `${BOE_CP}#a240` },
      { label: 'Código Penal, art. 242 (robo con violencia o intimidación)', href: `${BOE_CP}#a242` },
      { label: 'Código Penal, art. 235 (hurto agravado)', href: `${BOE_CP}#a235` },
      { label: 'Ley Orgánica 1/2026, de 8 de abril, de multirreincidencia', href: 'https://www.boe.es/boe/dias/2026/04/09/pdfs/BOE-A-2026-7966.pdf' },
    ],
  },
  {
    id: 'penal-estafas',
    area: 'penal',
    nombre: 'Estafas',
    resumen: 'Estafas y fraudes, también por internet o con tarjeta: denuncia de la víctima y defensa de la persona investigada.',
    cta: 'Consultar una estafa',
    imagen: 'penal-estafas',
    pagina: '/estafas/',
    revision: 'revisado',
    indexable: true,
    seo: {
      title: 'Abogado de estafas en Valencia: denunciar un fraude o defenderte',
      h1: 'Estafas y fraudes: denunciar o defenderte',
      description: 'Has sufrido una estafa, también por internet o con tu tarjeta, o te investigan por una. Qué es una estafa, qué pruebas conservar y cómo se tramita la denuncia.',
    },
    problema: 'Te han engañado para que pagues, transfieras dinero o entregues algo, o han usado tu tarjeta o tus datos. O te investigan por una estafa.',
    destinatario: 'Víctimas de estafas y fraudes, particulares y empresas, y personas investigadas por estafa.',
    revisamos: [
      'Cómo se produjo el engaño y si encaja en la estafa o en otra figura, como un incumplimiento contractual.',
      'El importe y el rastro del dinero: transferencias, cuentas de destino, pagos con tarjeta.',
      'Las pruebas que hay que conservar: mensajes, correos, anuncios, justificantes.',
      'Si cabe reclamar al banco o a la plataforma, además de la vía penal.',
    ],
    proceso: [
      'Revisamos lo ocurrido y la documentación.',
      'Te explicamos las opciones, el trabajo y los honorarios.',
      'Presentamos la denuncia o la querella, o preparamos la defensa.',
      'Seguimos el procedimiento y la reclamación del dinero.',
    ],
    urgencia: [
      'Si acabas de detectar un cargo o una transferencia que no reconoces, avisa a tu banco de inmediato.',
      'Conserva los mensajes, correos y capturas tal como están: no los borres ni reenvíes solo una parte.',
      'Cuanto antes se denuncia, más posibilidades hay de seguir el rastro del dinero.',
    ],
    documentacion: ['Justificantes de pagos o transferencias', 'Mensajes, correos, anuncios o capturas', 'Denuncia presentada, si existe', 'Comunicaciones con el banco o la plataforma', 'Citación, si te investigan'],
    faqs: [
      { q: '¿Qué es exactamente una estafa?', a: 'Utilizar un engaño bastante para producir error en otra persona e inducirla a realizar un acto de disposición en perjuicio propio o ajeno, con ánimo de lucro (artículo 248 del Código Penal). Se castiga con prisión de seis meses a tres años; si la cuantía no supera 400 euros, con multa de uno a tres meses, salvo que concurran las circunstancias del artículo 250. Desde abril de 2026, si la persona ya ha sido condenada por al menos tres estafas, una de ellas leve, se aplica la pena de prisión aunque no se superen los 400 euros (Ley Orgánica 1/2026).' },
      { q: '¿Y los fraudes por internet o con tarjeta?', a: 'También son estafa la manipulación informática para conseguir una transferencia no consentida y el uso de tarjetas o de sus datos para operar en perjuicio de su titular (artículo 249 del Código Penal).' },
      { q: '¿Todo impago es una estafa?', a: 'No. Que alguien no pague o no cumpla un contrato no es, por sí solo, una estafa: hace falta un engaño previo y bastante. Muchos casos se resuelven mejor por la vía civil, y te lo diremos si es así.' },
    ],
    relacionados: ['penal-citacion'],
    fuentes: [
      { label: 'Código Penal, art. 248 (estafa)', href: `${BOE_CP}#a248` },
      { label: 'Código Penal, art. 249 (otras modalidades de estafa)', href: `${BOE_CP}#a249` },
      { label: 'Ley Orgánica 1/2026, de 8 de abril, de multirreincidencia', href: 'https://www.boe.es/boe/dias/2026/04/09/pdfs/BOE-A-2026-7966.pdf' },
    ],
  },
  {
    id: 'penal-violencia-amenazas',
    area: 'penal',
    nombre: 'Amenazas, coacciones y violencia en el entorno familiar',
    resumen: 'Orientación y asistencia a víctimas y a personas denunciadas, con la discreción que exige cada caso.',
    cta: 'Consultar con discreción',
    revision: 'revisado',
    revisamos: [
      'Qué ha ocurrido, desde cuándo y si existe un riesgo actual.',
      'Qué pruebas hay: mensajes, testigos, partes médicos o denuncias anteriores.',
      'Si hay medidas de protección vigentes, o si conviene solicitarlas.',
      'El canal de contacto seguro: si otra persona puede ver tus mensajes o tu teléfono, indícalo.',
    ],
    alcance: 'Si estás en peligro, llama al 112. El 016 ofrece información y asesoramiento gratuitos a víctimas de violencia contra las mujeres. Las víctimas de violencia de género tienen derecho a asistencia jurídica gratuita especializada, con independencia de sus recursos (artículo 2.g de la Ley 1/1996). Antes de aceptar un asunto revisamos que no exista un conflicto de intereses.',
  },
];

export const servicioPorId = (id: string) => servicios.find((s) => s.id === id);
export const serviciosDe = (area: ServicioArea) => servicios.filter((s) => s.area === area);

/** Enlace de consulta con el servicio preseleccionado (el formulario permite cambiarlo). */
export const enlaceConsulta = (s: Pick<Servicio, 'id'>) => `/contacto/?servicio=${encodeURIComponent(s.id)}`;
/** Servicios que citan un artículo: el artículo enlaza al servicio que corresponde */
export const serviciosConArticulo = (slug: string) => servicios.filter((s) => s.articulos?.includes(slug));
