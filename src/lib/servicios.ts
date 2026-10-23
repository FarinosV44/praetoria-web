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
  /** Documentación orientativa: se pide después por canal seguro, nunca en el formulario público.
   *  Un documento `sensible` (p. ej. informes médicos) solo se pedirá por el futuro portal, nunca por la web pública. */
  documentacion?: Documento[];
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
  /** Laboral: tipo de problema que se preelige en el formulario */
  problemaLaboral?: ProblemaLaboral;
  /** Qué no incluye o dónde se trata (para delimitar servicios que se solapan) */
  alcance?: string;
  /** Estado de revisión jurídica del texto ampliado por el despacho. Sin revisar no debería publicarse (ver docs/SERVICIOS.md) */
  revision?: 'pendiente' | 'revisado';
  /** Título y descripción SEO de la página propia */
  seo?: { title: string; description: string; h1: string };
};

/** Modelo de checklist documental, reutilizable por el futuro portal de clientes (#7). Sin almacenamiento en la web pública. */
export type Documento = string | { label: string; sensible: true };
export const docLabel = (d: Documento) => (typeof d === 'string' ? d : d.label);
export const docSensible = (d: Documento) => typeof d !== 'string';

/** Tipos de problema del formulario laboral (#7) */
export const PROBLEMAS_LABORALES = [
  { id: 'despido', label: 'Despido o fin de contrato' },
  { id: 'cantidades', label: 'Salarios, horas o finiquito' },
  { id: 'incapacidad', label: 'Baja, alta médica o incapacidad' },
  { id: 'accidente', label: 'Accidente laboral o enfermedad profesional' },
  { id: 'acoso', label: 'Acoso o vulneración de derechos' },
  { id: 'condiciones', label: 'Cambios en mis condiciones u otro conflicto' },
] as const;
export type ProblemaLaboral = (typeof PROBLEMAS_LABORALES)[number]['id'];

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
const BOE_ET = 'https://www.boe.es/eli/es/rdlg/2015/10/23/2/con';
const BOE_LGSS = 'https://www.boe.es/eli/es/rdlg/2015/10/30/8/con';
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

  // Laboral (#7). Atiende Lucía López. Textos ampliados pendientes de revisión del despacho. -------------
  {
    id: 'laboral-despidos',
    area: 'laboral',
    nombre: 'Despidos e impugnación',
    resumen: 'Revisión de la carta y del finiquito, conciliación e impugnación del despido disciplinario, objetivo o colectivo.',
    articulos: ['despido-valencia-que-hacer'],
    cta: 'Solicitar revisión de mi despido',
    pagina: '/impugnar-despido/',
    problemaLaboral: 'despido',
    revision: 'pendiente',
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
      'Las fechas: la acción contra el despido caduca a los veinte días hábiles, aunque la solicitud de conciliación interrumpe el plazo.',
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
      { q: '¿Cuánto tiempo tengo para reclamar?', a: 'La acción contra el despido caduca a los veinte días hábiles siguientes (artículo 59.3 del Estatuto de los Trabajadores), y la solicitud de conciliación interrumpe ese plazo. El cómputo depende de tu caso: consulta cuanto antes. La web no lo calcula de forma automática.' },
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
    cta: 'Reclamar lo que me deben',
    pagina: '/reclamar-salarios-y-finiquito/',
    problemaLaboral: 'cantidades',
    revision: 'pendiente',
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
    revision: 'pendiente',
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
      'Cómo afecta a tu contrato y a tu relación con la empresa.',
    ],
    proceso: [
      'Revisamos la resolución o tu situación y la documentación disponible.',
      'Te explicamos las opciones, el trabajo y los honorarios.',
      'Preparamos la solicitud o la reclamación previa ante la Seguridad Social.',
      'Si se desestima, presentamos la demanda ante el juzgado de lo social.',
    ],
    documentacion: ['Resolución del INSS o de la mutua, si la hay', 'Informe de vida laboral', 'Descripción de tu puesto y de tus tareas habituales', MEDICOS],
    faqs: [
      { q: '¿Qué grados de incapacidad permanente existen?', a: 'Parcial, total, absoluta y gran incapacidad (artículo 194 de la Ley General de la Seguridad Social). El grado depende de cómo afectan tus limitaciones a tu profesión habitual o a cualquier trabajo.' },
      { q: 'Me han denegado la incapacidad. ¿Puedo reclamar?', a: 'Normalmente cabe una reclamación previa y, después, la demanda. El plazo figura en la propia resolución: no esperes para revisarla.' },
      { q: '¿Tengo que enviar mis informes médicos por el formulario?', a: 'No. No los incluyas en el formulario ni en el mensaje. Si hacen falta, te los pediremos por un canal seguro.' },
    ],
    fuentes: [{ label: 'Ley General de la Seguridad Social, art. 194 (grados de incapacidad permanente)', href: `${BOE_LGSS}#a194` }],
  },
  {
    id: 'laboral-altas',
    area: 'laboral',
    nombre: 'Altas médicas y prestaciones',
    resumen: 'Disconformidad con un alta médica, prestaciones por incapacidad temporal y su efecto sobre el contrato.',
    problemaLaboral: 'incapacidad',
    revision: 'pendiente',
    alcance: 'La incapacidad permanente tiene su propio servicio. Las deudas y cotizaciones de la Seguridad Social se tratan en Hacienda y Seguridad Social.',
    revisamos: [
      'La fecha del alta y quién la ha emitido: servicio público de salud, INSS o mutua.',
      'Si cabe manifestar disconformidad o reclamar, y en qué plazo, que suele ser muy breve.',
      'Qué ocurre con tu puesto y tu salario mientras se resuelve.',
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
    revision: 'pendiente',
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
    documentacion: ['Parte de accidente de trabajo, si se emitió', 'Datos de testigos y fotografías del lugar, si las hay', 'Resoluciones de la mutua o del INSS', 'Nóminas anteriores al accidente', MEDICOS],
    faqs: [
      { q: '¿Qué es el recargo de prestaciones?', a: 'Si el accidente se debe a la falta de medidas de seguridad, las prestaciones se incrementan entre un 30 % y un 50 % a cargo de la empresa (artículo 164 de la Ley General de la Seguridad Social).' },
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
    revision: 'pendiente',
    revisamos: [
      'Los hechos, desde cuándo ocurren y qué pruebas existen.',
      'Si la empresa conocía la situación y qué medidas tomó o debió tomar.',
      'Las vías posibles: denuncia interna, Inspección de Trabajo, demanda de tutela de derechos fundamentales o extinción del contrato.',
    ],
    documentacion: ['Comunicaciones, correos o mensajes relacionados', 'Datos de posibles testigos', 'Denuncias internas y respuestas de la empresa'],
  },
  {
    id: 'laboral-condiciones',
    area: 'laboral',
    nombre: 'Modificaciones de condiciones y conflictos laborales',
    resumen: 'Cambios de horario, funciones, salario o centro de trabajo, y extinción del contrato por incumplimientos graves de la empresa.',
    articulos: ['baja-laboral-de-larga-duracion-como-dejar-tu-empresa-con-indemnizacion-y-derecho-a-paro'],
    problemaLaboral: 'condiciones',
    revision: 'pendiente',
    revisamos: [
      'Si el cambio es una modificación sustancial de condiciones y si se ha seguido el procedimiento.',
      'Las opciones: aceptar, impugnar o, en algunos casos, extinguir el contrato con indemnización.',
      'Las fechas: la impugnación de una modificación sustancial también caduca a los veinte días hábiles.',
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
