// Recepción de los formularios: en el propio dominio (src/app/api/consulta y llamada, src/lib/recepcion.ts).
export const apiUrl = (ruta: '/api/consulta' | '/api/llamada') => `${ruta}/` as const;
