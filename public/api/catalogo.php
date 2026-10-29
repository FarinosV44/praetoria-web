<?php
// GENERADO por scripts/formularios/catalogo.mjs a partir de src/lib/*.ts. No editar a mano.
if (!defined('PRAETORIA_FORMULARIOS')) { http_response_code(404); exit; }
return json_decode(<<<'JSON'
{
 "areas": {
  "transporte": "Transporte y logística",
  "mercantil": "Mercantil y sociedades",
  "hacienda": "Hacienda y Seguridad Social",
  "laboral": "Laboral",
  "civil": "Civil, herencias y vivienda",
  "familia": "Familia y divorcio",
  "arte": "Arte y patrimonio",
  "penal": "Penal",
  "no-se": "No sé qué área corresponde"
 },
 "preferencias": {
  "llamada": "Llamada",
  "correo": "Correo",
  "whatsapp": "WhatsApp"
 },
 "papeles": {
  "transportista": "Transportista (hago el porte)",
  "agencia": "Agencia, transitario u operador logístico",
  "cargador": "Cargador (envío la mercancía)",
  "destinatario": "Destinatario (recibo la mercancía)",
  "otro": "Otro"
 },
 "importes": {
  "hasta-3000": "Hasta 3.000 €",
  "3000-15000": "Entre 3.000 y 15.000 €",
  "mas-15000": "Más de 15.000 €",
  "no-se": "No lo sé o no aplica"
 },
 "incidencias": {
  "impago": "Porte o factura impagada",
  "mercancia": "Mercancía dañada, perdida o con retraso",
  "deca": "DeCA, documentación o contratos",
  "otra": "Otra incidencia"
 },
 "problemas": {
  "despido": "Despido o fin de contrato",
  "cantidades": "Salarios, horas o finiquito",
  "incapacidad": "Baja, alta médica o incapacidad",
  "accidente": "Accidente laboral o enfermedad profesional",
  "acoso": "Acoso o vulneración de derechos",
  "condiciones": "Cambios en mis condiciones u otro conflicto"
 },
 "representa": {
  "trabajador": "Soy la persona trabajadora",
  "empresa": "Consulto en nombre de una empresa",
  "otro": "Consulto por otra persona"
 },
 "situaciones": {
  "activo": "Sigo trabajando en la empresa",
  "baja": "Estoy de baja médica",
  "fuera": "Ya no trabajo en la empresa",
  "otra": "Otra situación"
 },
 "organismos": {
  "aeat": "Hacienda (AEAT)",
  "tgss": "Seguridad Social (TGSS)",
  "inss": "INSS",
  "no-se": "No lo sé"
 },
 "documentos": {
  "requerimiento": "Requerimiento de información o de justificación",
  "liquidacion": "Propuesta de liquidación o liquidación",
  "sancion": "Inicio de expediente sancionador o sanción",
  "apremio": "Reclamación de deuda o providencia de apremio",
  "embargo": "Diligencia de embargo",
  "derivacion": "Derivación de responsabilidad",
  "prestacion": "Resolución sobre una prestación",
  "no-se": "No lo sé"
 },
 "motivos": {
  "detencion": "Detención (propia o de un familiar)",
  "citacion": "Citación del juzgado o de la policía",
  "juicio": "Juicio o comparecencia en fecha próxima",
  "plazo": "Plazo que vence pronto (recurso, reclamación, despido…)",
  "notificacion": "Notificación o requerimiento recibido",
  "otro": "Otro asunto que no puede esperar"
 },
 "seguro": {
  "libre": "Podéis llamarme y dejar mensaje",
  "sin-mensajes": "Solo llamada: sin mensajes, SMS ni WhatsApp",
  "discreto": "Otra persona puede ver mi teléfono: llamad con discreción"
 },
 "areasConFecha": [
  "transporte",
  "laboral",
  "hacienda",
  "penal"
 ],
 "areasFechaFutura": [
  "penal"
 ],
 "areasConCuestionario": [
  "familia",
  "hacienda",
  "laboral"
 ],
 "limites": {
  "nombre": 100,
  "email": 254,
  "telefono": 20,
  "mensaje": 2000,
  "mensajeMin": 20,
  "cuestionario": 1500
 },
 "limitesLlamada": {
  "nombre": 100,
  "telefono": 20,
  "localidad": 80,
  "franja": 80,
  "descripcion": 500
 },
 "tiempoMinimoMs": 3000,
 "servicios": {
  "transporte-ordenes-carga": {
   "nombre": "Redacción y revisión de órdenes de carga",
   "area": "transporte",
   "pregunta": "",
   "opciones": []
  },
  "transporte-contratos": {
   "nombre": "Contratos de transporte y logística",
   "area": "transporte",
   "pregunta": "",
   "opciones": []
  },
  "transporte-deca-subcontratacion": {
   "nombre": "DECA y subcontratación",
   "area": "transporte",
   "pregunta": "",
   "opciones": []
  },
  "transporte-portes-impagados": {
   "nombre": "Reclamación de portes impagados",
   "area": "transporte",
   "pregunta": "",
   "opciones": []
  },
  "transporte-mercancias": {
   "nombre": "Pérdida, avería y retraso de mercancías",
   "area": "transporte",
   "pregunta": "",
   "opciones": []
  },
  "transporte-cmr-internacional": {
   "nombre": "Convenio CMR y transporte internacional",
   "area": "transporte",
   "pregunta": "",
   "opciones": []
  },
  "transporte-aseguradoras": {
   "nombre": "Reclamaciones frente a aseguradoras",
   "area": "transporte",
   "pregunta": "",
   "opciones": []
  },
  "transporte-conflictos-cadena": {
   "nombre": "Conflictos entre cargadores, agencias y transportistas",
   "area": "transporte",
   "pregunta": "",
   "opciones": []
  },
  "transporte-prevencion": {
   "nombre": "Prevención de riesgos contractuales",
   "area": "transporte",
   "pregunta": "",
   "opciones": []
  },
  "transporte-gerencia": {
   "nombre": "Apoyo jurídico para gerencia",
   "area": "transporte",
   "pregunta": "",
   "opciones": []
  },
  "laboral-despidos": {
   "nombre": "Despidos e impugnación",
   "area": "laboral",
   "pregunta": "",
   "opciones": []
  },
  "laboral-cantidades": {
   "nombre": "Salarios y finiquitos",
   "area": "laboral",
   "pregunta": "",
   "opciones": []
  },
  "laboral-incapacidad": {
   "nombre": "Incapacidad permanente",
   "area": "laboral",
   "pregunta": "",
   "opciones": []
  },
  "laboral-altas": {
   "nombre": "Altas médicas y prestaciones",
   "area": "laboral",
   "pregunta": "",
   "opciones": []
  },
  "laboral-accidentes": {
   "nombre": "Accidentes laborales y responsabilidad empresarial",
   "area": "laboral",
   "pregunta": "",
   "opciones": []
  },
  "laboral-acoso": {
   "nombre": "Acoso y vulneración de derechos",
   "area": "laboral",
   "pregunta": "",
   "opciones": []
  },
  "laboral-condiciones": {
   "nombre": "Modificaciones de condiciones y conflictos laborales",
   "area": "laboral",
   "pregunta": "",
   "opciones": []
  },
  "mercantil-constitucion": {
   "nombre": "Constitución de sociedades",
   "area": "mercantil",
   "pregunta": "",
   "opciones": []
  },
  "mercantil-pactos-socios": {
   "nombre": "Estatutos, pactos de socios y contratos internos",
   "area": "mercantil",
   "pregunta": "",
   "opciones": []
  },
  "mercantil-conflictos-socios": {
   "nombre": "Conflictos societarios",
   "area": "mercantil",
   "pregunta": "¿Qué participación tienes?",
   "opciones": [
    "Mayoritaria",
    "Al 50 %",
    "Minoritaria",
    "No soy socio (administrador u otro)"
   ]
  },
  "mercantil-reestructuraciones": {
   "nombre": "Reestructuraciones empresariales",
   "area": "mercantil",
   "pregunta": "",
   "opciones": []
  },
  "mercantil-contratos": {
   "nombre": "Contratos mercantiles nacionales e internacionales",
   "area": "mercantil",
   "pregunta": "",
   "opciones": []
  },
  "mercantil-reclamaciones": {
   "nombre": "Reclamaciones entre empresas",
   "area": "mercantil",
   "pregunta": "¿Quién reclama?",
   "opciones": [
    "Mi empresa reclama a otra",
    "Reclaman a mi empresa"
   ]
  },
  "mercantil-administradores": {
   "nombre": "Asesoramiento a administradores",
   "area": "mercantil",
   "pregunta": "",
   "opciones": []
  },
  "hacienda-requerimientos": {
   "nombre": "Requerimientos, liquidaciones y sanciones de Hacienda",
   "area": "hacienda",
   "pregunta": "",
   "opciones": []
  },
  "hacienda-seguridad-social": {
   "nombre": "Deudas, apremios y embargos de la Seguridad Social",
   "area": "hacienda",
   "pregunta": "",
   "opciones": []
  },
  "hacienda-derivacion": {
   "nombre": "Derivación de responsabilidad al administrador",
   "area": "hacienda",
   "pregunta": "",
   "opciones": []
  },
  "hacienda-devoluciones": {
   "nombre": "Devolución de ingresos indebidos",
   "area": "hacienda",
   "pregunta": "",
   "opciones": []
  },
  "civil-reclamaciones": {
   "nombre": "Reclamaciones de cantidad",
   "area": "civil",
   "pregunta": "¿Con quién es el problema?",
   "opciones": [
    "Una empresa o un banco",
    "Un particular",
    "Un profesional o autónomo"
   ]
  },
  "civil-responsabilidad": {
   "nombre": "Responsabilidad civil",
   "area": "civil",
   "pregunta": "¿Con quién es el problema?",
   "opciones": [
    "Una empresa o un banco",
    "Un particular",
    "Un profesional o autónomo"
   ]
  },
  "civil-contratos": {
   "nombre": "Contratos civiles y privados",
   "area": "civil",
   "pregunta": "¿Con quién es el problema?",
   "opciones": [
    "Una empresa o un banco",
    "Un particular",
    "Un profesional o autónomo"
   ]
  },
  "civil-herencias": {
   "nombre": "Herencias, testamentos y sucesiones",
   "area": "civil",
   "pregunta": "¿Hay testamento?",
   "opciones": [
    "Sí",
    "No",
    "No lo sé"
   ]
  },
  "civil-vivienda": {
   "nombre": "Vivienda, alquileres, desahucios y conflictos vecinales",
   "area": "civil",
   "pregunta": "¿Cuál es tu posición?",
   "opciones": [
    "Propietario o arrendador",
    "Inquilino",
    "Comprador o vendedor",
    "Vecino o comunidad de propietarios"
   ]
  },
  "civil-casacion": {
   "nombre": "Recursos ante el Tribunal Supremo",
   "area": "civil",
   "pregunta": "",
   "opciones": []
  },
  "familia-asesoramiento-previo": {
   "nombre": "Asesoramiento previo",
   "area": "familia",
   "pregunta": "",
   "opciones": []
  },
  "familia-convenio": {
   "nombre": "Convenios reguladores",
   "area": "familia",
   "pregunta": "",
   "opciones": []
  },
  "familia-divorcio": {
   "nombre": "Divorcios y separaciones",
   "area": "familia",
   "pregunta": "",
   "opciones": []
  },
  "familia-custodia": {
   "nombre": "Custodia, visitas y pensiones",
   "area": "familia",
   "pregunta": "¿Hay ya una sentencia o un convenio?",
   "opciones": [
    "Sí",
    "No",
    "No lo sé"
   ]
  },
  "familia-modificacion-medidas": {
   "nombre": "Modificación de medidas y ejecución de sentencias",
   "area": "familia",
   "pregunta": "",
   "opciones": []
  },
  "familia-patrimonio": {
   "nombre": "Protección del patrimonio familiar",
   "area": "familia",
   "pregunta": "",
   "opciones": []
  },
  "familia-filiacion": {
   "nombre": "Filiación y reconocimiento de la maternidad o paternidad",
   "area": "familia",
   "pregunta": "",
   "opciones": []
  },
  "arte-valoracion": {
   "nombre": "Valoración legal de obras y antigüedades",
   "area": "arte",
   "pregunta": "",
   "opciones": []
  },
  "arte-compra": {
   "nombre": "Compra de arte",
   "area": "arte",
   "pregunta": "",
   "opciones": []
  },
  "arte-cesion": {
   "nombre": "Contratos de cesión",
   "area": "arte",
   "pregunta": "",
   "opciones": []
  },
  "arte-herencias": {
   "nombre": "Herencias con patrimonio artístico o documental",
   "area": "arte",
   "pregunta": "",
   "opciones": []
  },
  "arte-derechos": {
   "nombre": "Defensa de derechos",
   "area": "arte",
   "pregunta": "",
   "opciones": []
  },
  "arte-museos": {
   "nombre": "Relación con museos",
   "area": "arte",
   "pregunta": "",
   "opciones": []
  },
  "arte-atribucion": {
   "nombre": "Atribución, conservación y exportación de obra",
   "area": "arte",
   "pregunta": "",
   "opciones": []
  },
  "penal-detenido": {
   "nombre": "Asistencia al detenido",
   "area": "penal",
   "pregunta": "",
   "opciones": []
  },
  "penal-citacion": {
   "nombre": "Citaciones y juicios rápidos",
   "area": "penal",
   "pregunta": "",
   "opciones": []
  },
  "penal-seguridad-vial": {
   "nombre": "Alcoholemia y seguridad vial",
   "area": "penal",
   "pregunta": "",
   "opciones": []
  },
  "penal-lesiones": {
   "nombre": "Lesiones y agresiones",
   "area": "penal",
   "pregunta": "",
   "opciones": []
  },
  "penal-hurto-robo": {
   "nombre": "Hurto y robo",
   "area": "penal",
   "pregunta": "",
   "opciones": []
  },
  "penal-estafas": {
   "nombre": "Estafas",
   "area": "penal",
   "pregunta": "",
   "opciones": []
  },
  "penal-violencia-amenazas": {
   "nombre": "Amenazas, coacciones y violencia en el entorno familiar",
   "area": "penal",
   "pregunta": "",
   "opciones": []
  }
 },
 "despacho": {
  "nombre": "Praetoria División Jurídica",
  "abogado": "Juan José Farinós Ibáñez",
  "telefono": "607 527 719",
  "email": "juanfarinos@icav.es",
  "dominio": "praetoriaabogados.es"
 },
 "laboral": {
  "nombre": "Lucía López",
  "telefono": "649 181 290"
 }
}
JSON, true, 512, JSON_THROW_ON_ERROR);
