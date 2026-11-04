// Sin «Disallow» en el build no indexable: Google necesita poder leer la etiqueta noindex para no indexar.
export const dynamic = 'force-static';

const INDEXABLE = 'User-agent: *\nAllow: /\n\nSitemap: https://praetoriaabogados.es/sitemap.xml\n';
const PREVIEW = '# Build no indexable (preview). En producción se publica el robots.txt con sitemap.\nUser-agent: *\nAllow: /\n';

export function GET() {
  return new Response(process.env.SITE_INDEXABLE === 'true' ? INDEXABLE : PREVIEW, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
