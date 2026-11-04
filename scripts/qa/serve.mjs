// Servidor estático mínimo que imita a Hostinger para las pruebas en navegador:
// /ruta/ -> /ruta/index.html, /ruta -> 301 a /ruta/, rutas inexistentes -> 404.html con código 404.
// Además ejecuta la recepción real de los formularios (POST /api/consulta y /api/llamada → src/lib/recepcion.ts)
// y sustituye el envío por correo por un registro local (/__mock-forms), para probar el recorrido completo sin correo:
//   GET  /__mock-forms/registro        -> consultas entregadas (JSON)
//   POST /__mock-forms/reset           -> vacía el registro
//   POST /__mock-forms/fallar?n=1      -> las próximas n entregas responden 500
//   node scripts/qa/serve.mjs <carpeta> <puerto>
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { gzipSync } from 'node:zlib';
import { MAX_CONSULTA, MAX_LLAMADA, recibirConsulta, recibirLlamada } from '../../src/lib/recepcion.ts';

const [dir = 'out', port = '4400'] = process.argv.slice(2);
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon' };

let registro = [];

process.env.PRAETORIA_ENTREGA_URL = `http://localhost:${port}/__mock-forms`;
let fallos = 0;

const readBody = (req) =>
  new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  const path = decodeURIComponent(url.pathname).replace(/^(\/api\/(?:consulta|llamada))\/$/, '$1');

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
    if (req.method !== 'POST') {
      res.writeHead(405);
      return res.end();
    }
    const body = await readBody(req);
    const consulta = path === '/api/consulta';
    const r = body.length > (consulta ? MAX_CONSULTA : MAX_LLAMADA)
      ? { status: 413, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, error: 'tamano' }) }
      : await (consulta ? recibirConsulta : recibirLlamada)(req.headers['content-type'] ?? '', body.toString());
    res.writeHead(r.status, r.headers);
    return res.end(r.body);
  }
  // Navegación interna de Next, como en el servidor real
  if (req.headers.rsc) {
    const rsc = join(dir, normalize(path).replace(/^(\.\.[/\\])+/, ''), 'index.rsc');
    if (existsSync(rsc)) {
      res.writeHead(200, { 'Content-Type': 'text/x-component' });
      return res.end(readFileSync(rsc));
    }
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
  // Compresión gzip como en Hostinger (sin ella, las medidas de rendimiento locales se inflan)
  const tipo = TYPES[extname(file)] || 'application/octet-stream';
  const cuerpo = readFileSync(file);
  if (/text|javascript|json|xml|svg/.test(tipo) && /gzip/.test(req.headers['accept-encoding'] ?? '')) {
    res.writeHead(200, { 'Content-Type': tipo, 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' });
    return res.end(gzipSync(cuerpo));
  }
  res.writeHead(200, { 'Content-Type': tipo });
  res.end(cuerpo);
}).listen(Number(port), () => console.log(`Sirviendo ${dir} en http://localhost:${port}`));
