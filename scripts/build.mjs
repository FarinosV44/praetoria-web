// Build de la web: next build + postbuild (out/). Lo usan Netlify, Hostinger y los builds locales.
//
// Indexabilidad (SITE_INDEXABLE):
// - Netlify la fija siempre en netlify.toml (producción true; previsualizaciones false).
// - Si no viene fijada y no es Netlify, es el build de Hostinger desde `main`: web publicada en
//   praetoriaabogados.es, indexable, y los formularios envían a las funciones de Netlify
//   (NEXT_PUBLIC_API_ORIGIN), que entregan en Netlify Forms y avisan por correo.
// - Para un build local de pruebas: SITE_INDEXABLE=false npm run build.
import { execFileSync } from 'node:child_process';
import { cpSync, rmSync } from 'node:fs';

const env = { ...process.env };
const hostinger = env.SITE_INDEXABLE === undefined && env.NETLIFY !== 'true';
if (hostinger) {
  env.SITE_INDEXABLE = 'true';
  env.NEXT_PUBLIC_API_ORIGIN ??= 'https://eclectic-sopapillas-6aabb3.netlify.app';
  console.log('Build para Hostinger: indexable, formularios hacia', env.NEXT_PUBLIC_API_ORIGIN);
}
const run = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit', env });
// Hostinger: su entorno de build hace que Turbopack falle al procesar CSS de fontsource
// con `creating new process / node process exited before we could connect`.
// Usar Webpack solo allí evita ese camino de compilación sin modificar el build de Netlify.
const nextBuildArgs = ['build', ...(hostinger ? ['--webpack'] : [])];
if (hostinger) console.log('Hostinger: compilando Next.js con Webpack (Turbopack desactivado)');
run(process.execPath, [new URL('../node_modules/next/dist/bin/next', import.meta.url).pathname, ...nextBuildArgs]);
run(process.execPath, [new URL('./postbuild.mjs', import.meta.url).pathname, 'out']);
if (hostinger) {
  run(process.execPath, [new URL('./hostinger/htaccess.mjs', import.meta.url).pathname, 'out']);
  // Copia en dist/ por si el despliegue de Hostinger sigue configurado con la carpeta de la web anterior (Astro)
  rmSync('dist', { recursive: true, force: true });
  cpSync('out', 'dist', { recursive: true });
}
