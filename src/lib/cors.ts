// Orígenes que pueden enviar consultas a las funciones de Netlify (/api/consulta, /api/llamada).
// La web se publica también en Hostinger (praetoriaabogados.es, desde GitHub): sus formularios envían
// a la función de Netlify, que entrega en Netlify Forms y avisa por correo como siempre.
// Sin dependencias: lo importan las funciones directamente.
export const ORIGENES_PERMITIDOS = ['https://praetoriaabogados.es', 'https://www.praetoriaabogados.es'];

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  if (!ORIGENES_PERMITIDOS.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

/** Respuesta a la petición previa (preflight) del navegador */
export const preflight = (req: Request) => new Response(null, { status: 204, headers: corsHeaders(req) });

/** Añade las cabeceras CORS a una respuesta ya construida */
export function conCors(req: Request, res: Response): Response {
  const h = corsHeaders(req);
  for (const [k, v] of Object.entries(h)) res.headers.set(k, v);
  return res;
}

/** Destino de /gracias/ sin JavaScript: vuelve a la web desde la que se envió si es un origen permitido */
export function gracias(req: Request): string {
  const origin = req.headers.get('origin') ?? '';
  return ORIGENES_PERMITIDOS.includes(origin) ? `${origin}/gracias/` : '/gracias/';
}
