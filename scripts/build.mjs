// Build de la web: next build + postbuild (out/). Lo usan Netlify, Hostinger y los builds locales.
//
// Indexabilidad (SITE_INDEXABLE):
// - Si no viene fijada, es el build de Hostinger desde `main`: web publicada en praetoriaabogados.es e indexable.
//   Los formularios envían a /api/consulta y /api/llamada del propio dominio (public/api/*.php, docs/CONSULTAS.md).
// - La CI y los builds locales de prueba la fijan: SITE_INDEXABLE=false npm run build.
import { execFileSync } from 'node:child_process';
import { cpSync, rmSync } from 'node:fs';

const env = { ...process.env };
const hostinger = env.SITE_INDEXABLE === undefined;
if (hostinger) {
  env.SITE_INDEXABLE = 'true';
  env.NEXT_BUILD_CPUS ??= '1';
  console.log('Build para Hostinger: indexable, formularios en el propio dominio (/api/*.php)');
}
// Webpack en lugar de Turbopack: en Hostinger, Turbopack no puede arrancar su proceso auxiliar de PostCSS
// («node process exited before we could connect to it»). Mismo resultado, sin ese proceso.
const run = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit', env });
run(process.execPath, [new URL('../node_modules/next/dist/bin/next', import.meta.url).pathname, 'build', '--webpack']);
run(process.execPath, [new URL('./postbuild.mjs', import.meta.url).pathname, 'out']);
if (hostinger) {
  run(process.execPath, [new URL('./hostinger/htaccess.mjs', import.meta.url).pathname, 'out']);
  // Copia en dist/ por si el despliegue de Hostinger sigue configurado con la carpeta de la web anterior (Astro)
  rmSync('dist', { recursive: true, force: true });
  cpSync('out', 'dist', { recursive: true });
}
