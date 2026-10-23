// Prueba HTTP real de la matriz de URLs contra un despliegue (deploy preview de Netlify).
//   node scripts/seo/probar-preview.mjs https://deploy-preview-12--praetoria.netlify.app
//
// Para cada URL antigua del inventario comprueba el primer salto (código y Location) y el destino final,
// y lo compara con lo que predice la simulación local. También revisa la cabecera X-Robots-Tag,
// el 404 real y la caché de /media/. No cambia nada: solo hace peticiones GET.
import { readFileSync } from 'node:fs';

const base = process.argv[2]?.replace(/\/$/, '');
if (!base) {
  console.error('Uso: node scripts/seo/probar-preview.mjs <url-del-preview>');
  process.exit(2);
}
const csv = readFileSync(new URL('../../docs/seo/inventario-urls.csv', import.meta.url), 'utf8');
const parseCsv = (text) => {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  const [head, ...rest] = rows;
  return rest.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
};
const rows = parseCsv(csv).filter((r) => r.ruta_antigua);

let fail = 0;
const report = (ok, msg) => {
  if (!ok) fail++;
  console.log(`${ok ? 'ok  ' : 'FALLA'} ${msg}`);
};

for (const r of rows) {
  const url = base + encodeURI(r.ruta_antigua);
  let res = await fetch(url, { redirect: 'manual' });
  const first = res.status;
  const loc = res.headers.get('location');
  let final = r.ruta_antigua;
  let hops = 0;
  while (res.status >= 300 && res.status < 400 && hops < 5) {
    const next = new URL(res.headers.get('location'), base);
    final = decodeURI(next.pathname);
    res = await fetch(next, { redirect: 'manual' });
    hops++;
  }
  const expStatus = r.estado_nuevo.endsWith('200') ? 200 : Number(r.estado_nuevo);
  const ok = res.status === expStatus && (expStatus !== 200 || final === r.url_nueva);
  report(ok, `${r.ruta_antigua} -> ${first}${loc ? ' ' + loc : ''} ... ${res.status} ${final} (esperado ${r.estado_nuevo} ${r.url_nueva})`);
}

const home = await fetch(base + '/');
report(/noindex/i.test(home.headers.get('x-robots-tag') || ''), `X-Robots-Tag en preview: ${home.headers.get('x-robots-tag')}`);
const nf = await fetch(base + '/esta-url-no-existe-' + Date.now() + '/');
report(nf.status === 404, `Página inexistente devuelve ${nf.status} (esperado 404)`);
const media = await fetch(base + '/media/despacho-salas-reuniones.webp', { method: 'HEAD' });
console.log(`info  Cache-Control de /media/: ${media.headers.get('cache-control')}`);

console.log(`\n${rows.length} URLs probadas · ${fail} fallos`);
process.exit(fail ? 1 : 0);
