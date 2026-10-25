// Genera out/.htaccess para servir la web en Hostinger (LiteSpeed/Apache) con el mismo comportamiento que en Netlify:
// redirecciones 301 de la migración (desde out/_redirects), www → dominio principal, 404 real y cabeceras de seguridad.
//   node scripts/hostinger/htaccess.mjs out
// Semántica de Netlify que se reproduce: una regla solo se aplica si no existe un archivo o carpeta en esa ruta
// (sin «!»); «/x/*» casa con /x, /x/ y todo lo que cuelga; «:nombre» casa con un segmento.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] || 'out';
const DOMINIO = 'praetoriaabogados.es';
const esc = (s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

export function reglas(redirects) {
  const out = [];
  for (const linea of redirects.split('\n')) {
    const t = linea.trim();
    if (!t || t.startsWith('#')) continue;
    const [desde, hacia, estado = '301'] = t.split(/\s+/);
    if (desde.includes('%')) continue; // duplicado codificado para Netlify: Apache compara la ruta ya decodificada
    if (!/^30[12]$/.test(estado.replace('!', ''))) continue;
    let patron = desde.replace(/^\//, '');
    let destino = hacia;
    const nombres = [];
    patron = patron
      .split('/')
      .map((seg) => {
        if (seg === '*') return '\u0000';
        if (seg.startsWith(':')) {
          nombres.push(seg.slice(1));
          return '([^/]+)';
        }
        return esc(seg);
      })
      .join('/');
    // «x/*» → x, x/ o x/lo-que-sea ; ruta exacta → con o sin barra final
    if (patron.endsWith('/\u0000')) patron = patron.slice(0, -2) + '(?:/.*)?';
    else patron = patron.replace(/\/$/, '') + '/?';
    nombres.forEach((n, i) => (destino = destino.replace(`:${n}`, `$${i + 1}`)));
    const forzada = estado.endsWith('!');
    out.push(
      ...(forzada ? [] : ['RewriteCond %{REQUEST_FILENAME} !-f', 'RewriteCond %{REQUEST_FILENAME} !-d']),
      `RewriteRule ^${patron}$ ${destino} [R=${estado.replace('!', '')},L,NE]`,
    );
  }
  return out;
}

const cabecera = `# GENERADO por scripts/hostinger/htaccess.mjs a partir de out/_redirects. No editar a mano.
# Web publicada en Hostinger desde GitHub (main). Mismo comportamiento que en Netlify.
Options -MultiViews -Indexes
DirectorySlash On
ErrorDocument 404 /404.html
AddDefaultCharset utf-8

<IfModule mod_headers.c>
  Header always set X-Content-Type-Options "nosniff"
  Header always set Referrer-Policy "strict-origin-when-cross-origin"
  Header always set X-Frame-Options "SAMEORIGIN"
  Header always set Permissions-Policy "camera=(), microphone=(), geolocation=()"
</IfModule>

<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType image/avif "access plus 1 day"
  ExpiresByType image/webp "access plus 1 day"
  ExpiresByType text/css "access plus 1 year"
  ExpiresByType application/javascript "access plus 1 year"
  ExpiresByType text/javascript "access plus 1 year"
</IfModule>

RewriteEngine On
# www → dominio principal (una sola versión indexable)
RewriteCond %{HTTP_HOST} ^www\\.${esc(DOMINIO)}$ [NC]
RewriteRule ^(.*)$ https://${DOMINIO}/$1 [R=301,L,NE]

# Redirecciones de la migración desde WordPress (docs/seo/inventario-urls.csv)
`;

if (import.meta.url === `file://${process.argv[1]}`) {
  const lineas = reglas(readFileSync(join(dir, '_redirects'), 'utf8'));
  writeFileSync(join(dir, '.htaccess'), cabecera + lineas.join('\n') + '\n');
  console.log(`.htaccess: ${lineas.filter((l) => l.startsWith('RewriteRule')).length} redirecciones`);
}
