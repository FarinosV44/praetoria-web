// Convierte public/_redirects (su fuente es scripts/seo/generate-redirects.mjs) en redirecciones de Next.
// Semántica que se conserva: «/x/*» casa con /x, /x/ y todo lo que cuelga; «:nombre» casa con un segmento;
// una ruta exacta casa con o sin barra final. Las reglas tapadas por una página las detecta npm run seo:check.
const especiales = /[(){}?+*!]/g;

export function aRedireccionesNext(texto) {
  const out = [];
  for (const linea of texto.split('\n')) {
    const t = linea.trim();
    if (!t || t.startsWith('#')) continue;
    const [desde, hacia, estado = '301'] = t.split(/\s+/);
    if (desde.includes('%')) continue; // duplicado codificado: Next compara la ruta ya decodificada
    const statusCode = Number(estado.replace('!', ''));
    if (statusCode !== 301 && statusCode !== 302) continue;

    const comodin = desde.endsWith('/*');
    const base = (comodin ? desde.slice(0, -2) : desde).replace(/\/$/, '');
    const segmentos = base.split('/').map((s) => (s.startsWith(':') ? s : s.replace(especiales, '\\$&').replace(/:/g, '\\:')));
    const raiz = segmentos.join('/');
    const destination = hacia.replace(/:splat\b/, ':splat*');
    const source = comodin ? `${raiz}/:splat*` : `${raiz || '/'}{/}?`;
    out.push({ source, destination, statusCode });
  }
  return out;
}
