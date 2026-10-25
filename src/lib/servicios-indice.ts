// GENERADO por scripts/servicios/matriz.mjs a partir de src/lib/servicios.ts. No editar a mano.
// Versión ligera para el navegador: el formulario y la validación solo necesitan estos campos.
import type { Servicio, ServicioArea } from './servicios.ts';

export type ServicioIndice = Pick<Servicio, 'id' | 'area' | 'nombre' | 'pagina' | 'incidencia' | 'problemaLaboral' | 'preguntaMinima'>;

export const indiceServicios: ServicioIndice[] = [
  {
    "id": "transporte-ordenes-carga",
    "area": "transporte",
    "nombre": "Redacción y revisión de órdenes de carga",
    "incidencia": "deca"
  },
  {
    "id": "transporte-contratos",
    "area": "transporte",
    "nombre": "Contratos de transporte y logística",
    "incidencia": "deca"
  },
  {
    "id": "transporte-deca-subcontratacion",
    "area": "transporte",
    "nombre": "DECA y subcontratación",
    "incidencia": "deca"
  },
  {
    "id": "transporte-portes-impagados",
    "area": "transporte",
    "nombre": "Reclamación de portes impagados",
    "pagina": "/reclamacion-portes-impagados/",
    "incidencia": "impago"
  },
  {
    "id": "transporte-mercancias",
    "area": "transporte",
    "nombre": "Pérdida, avería y retraso de mercancías",
    "incidencia": "mercancia"
  },
  {
    "id": "transporte-cmr-internacional",
    "area": "transporte",
    "nombre": "Convenio CMR y transporte internacional"
  },
  {
    "id": "transporte-aseguradoras",
    "area": "transporte",
    "nombre": "Reclamaciones frente a aseguradoras",
    "incidencia": "mercancia"
  },
  {
    "id": "transporte-conflictos-cadena",
    "area": "transporte",
    "nombre": "Conflictos entre cargadores, agencias y transportistas"
  },
  {
    "id": "transporte-prevencion",
    "area": "transporte",
    "nombre": "Prevención de riesgos contractuales"
  },
  {
    "id": "transporte-gerencia",
    "area": "transporte",
    "nombre": "Apoyo jurídico para gerencia"
  },
  {
    "id": "laboral-despidos",
    "area": "laboral",
    "nombre": "Despidos e impugnación",
    "pagina": "/impugnar-despido/",
    "problemaLaboral": "despido"
  },
  {
    "id": "laboral-cantidades",
    "area": "laboral",
    "nombre": "Salarios y finiquitos",
    "pagina": "/reclamar-salarios-y-finiquito/",
    "problemaLaboral": "cantidades"
  },
  {
    "id": "laboral-incapacidad",
    "area": "laboral",
    "nombre": "Incapacidad permanente",
    "pagina": "/incapacidad-permanente/",
    "problemaLaboral": "incapacidad"
  },
  {
    "id": "laboral-altas",
    "area": "laboral",
    "nombre": "Altas médicas y prestaciones",
    "problemaLaboral": "incapacidad"
  },
  {
    "id": "laboral-accidentes",
    "area": "laboral",
    "nombre": "Accidentes laborales y responsabilidad empresarial",
    "pagina": "/accidente-laboral/",
    "problemaLaboral": "accidente"
  },
  {
    "id": "laboral-acoso",
    "area": "laboral",
    "nombre": "Acoso y vulneración de derechos",
    "problemaLaboral": "acoso"
  },
  {
    "id": "laboral-condiciones",
    "area": "laboral",
    "nombre": "Modificaciones de condiciones y conflictos laborales",
    "problemaLaboral": "condiciones"
  },
  {
    "id": "mercantil-constitucion",
    "area": "mercantil",
    "nombre": "Constitución de sociedades"
  },
  {
    "id": "mercantil-pactos-socios",
    "area": "mercantil",
    "nombre": "Estatutos, pactos de socios y contratos internos"
  },
  {
    "id": "mercantil-conflictos-socios",
    "area": "mercantil",
    "nombre": "Conflictos societarios",
    "preguntaMinima": {
      "label": "¿Qué participación tienes?",
      "opciones": [
        "Mayoritaria",
        "Al 50 %",
        "Minoritaria",
        "No soy socio (administrador u otro)"
      ]
    }
  },
  {
    "id": "mercantil-reestructuraciones",
    "area": "mercantil",
    "nombre": "Reestructuraciones empresariales"
  },
  {
    "id": "mercantil-contratos",
    "area": "mercantil",
    "nombre": "Contratos mercantiles nacionales e internacionales"
  },
  {
    "id": "mercantil-reclamaciones",
    "area": "mercantil",
    "nombre": "Reclamaciones entre empresas",
    "preguntaMinima": {
      "label": "¿Quién reclama?",
      "opciones": [
        "Mi empresa reclama a otra",
        "Reclaman a mi empresa"
      ]
    }
  },
  {
    "id": "mercantil-administradores",
    "area": "mercantil",
    "nombre": "Asesoramiento a administradores"
  },
  {
    "id": "hacienda-requerimientos",
    "area": "hacienda",
    "nombre": "Requerimientos, liquidaciones y sanciones de Hacienda",
    "pagina": "/abogado-hacienda-y-seguridad-social-en-valencia/"
  },
  {
    "id": "hacienda-seguridad-social",
    "area": "hacienda",
    "nombre": "Deudas, apremios y embargos de la Seguridad Social",
    "pagina": "/abogado-hacienda-y-seguridad-social-en-valencia/"
  },
  {
    "id": "hacienda-derivacion",
    "area": "hacienda",
    "nombre": "Derivación de responsabilidad al administrador",
    "pagina": "/abogado-hacienda-y-seguridad-social-en-valencia/"
  },
  {
    "id": "hacienda-devoluciones",
    "area": "hacienda",
    "nombre": "Devolución de ingresos indebidos"
  },
  {
    "id": "civil-reclamaciones",
    "area": "civil",
    "nombre": "Reclamaciones de cantidad",
    "preguntaMinima": {
      "label": "¿Con quién es el problema?",
      "opciones": [
        "Una empresa o un banco",
        "Un particular",
        "Un profesional o autónomo"
      ]
    }
  },
  {
    "id": "civil-responsabilidad",
    "area": "civil",
    "nombre": "Responsabilidad civil",
    "preguntaMinima": {
      "label": "¿Con quién es el problema?",
      "opciones": [
        "Una empresa o un banco",
        "Un particular",
        "Un profesional o autónomo"
      ]
    }
  },
  {
    "id": "civil-contratos",
    "area": "civil",
    "nombre": "Contratos civiles y privados",
    "preguntaMinima": {
      "label": "¿Con quién es el problema?",
      "opciones": [
        "Una empresa o un banco",
        "Un particular",
        "Un profesional o autónomo"
      ]
    }
  },
  {
    "id": "civil-herencias",
    "area": "civil",
    "nombre": "Herencias, testamentos y sucesiones",
    "preguntaMinima": {
      "label": "¿Hay testamento?",
      "opciones": [
        "Sí",
        "No",
        "No lo sé"
      ]
    }
  },
  {
    "id": "civil-vivienda",
    "area": "civil",
    "nombre": "Vivienda, alquileres, desahucios y conflictos vecinales",
    "preguntaMinima": {
      "label": "¿Cuál es tu posición?",
      "opciones": [
        "Propietario o arrendador",
        "Inquilino",
        "Comprador o vendedor",
        "Vecino o comunidad de propietarios"
      ]
    }
  },
  {
    "id": "civil-casacion",
    "area": "civil",
    "nombre": "Recursos ante el Tribunal Supremo"
  },
  {
    "id": "familia-asesoramiento-previo",
    "area": "familia",
    "nombre": "Asesoramiento previo"
  },
  {
    "id": "familia-convenio",
    "area": "familia",
    "nombre": "Convenios reguladores"
  },
  {
    "id": "familia-divorcio",
    "area": "familia",
    "nombre": "Divorcios y separaciones",
    "pagina": "/abogado-divorcio-horta-nord-valencia/"
  },
  {
    "id": "familia-custodia",
    "area": "familia",
    "nombre": "Custodia, visitas y pensiones",
    "preguntaMinima": {
      "label": "¿Hay ya una sentencia o un convenio?",
      "opciones": [
        "Sí",
        "No",
        "No lo sé"
      ]
    }
  },
  {
    "id": "familia-modificacion-medidas",
    "area": "familia",
    "nombre": "Modificación de medidas y ejecución de sentencias",
    "pagina": "/abogado-divorcio-horta-nord-valencia/"
  },
  {
    "id": "familia-patrimonio",
    "area": "familia",
    "nombre": "Protección del patrimonio familiar"
  },
  {
    "id": "familia-filiacion",
    "area": "familia",
    "nombre": "Filiación y reconocimiento de la maternidad o paternidad"
  },
  {
    "id": "arte-valoracion",
    "area": "arte",
    "nombre": "Valoración legal de obras y antigüedades"
  },
  {
    "id": "arte-compra",
    "area": "arte",
    "nombre": "Compra de arte"
  },
  {
    "id": "arte-cesion",
    "area": "arte",
    "nombre": "Contratos de cesión"
  },
  {
    "id": "arte-herencias",
    "area": "arte",
    "nombre": "Herencias con patrimonio artístico o documental"
  },
  {
    "id": "arte-derechos",
    "area": "arte",
    "nombre": "Defensa de derechos"
  },
  {
    "id": "arte-museos",
    "area": "arte",
    "nombre": "Relación con museos"
  },
  {
    "id": "arte-atribucion",
    "area": "arte",
    "nombre": "Atribución, conservación y exportación de obra"
  },
  {
    "id": "penal-detenido",
    "area": "penal",
    "nombre": "Asistencia al detenido",
    "pagina": "/asistencia-al-detenido/"
  },
  {
    "id": "penal-citacion",
    "area": "penal",
    "nombre": "Citaciones y juicios rápidos",
    "pagina": "/citacion-juzgado-juicio-rapido/"
  },
  {
    "id": "penal-seguridad-vial",
    "area": "penal",
    "nombre": "Alcoholemia y seguridad vial",
    "pagina": "/alcoholemia-y-seguridad-vial/"
  },
  {
    "id": "penal-lesiones",
    "area": "penal",
    "nombre": "Lesiones y agresiones",
    "pagina": "/lesiones-y-agresiones/"
  },
  {
    "id": "penal-hurto-robo",
    "area": "penal",
    "nombre": "Hurto y robo",
    "pagina": "/hurto-y-robo/"
  },
  {
    "id": "penal-estafas",
    "area": "penal",
    "nombre": "Estafas",
    "pagina": "/estafas/"
  },
  {
    "id": "penal-violencia-amenazas",
    "area": "penal",
    "nombre": "Amenazas, coacciones y violencia en el entorno familiar"
  }
];

export const servicioPorId = (id: string) => indiceServicios.find((s) => s.id === id);
export const serviciosDe = (area: ServicioArea) => indiceServicios.filter((s) => s.area === area);
