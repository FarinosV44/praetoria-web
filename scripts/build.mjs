// Build de la aplicación (web pública y portal): next build + idioma e indexabilidad + copia estática para comprobaciones.
//
// Indexabilidad (SITE_INDEXABLE):
// - Si no viene fijada, es el build de Hostinger: indexable. Un sitio de pruebas debe fijar SITE_INDEXABLE=false.
// - La CI y los builds locales de prueba la fijan: SITE_INDEXABLE=false npm run build.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const env = { ...process.env };
if (env.SITE_INDEXABLE === undefined) {
  env.SITE_INDEXABLE = 'true';
  env.NEXT_BUILD_CPUS ??= '1';
  console.log('Build para Hostinger: indexable');
}
// Webpack en lugar de Turbopack: en Hostinger, Turbopack no puede arrancar su proceso auxiliar de PostCSS
// («node process exited before we could connect to it»). Mismo resultado, sin ese proceso.
const ruta = (r) => fileURLToPath(new URL(r, import.meta.url));
const run = (script, ...args) => execFileSync(process.execPath, [script, ...args], { stdio: 'inherit', env });

run(ruta('../node_modules/next/dist/bin/next'), 'build', '--webpack');
// Primero la copia para las comprobaciones; luego los ajustes de HTML, también en lo que sirve el servidor.
run(ruta('./qa/materializar.mjs'), 'out');
for (const dir of ['out', '.next/server/app', '.next/standalone/.next/server/app']) {
  if (existsSync(dir)) run(ruta('./postbuild.mjs'), dir);
}
// Versión Markdown de las páginas públicas, sobre el HTML ya definitivo
run(ruta('./agentes/generar.mjs'), 'out', '.next/markdown');
