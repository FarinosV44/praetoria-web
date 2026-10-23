// Servidor estático mínimo que imita a Netlify para las pruebas en navegador:
// /ruta/ -> /ruta/index.html, /ruta -> 301 a /ruta/, rutas inexistentes -> 404.html con código 404.
//   node scripts/qa/serve.mjs <carpeta> <puerto>
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const [dir = 'out', port = '4400'] = process.argv.slice(2);
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon' };

createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
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
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
}).listen(Number(port), () => console.log(`Sirviendo ${dir} en http://localhost:${port}`));
