// Sin «Disallow» en el build no indexable: Google necesita poder leer la etiqueta noindex para no indexar.
export const dynamic = 'force-static';

const INDEXABLE = 'User-agent: *\nContent-Signal: search=yes, ai-train=no\nAllow: /\n# Variantes del formulario con parámetros: la página canónica es /contacto/ y /que-me-llame-un-abogado/\nDisallow: /contacto/?\nDisallow: /que-me-llame-un-abogado/?\n\nSitemap: https://praetoriaabogados.es/sitemap.xml\n';
const PREVIEW = '# Build no indexable (preview). En producción se publica el robots.txt con sitemap.\nUser-agent: *\nAllow: /\n';

export function GET() {
  return new Response(process.env.SITE_INDEXABLE === 'true' ? INDEXABLE : PREVIEW, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
