// Herramientas para agentes: las mismas en el servidor MCP (/mcp/) y en WebMCP (navegador).
// Todas son de solo lectura y sobre contenido ya publicado. Ninguna envía formularios ni acepta datos de un caso.
export const herramientas = [
  {
    name: 'buscar_contenido',
    description: 'Busca en las páginas publicadas de Praetoria Abogados (servicios, áreas de práctica y guías jurídicas, en español). Devuelve títulos, resúmenes y rutas; para el texto completo, usa leer_pagina.',
    inputSchema: {
      type: 'object',
      properties: {
        consulta: { type: 'string', description: 'Palabras que buscar, por ejemplo «despido improcedente» o «DECA subcontratación».', minLength: 2, maxLength: 200 },
        limite: { type: 'integer', description: 'Número máximo de resultados (1 a 10; por defecto, 5).', minimum: 1, maximum: 10 },
      },
      required: ['consulta'],
      additionalProperties: false,
    },
  },
  {
    name: 'leer_pagina',
    description: 'Devuelve en Markdown el texto de una página publicada de praetoriaabogados.es. Es información general, no asesoramiento sobre un caso concreto.',
    inputSchema: {
      type: 'object',
      properties: {
        ruta: { type: 'string', description: 'Ruta de la página, por ejemplo «/contacto/», o su URL completa.', maxLength: 300 },
      },
      required: ['ruta'],
      additionalProperties: false,
    },
  },
  {
    name: 'datos_contacto',
    description: 'Devuelve los datos públicos de contacto del despacho: teléfono, correo, dirección y las páginas para pedir una consulta o una llamada.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
] as const;
