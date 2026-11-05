// #100 · Subida al expediente: cinco documentos a la vez (PDF, Word, JPG, PNG pegado), persistencia tras recargar
// en el expediente correcto, y mensajes claros con referencia cuando se rechaza un archivo. Datos FICTICIOS.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { TOTP } from 'otpauth';
import { entrar, pdfFicticio } from './util';
import { aDocx, estructurar, normalizarEstilo } from '../../../src/portal/lib/render.ts';

const raiz = join(import.meta.dirname, '..', '..');
const suf = randomUUID().slice(0, 8);
const A = { email: `subida.${suf}@ejemplo.test`, clave: `clave-subida-${suf}` };
const node = (args: string[]) => execFileSync(process.execPath, ['--env-file=../.env.local', '--experimental-strip-types', ...args], { cwd: raiz, encoding: 'utf8' });

test('Cinco documentos arrastrados y pegados se guardan en el expediente y siguen ahí tras recargar', async ({ page: p, browser }) => {
  const s = node(['scripts/personal-invitar.ts', `--email=${A.email}`, '--nombre=Abogada Subidas', '--rol=administrador']);
  await p.goto(s.match(/https?:\/\/\S+invitacion\/\?token=[A-Za-z0-9_-]{43}/)![0]);
  await p.getByLabel('Contraseña', { exact: true }).fill(A.clave);
  await p.getByLabel('Repite la contraseña').fill(A.clave);
  await p.getByRole('button', { name: 'Activar mi cuenta' }).click();
  await entrar(p, A.email, A.clave);
  await p.getByLabel('Confirma tu contraseña').fill(A.clave);
  await p.getByRole('button', { name: 'Continuar' }).click();
  const totp = (await p.locator('[data-secreto]').getAttribute('data-secreto'))!;
  await p.getByLabel(/Escribe el código de seis cifras/).fill(new TOTP({ secret: totp }).generate());
  await p.getByRole('button', { name: 'Activar' }).click();
  await expect(p).toHaveURL(/\/admin\/$/);
  await p.goto('/admin/clientes/nuevo/');
  await p.getByLabel('Nombre y apellidos').fill('Sonia Ficticia Subidas');
  await p.getByLabel('Correo electrónico del cliente').fill(`sonia.${suf}@ejemplo.test`);
  await p.getByLabel('Abrir expediente (opcional)').fill('Asunto ficticio de subidas');
  await p.getByRole('button', { name: 'Dar de alta' }).click();
  await p.getByRole('link', { name: 'Abrir el expediente' }).click();
  await p.waitForURL(/\/admin\/expedientes\/[0-9a-f-]{36}\/$/);

  const foto = await (async () => { const q = await browser.newPage(); await q.setContent('<h1 style="font-size:60px">Foto ficticia</h1>'); const b = await q.screenshot({ type: 'jpeg' }); await q.close(); return b; })();
  const archivos = [
    { nombre: 'contrato-ficticio.pdf', tipo: 'application/pdf', b64: (await pdfFicticio(browser, 'Contrato ficticio')).toString('base64') },
    { nombre: 'requerimiento-ficticio.pdf', tipo: 'application/pdf', b64: (await pdfFicticio(browser, 'Requerimiento ficticio')).toString('base64') },
    { nombre: 'escrito-ficticio.docx', tipo: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      b64: (await aDocx(estructurar('ESCRITO FICTICIO\n\nTexto de prueba.'), normalizarEstilo({}), 'Ficticio')).toString('base64') },
    { nombre: 'foto-movil.jpg', tipo: 'image/jpeg', b64: foto.toString('base64') },
  ];
  await p.evaluate((fs) => {
    const dt = new DataTransfer();
    for (const f of fs) dt.items.add(new File([Uint8Array.from(atob(f.b64), (c) => c.charCodeAt(0))], f.nombre, { type: f.tipo }));
    window.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }));
    window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, archivos);
  // Quinto: captura pegada desde el portapapeles
  await p.getByLabel('Escribe en el expediente').evaluate((el) => {
    const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));
    const dt = new DataTransfer(); dt.items.add(new File([png], 'image.png', { type: 'image/png' }));
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  for (const f of archivos) await expect(p.locator(`[data-subida="${f.nombre}"]`)).toContainText('Guardado');
  await expect(p.locator('[data-subida^="captura-"]')).toContainText('Guardado');

  await p.reload();
  for (const f of archivos) await expect(p.locator(`[data-documento="${f.nombre}"]`)).toContainText('Privado');
  await expect(p.locator('[data-documento^="captura-"]')).toHaveCount(1);
  const sid = p.url().match(/expedientes\/([0-9a-f-]{36})/)![1]!;
  for (const f of archivos) {
    const href = (await p.locator(`[data-documento="${f.nombre}"] a`).first().getAttribute('href'))!;
    expect((await p.request.get(href)).status()).toBe(200);
  }

  // Un Word antiguo (.doc) se rechaza diciendo qué es y cómo convertirlo, con referencia para los registros
  const doc = Buffer.concat([Buffer.from('d0cf11e0a1b11ae1', 'hex'), Buffer.alloc(4096)]);
  const r = await p.request.post('/api/documentos/', { multipart: { solicitud: sid, archivo: { name: 'antiguo.doc', mimeType: 'application/msword', buffer: doc } },
    headers: { origin: new URL(p.url()).origin } });
  expect(r.status()).toBe(415);
  const j = await r.json();
  expect(j.error).toMatch(/Word o Excel antiguo/);
  expect(j.ref).toMatch(/^[0-9a-f]{8}$/);
});
