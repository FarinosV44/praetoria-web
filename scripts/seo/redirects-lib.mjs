// Intérprete mínimo de las reglas de Netlify (_redirects) para poder validarlas sin desplegar.
// Reproduce lo que afecta a esta web: orden de las reglas (gana la primera), comodín final (*),
// marcadores de segmento (:nombre), barra final opcional, y que una regla NO se aplica si existe
// un archivo en esa ruta salvo que lleve "!" (forzada).
// Lo que no reproduce (y por eso sigue pendiente de comprobar en un deploy preview): condiciones por
// país/idioma/rol, reglas de proxy (200 a otro dominio) y normalización de mayúsculas.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export function parseRedirects(text) {
  const rules = [];
  text.split('\n').forEach((raw, i) => {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) return;
    const parts = line.split(/\s+/);
    const from = parts.shift();
    const query = [];
    while (parts.length && /^[^/][^=]*=/.test(parts[0]) && !/^https?:/.test(parts[0])) query.push(parts.shift());
    const to = parts.shift();
    let status = 301;
    let force = false;
    if (parts.length && /^\d{3}!?$/.test(parts[0])) {
      const s = parts.shift();
      force = s.endsWith('!');
      status = parseInt(s, 10);
    }
    if (!from || !to) throw new Error(`Línea ${i + 1} incompleta: "${raw}"`);
    rules.push({ line: i + 1, from, query, to, status, force, extra: parts });
  });
  return rules;
}

const stripSlash = (p) => (p.length > 1 ? p.replace(/\/+$/, '') : p);
const dec = (p) => {
  try {
    return decodeURI(p);
  } catch {
    return p;
  }
};

/** Devuelve los parámetros capturados si la ruta coincide con el patrón de origen. */
export function matchRule(rule, pathname) {
  // Se compara la ruta decodificada: %d8 y %D8 son el mismo carácter (pendiente confirmar en Netlify)
  const pattern = stripSlash(dec(rule.from));
  const path = stripSlash(dec(pathname));
  const pSeg = pattern.split('/');
  const uSeg = path.split('/');
  const params = {};
  for (let i = 0; i < pSeg.length; i++) {
    const p = pSeg[i];
    if (p === '*' && i === pSeg.length - 1) {
      params.splat = uSeg.slice(i).join('/');
      return params;
    }
    if (i >= uSeg.length) return null;
    if (p.startsWith(':')) {
      if (!uSeg[i]) return null;
      params[p.slice(1)] = uSeg[i];
    } else if (p !== uSeg[i]) return null;
  }
  return pSeg.length === uSeg.length ? params : null;
}

export function applyTo(rule, params) {
  let to = rule.to;
  for (const [k, v] of Object.entries(params)) to = to.replace(k === 'splat' ? ':splat' : `:${k}`, v);
  return to;
}

/** Lista de rutas servibles a partir de la carpeta generada (dist/ u out/). */
export function listOutput(dir) {
  const files = new Set();
  const walk = (d) => {
    for (const f of readdirSync(d)) {
      const full = join(d, f);
      if (statSync(full).isDirectory()) walk(full);
      else files.add('/' + full.slice(dir.length + 1).split('\\').join('/'));
    }
  };
  walk(dir);
  return files;
}

/** ¿Sirve Netlify algo en esta ruta? (con "pretty URLs": /x/ -> /x/index.html, /x -> /x.html o /x/index.html) */
export function servesFile(files, pathname) {
  const p = decodeURI(pathname.split('?')[0].split('#')[0]);
  if (files.has(p)) return true;
  const base = p.endsWith('/') ? p : p + '/';
  if (files.has(base + 'index.html')) return true;
  if (!p.endsWith('/') && files.has(p + '.html')) return true;
  return false;
}

/**
 * Simula la respuesta de Netlify para una URL: archivo existente (200), primera regla que coincide,
 * o 404. Sigue las redirecciones hasta `maxHops` para detectar cadenas y bucles.
 */
export function resolve(files, rules, url, maxHops = 5) {
  const hops = [];
  let current = url;
  for (let n = 0; n <= maxHops; n++) {
    const u = new URL(current, 'https://praetoriaabogados.es');
    const pathname = u.pathname;
    const search = u.searchParams;
    const fileExists = servesFile(files, pathname);
    let hit = null;
    for (const rule of rules) {
      if (fileExists && !rule.force) continue;
      if (rule.query.length) {
        const ok = rule.query.every((q) => {
          const [k, v] = q.split('=');
          return search.has(k) && (v.startsWith(':') || search.get(k) === v);
        });
        if (!ok) continue;
      }
      const params = matchRule(rule, pathname);
      if (params) {
        hit = { rule, to: applyTo(rule, params) };
        break;
      }
    }
    if (!hit) {
      // Netlify sirve el archivo existente; si la ruta no lleva barra y existe /ruta/index.html, añade la barra (301).
      if (fileExists) {
        if (!pathname.endsWith('/') && !pathname.split('/').pop().includes('.') && !servesFileExact(files, pathname)) {
          hops.push({ status: 301, to: pathname + '/', reason: 'barra final (Netlify pretty URLs)' });
          current = pathname + '/';
          continue;
        }
        return { status: 200, final: pathname, hops };
      }
      return { status: 404, final: pathname, hops };
    }
    if (hit.rule.status >= 300 && hit.rule.status < 400) {
      hops.push({ status: hit.rule.status, to: hit.to, line: hit.rule.line });
      if (/^https?:\/\//.test(hit.to) && !hit.to.startsWith('https://praetoriaabogados.es')) {
        return { status: hit.rule.status, final: hit.to, hops, external: true };
      }
      if (hops.filter((h) => h.to === hit.to).length > 1) return { status: 'bucle', final: hit.to, hops };
      current = hit.to;
      continue;
    }
    return { status: hit.rule.status, final: hit.to, hops, rewrite: hit.rule.status === 200 };
  }
  return { status: 'cadena', final: current, hops };
}

function servesFileExact(files, pathname) {
  return files.has(pathname) || files.has(pathname + '.html');
}

export function readRedirects(dir) {
  const f = join(dir, '_redirects');
  return existsSync(f) ? parseRedirects(readFileSync(f, 'utf8')) : [];
}
