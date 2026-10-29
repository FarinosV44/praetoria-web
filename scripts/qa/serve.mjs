// Servidor estático mínimo que imita a Hostinger para las pruebas en navegador:
// /ruta/ -> /ruta/index.html, /ruta -> 301 a /ruta/, rutas inexistentes -> 404.html con código 404.
// Además ejecuta la recepción real de los formularios (POST /api/consulta y /api/llamada → <carpeta>/api/*.php, con PHP)
// y sustituye el envío por correo por un registro local (/__mock-forms), para probar el recorrido completo sin desplegar:
//   GET  /__mock-forms/registro        -> consultas entregadas (JSON)
//   POST /__mock-forms/reset           -> vacía el registro
//   POST /__mock-forms/fallar?n=1      -> las próximas n entregas responden 500
//   node scripts/qa/serve.mjs <carpeta> <puerto>
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { gzipSync } from 'node:zlib';

const [dir = 'out', port = '4400'] = process.argv.slice(2);
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon' };

const PHP = process.env.PHP_BIN || 'php';
let registro = [];

/** Ejecuta public/api/<nombre>.php (copiado en la build) con PHP de línea de órdenes; devuelve su sobre {status, headers, body}. */
const ejecutarPhp = (nombre, req, body) =>
  new Promise((resolve, reject) => {
    const hijo = spawn(PHP, [join(dir, 'api', `${nombre}.php`)], {
      env: {
        ...process.env,
        REQUEST_METHOD: req.method,
        CONTENT_TYPE: req.headers['content-type'] ?? '',
        CONTENT_LENGTH: String(body?.length ?? 0),
        PRAETORIA_ENTREGA_URL: `http://localhost:${port}/__mock-forms`,
      },
    });
    const salida = [];
    hijo.stdout.on('data', (c) => salida.push(c));
    hijo.stderr.on('data', (c) => process.stderr.write(c));
    hijo.on('error', reject);
    hijo.on('close', () => {
      try {
        resolve(JSON.parse(Buffer.concat(salida).toString()));
      } catch (e) {
        reject(e);
      }
    });
    hijo.stdin.end(body ?? '');
  });
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
    const r = await ejecutarPhp(path.slice(5), req, body);
    res.writeHead(r.status, r.headers);
    return res.end(r.body);
  }
  // Como en Hostinger (.htaccess): las piezas PHP no se sirven ni se ejecutan directamente
  if (path.startsWith('/api/') && path.endsWith('.php')) {
    res.writeHead(404, { 'Content-Type': TYPES['.html'] });
    return res.end(readFileSync(join(dir, '404.html')));
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
