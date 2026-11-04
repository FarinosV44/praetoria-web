// Comprueba contra un servidor en marcha cada redirección de public/_redirects: estado y destino, con y sin barra final.
// Sirve para el build local y para el sitio de pruebas antes de cambiar la web real.
//   node scripts/qa/comprobar-redirecciones.mjs http://localhost:3000
import { readFileSync } from 'node:fs';

const base = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
const fallos = [];
let comprobadas = 0;

async function comprobar(ruta, estado, destino) {
  const r = await fetch(base + ruta, { redirect: 'manual' });
  const donde = (r.headers.get('location') ?? '').replace(base, '').replace('https://praetoriaabogados.es', '');
  comprobadas++;
  if (r.status !== estado || decodeURI(donde) !== decodeURI(destino)) fallos.push(`${ruta} → ${r.status} ${donde} (esperado ${estado} ${destino})`);
}

for (const linea of readFileSync('public/_redirects', 'utf8').split('\n')) {
  const t = linea.trim();
  if (!t || t.startsWith('#')) continue;
  const [desde, hacia, codigo = '301'] = t.split(/\s+/);
  const estado = Number(codigo.replace('!', ''));
  const dest = hacia.replace('https://praetoriaabogados.es', '');
  if (desde.includes(':') || desde.includes('%')) continue;
  if (desde.endsWith('/*')) {
    const raiz = desde.slice(0, -2);
    if (dest.includes(':splat')) await comprobar(`${raiz}/prueba/`, estado, dest.replace(':splat', 'prueba/'));
    else await comprobar(`${raiz}/prueba/`, estado, dest);
    continue;
  }
  const sinBarra = desde.replace(/\/$/, '');
  // Un archivo no lleva barra final: la regla se aplica directamente
  if (sinBarra.split('/').pop().includes('.')) {
    await comprobar(sinBarra, estado, dest);
    continue;
  }
  await comprobar(`${sinBarra}/`, estado, dest);
  // Sin barra, primero la redirección de Next a la URL con barra (308), que luego aplica la regla
  await comprobar(sinBarra, 308, `${sinBarra}/`);
}

console.log(`Redirecciones comprobadas: ${comprobadas}. Fallos: ${fallos.length}.`);
for (const f of fallos.slice(0, 40)) console.log('  ' + f);
process.exit(fallos.length ? 1 : 0);
