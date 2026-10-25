// Listas de opciones por área que usa el formulario (en el navegador). Separadas de servicios.ts para no cargar sus textos.

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
