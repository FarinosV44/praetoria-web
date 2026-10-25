// Dónde están las funciones de recepción (/api/consulta, /api/llamada).
// En Netlify, en el mismo sitio (ruta relativa). En la web publicada en Hostinger desde GitHub, en el
// sitio de Netlify: el build lo indica con NEXT_PUBLIC_API_ORIGIN (scripts/build.mjs).
export const API_ORIGIN = process.env.NEXT_PUBLIC_API_ORIGIN ?? '';
export const apiUrl = (ruta: '/api/consulta' | '/api/llamada') => `${API_ORIGIN}${ruta}`;
