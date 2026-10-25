// Accesibilidad automática (axe-core) y desbordamiento horizontal en móvil, en todas las páginas del sitemap.
//   node scripts/qa/serve.mjs out 4400 &  node scripts/qa/a11y.mjs
// Falla si hay errores graves o críticos de axe, o si alguna página se desborda a 412 px.
import { chromium, devices } from '@playwright/test';
import { readFileSync } from 'node:fs';
const axe = readFileSync('node_modules/axe-core/axe.min.js', 'utf8');
const urls = [...readFileSync('out/sitemap.xml', 'utf8').matchAll(/<loc>https:\/\/praetoriaabogados\.es([^<]*)<\/loc>/g)].map((m) => m[1]).concat(['/gracias/', '/contacto/?area=laboral', '/que-me-llame-un-abogado/?area=penal'])
  // Páginas fuera del sitemap por revisión jurídica pendiente (#32): se revisan igual
  .concat(['/abogado-penalista-valencia/', '/asistencia-al-detenido/', '/citacion-juzgado-juicio-rapido/', '/alcoholemia-y-seguridad-vial/', '/lesiones-y-agresiones/', '/hurto-y-robo/', '/estafas/']);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const res = {};
for (const dev of ['escritorio', 'movil']) {
  const ctx = await b.newContext(dev === 'movil' ? devices['Pixel 7'] : { viewport: { width: 1366, height: 900 } });
  const p = await ctx.newPage();
  for (const u of urls) {
    await p.goto('http://localhost:4400' + u, { waitUntil: 'load' });
    await p.addScriptTag({ content: axe });
    const r = await p.evaluate(async () => (await axe.run(document, { resultTypes: ['violations'] })).violations.filter((v) => ['serious', 'critical'].includes(v.impact)).map((v) => `${v.id}(${v.nodes.length}): ${v.nodes[0].target.join(' ')}`));
    for (const v of r) (res[v.split(':')[0]] ??= []).push(`${dev} ${u} ${v.split(': ')[1]}`);
    // desbordamiento horizontal en móvil
    if (dev === 'movil') { const w = await p.evaluate(() => document.documentElement.scrollWidth); if (w > 412) (res['overflow'] ??= []).push(`${u} ${w}px`); }
  }
  await ctx.close();
}
await b.close();
console.log(`${urls.length} páginas, escritorio y móvil`);
for (const [k, v] of Object.entries(res)) console.log(k, v.length, '\n  ' + v.slice(0, 6).join('\n  '));
if (Object.keys(res).length) process.exit(1);
console.log('OK: sin errores graves de accesibilidad ni desbordamiento en móvil');
