// Versión Markdown de las páginas públicas. Llegan aquí por la reescritura de next.config.ts cuando la petición
// lleva Accept: text/markdown.
import { markdownDe } from '@/lib/agentes/contenido';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ ruta?: string[] }> }) {
  const { ruta = [] } = await params;
  const md = markdownDe(ruta);
  return new Response(md ?? '# Página no encontrada\n\nConsulta el índice en https://praetoriaabogados.es/llms.txt\n', {
    status: md ? 200 : 404,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      // La URL es la misma que la del HTML y la CDN de Hostinger no respeta siempre Vary: si guardara esta respuesta,
      // la serviría a los navegadores. Por eso nunca se almacena.
      'Cache-Control': 'no-store',
      Vary: 'Accept',
      // Para buscadores, la versión buena de cada página es el HTML
      'X-Robots-Tag': 'noindex',
    },
  });
}
