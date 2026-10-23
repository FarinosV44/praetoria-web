// Ajustes sobre la exportación estática de Next (out/) antes de publicar.
//   node scripts/postbuild.mjs out
// 1. Quita /404/ y /_not-found/: Next los genera como páginas y Netlify las serviría con 200 (soft 404).
//    Netlify usa out/404.html para cualquier ruta inexistente, con código 404.
// 2. Aplica la indexabilidad (scripts/seo/indexabilidad.mjs): noindex salvo SITE_INDEXABLE=true.
import { rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const dir = process.argv[2] || 'out';
for (const d of ['404', '_not-found']) {
  const p = join(dir, d);
  if (existsSync(p)) rmSync(p, { recursive: true });
}
if (!existsSync(join(dir, '404.html'))) throw new Error('Falta out/404.html');
execFileSync(process.execPath, [new URL('./seo/indexabilidad.mjs', import.meta.url).pathname, dir], { stdio: 'inherit' });
