// Ajustes sobre la exportación estática de Next (out/) antes de publicar.
//   node scripts/postbuild.mjs out
// 1. Quita /404/ y /_not-found/: Next los genera como páginas y Netlify las serviría con 200 (soft 404).
//    Netlify usa out/404.html para cualquier ruta inexistente, con código 404.
// 2. Idioma del documento: los artículos en francés y árabe declaran su idioma en <article lang>;
//    aquí se lleva también a <html lang> y a og:locale (el layout raíz de Next es común a todas).
//    La dirección (rtl) se queda en el <article>: la cabecera y el pie siguen en español (lang="es").
//    No se añade hreflang: no hay traducciones equivalentes de una misma página.
// 3. Aplica la indexabilidad (scripts/seo/indexabilidad.mjs): noindex salvo SITE_INDEXABLE=true.
import { rmSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const dir = process.argv[2] || 'out';
for (const d of ['404', '_not-found']) {
  const p = join(dir, d);
  if (existsSync(p)) rmSync(p, { recursive: true });
}
if (!existsSync(join(dir, '404.html'))) throw new Error('Falta out/404.html');

const LOCALES = { es: 'es_ES', fr: 'fr_FR', ar: 'ar_AR' };
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
let langs = 0;
for (const f of walk(dir).filter((x) => x.endsWith('.html'))) {
  const html = readFileSync(f, 'utf8');
  const m = html.match(/<article lang="([a-z]{2})"/);
  if (!m || m[1] === 'es') continue;
  const lang = m[1];
  if (!LOCALES[lang]) throw new Error(`Idioma sin locale definido: ${lang} en ${f}`);
  const out = html
    .replace(/<html lang="es"/, `<html lang="${lang}"`)
    .replace('<meta property="og:locale" content="es_ES"/>', `<meta property="og:locale" content="${LOCALES[lang]}"/>`);
  if (out === html) throw new Error(`No se pudo ajustar el idioma de ${f}`);
  writeFileSync(f, out);
  langs++;
}
console.log(`Idioma del documento ajustado en ${langs} páginas (francés/árabe).`);
execFileSync(process.execPath, [new URL('./seo/indexabilidad.mjs', import.meta.url).pathname, dir], { stdio: 'inherit' });
