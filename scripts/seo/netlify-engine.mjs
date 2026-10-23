// Resolución de URLs con el motor de redirecciones oficial de Netlify (@netlify/redirect-matcher,
// el mismo que usa `netlify dev`, compilado a WebAssembly). Sirve para contrastar la simulación
// de redirects-lib.mjs: si las dos no coinciden, la validación falla.
import { join } from 'node:path';
import { parseAllRedirects } from '@netlify/redirect-parser';
import { createMatcher } from '@netlify/redirect-matcher';
import { servesFile } from './redirects-lib.mjs';

// Mismo ajuste de formato que hace netlify-cli (src/utils/redirects.ts) antes de crear el matcher
const normalize = ({ conditions: { country, language, role, ...conditions }, from, query, signed, ...r }) => ({
  ...r,
  origin: from,
  params: query,
  conditions: { ...conditions, ...(role && { Role: role }), ...(country && { Country: country }), ...(language && { Language: language }) },
  ...(signed && { sign: { jwt_secret: signed } }),
});

export async function createEngine(dir, netlifyToml) {
  const { redirects, errors } = await parseAllRedirects({
    redirectsFiles: [join(dir, '_redirects')],
    netlifyConfigPath: netlifyToml,
    minimal: false,
    configRedirects: [],
  });
  const matcher = await createMatcher(redirects.map(normalize));
  return {
    parseErrors: [...errors.map((e) => e.message), ...matcher.parseErrors.map((e) => e.message)],
    rules: matcher.rulesCount,
    /** Igual que resolve(): sigue las redirecciones y respeta que un archivo existente tapa las reglas no forzadas. */
    resolve(files, url, maxHops = 5) {
      const hops = [];
      let current = url;
      for (let n = 0; n <= maxHops; n++) {
        const u = new URL(current, 'https://praetoriaabogados.es');
        const path = decodeURIComponent(u.pathname);
        const m = matcher.match({ scheme: 'https', host: 'praetoriaabogados.es', path, query: u.search.slice(1), headers: {}, cookies: {} });
        const exists = servesFile(files, u.pathname);
        if (m?.type === 'match' && (m.force || !exists) && m.status >= 300 && m.status < 400) {
          if (hops.some((h) => h.to === m.to)) return { status: 'bucle', final: m.to, hops };
          hops.push({ status: m.status, to: m.to });
          current = m.to;
          continue;
        }
        if (exists) {
          const last = u.pathname.split('/').pop();
          if (!u.pathname.endsWith('/') && !last.includes('.') && !files.has(u.pathname) && !files.has(u.pathname + '.html')) {
            hops.push({ status: 301, to: u.pathname + '/', reason: 'barra final' });
            current = u.pathname + '/';
            continue;
          }
          return { status: 200, final: decodeURI(u.pathname), hops };
        }
        return { status: m?.type === 'match' ? m.status : 404, final: decodeURI(u.pathname), hops };
      }
      return { status: 'cadena', final: current, hops };
    },
    close: () => matcher.close(),
  };
}
