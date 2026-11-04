// Copia la parte pública ya prerenderizada (.next/server/app) a out/ con la forma de una web estática:
// /ruta/index.html, 404.html, _next/static y public. Las comprobaciones de calidad y SEO y las pruebas en
// navegador (scripts/qa, scripts/seo, tests/e2e) trabajan sobre esa copia. No se publica: en producción sirve Next.
//   node scripts/qa/materializar.mjs out
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

const dir = process.argv[2] || 'out';
const APP = '.next/server/app';
// Lo que pertenece al portal no forma parte de la web pública.
const PORTAL = /^(admin|portal|entrar|crear-cuenta|bienvenida|invitacion|recuperar|restablecer|documentacion|documentos|expedientes|inicio|mensajes|perfil|solicitudes|api)(\/|\.|$)/;
const PUBLICO_SOLO_PORTAL = ['iconos', 'sw.js', 'logo-praetoria.png'];

rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const escribir = (destino, contenido) => {
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, contenido);
};

let paginas = 0;
for (const f of walk(APP)) {
  const r = relative(APP, f).split(sep).join('/');
  if (PORTAL.test(r) || r.startsWith('(')) continue;
  if (r === '_not-found.html') escribir(join(dir, '404.html'), readFileSync(f));
  else if (r === '_global-error.html' || r === '_not-found.body') continue;
  else if (r === 'index.html') escribir(join(dir, 'index.html'), readFileSync(f));
  else if (r.endsWith('.html')) escribir(join(dir, r.slice(0, -5), 'index.html'), readFileSync(f));
  // Datos de la navegación interna de Next: sin ellos, cada enlace sería una recarga completa
  else if (r.endsWith('.rsc')) { escribir(join(dir, r === 'index.rsc' ? 'index.rsc' : join(r.slice(0, -4), 'index.rsc')), readFileSync(f)); continue; }
  else if (r.endsWith('.body')) escribir(join(dir, r.slice(0, -5)), readFileSync(f));
  else continue;
  paginas++;
}
if (!existsSync(join(dir, '404.html'))) throw new Error('Falta la página 404 en el build');
for (const e of readdirSync('public')) {
  if (!PUBLICO_SOLO_PORTAL.includes(e)) cpSync(join('public', e), join(dir, e), { recursive: true });
}
cpSync('.next/static', join(dir, '_next/static'), { recursive: true });
console.log(`Copia estática para comprobaciones en ${dir}/: ${paginas} archivos.`);
