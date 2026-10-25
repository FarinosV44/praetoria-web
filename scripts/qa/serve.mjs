// Servidor estático mínimo que imita a Netlify para las pruebas en navegador:
// /ruta/ -> /ruta/index.html, /ruta -> 301 a /ruta/, rutas inexistentes -> 404.html con código 404.
// Además ejecuta las funciones reales de recepción (POST /api/consulta y /api/llamada, #33) y sustituye a Netlify Forms por un
// registro local (/__mock-forms), para probar el recorrido completo de una consulta sin desplegar:
//   GET  /__mock-forms/registro        -> consultas entregadas (JSON)
//   POST /__mock-forms/reset           -> vacía el registro
//   POST /__mock-forms/fallar?n=1      -> las próximas n entregas responden 500
//   node scripts/qa/serve.mjs <carpeta> <puerto>
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { gzipSync } from 'node:zlib';

const [dir = 'out', port = '4400'] = process.argv.slice(2);
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon' };

process.env.FORMS_ENDPOINT = `http://localhost:${port}/__mock-forms`;
const { default: consulta } = await import(new URL('../../netlify/functions/consulta.mts', import.meta.url).href);
const { default: llamada } = await import(new URL('../../netlify/functions/llamada.mts', import.meta.url).href);
let registro = [];
let fallos = 0;

const readBody = (req) =>
  new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  const path = decodeURIComponent(url.pathname);

  if (path.startsWith('/__mock-forms')) {
    if (path === '/__mock-forms/registro') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(registro));
    }
    if (path === '/__mock-forms/reset') {
      registro = [];
      fallos = 0;
      return res.end('ok');
    }
    if (path === '/__mock-forms/fallar') {
      fallos = Number(url.searchParams.get('n') ?? 1);
      return res.end('ok');
    }
    const body = Object.fromEntries(new URLSearchParams((await readBody(req)).toString()));
    if (fallos > 0) {
      fallos--;
      res.writeHead(500);
      return res.end('fallo simulado');
    }
    registro.push(body);
    res.writeHead(200);
    return res.end('ok');
  }

  if (path === '/api/consulta' || path === '/api/llamada') {
    const body = req.method === 'POST' ? await readBody(req) : undefined;
    const fn = path === '/api/llamada' ? llamada : consulta;
    const r = await fn(new Request(url, { method: req.method, headers: req.headers, body }));
    res.writeHead(r.status, Object.fromEntries(r.headers));
    return res.end(Buffer.from(await r.arrayBuffer()));
  }

  const safe = normalize(path).replace(/^(\.\.[/\\])+/, '');
  let file = join(dir, safe);
  if (existsSync(file) && statSync(file).isDirectory()) {
    if (!path.endsWith('/')) {
      res.writeHead(301, { Location: path + '/' });
      return res.end();
    }
    file = join(file, 'index.html');
  }
  if (!existsSync(file)) {
    res.writeHead(404, { 'Content-Type': TYPES['.html'] });
    return res.end(readFileSync(join(dir, '404.html')));
  }
  // Compresión gzip como en Netlify (sin ella, las medidas de rendimiento locales se inflan)
  const tipo = TYPES[extname(file)] || 'application/octet-stream';
  const cuerpo = readFileSync(file);
  if (/text|javascript|json|xml|svg/.test(tipo) && /gzip/.test(req.headers['accept-encoding'] ?? '')) {
    res.writeHead(200, { 'Content-Type': tipo, 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' });
    return res.end(gzipSync(cuerpo));
  }
  res.writeHead(200, { 'Content-Type': tipo });
  res.end(cuerpo);
}).listen(Number(port), () => console.log(`Sirviendo ${dir} en http://localhost:${port}`));
