// Recorrido de #82 con el núcleo #79/#78/#80: el despacho da de alta un cliente desde /admin, trabaja en el
// expediente conversacional (nota, texto pegado, arrastrar y pegar archivos, compartir, estado, mensaje, tarea),
// el cliente activa su acceso y ve SOLO lo compartido, responde y adjunta; otro cliente no ve nada.
import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { TOTP } from 'otpauth';
import { entrar, esperarCorreo, enlace as enlaceDe, pdfFicticio, registrar, verificarYCompletar } from './util';

const raiz = join(import.meta.dirname, '..', '..');
const suf = randomUUID().slice(0, 8);
const ABOG = { email: `abogada.${suf}@ejemplo.test`, clave: `clave-abogada-${suf}` };
const CLI = { nombre: 'Carla Ficticia Exp', email: `carla.${suf}@ejemplo.test`, clave: `clave-carla-${suf}`, nif: `${suf.replace(/[^0-9]/g, '').padEnd(8, '1').slice(0, 8)}Z` };
const OTRO = { email: `otro.${suf}@ejemplo.test`, clave: `clave-otro-${suf}` };
const e: { totp?: string; sid?: string; enlace?: string; privado?: string; compartido?: string } = {};
test.describe.configure({ mode: 'serial' });

const node = (args: string[]) => execFileSync(process.execPath, ['--env-file=../.env.local', '--experimental-strip-types', ...args], { cwd: raiz, encoding: 'utf8' });

async function entrarAbogada(p: Page) {
  await entrar(p, ABOG.email, ABOG.clave);
  if (e.totp) {
    await expect(p).toHaveURL(/\/entrar\/codigo\/$/);
    await p.getByLabel('Código').fill(new TOTP({ secret: e.totp }).generate());
    await p.getByRole('button', { name: 'Verificar' }).click();
    await expect(p).toHaveURL(/\/admin\/$/);
  }
}

/** Suelta archivos sobre la página como lo haría el sistema operativo al arrastrar. */
async function soltar(p: Page, archivos: { nombre: string; b64: string; tipo: string }[]) {
  await p.evaluate((fs) => {
    const dt = new DataTransfer();
    for (const f of fs) dt.items.add(new File([Uint8Array.from(atob(f.b64), (c) => c.charCodeAt(0))], f.nombre, { type: f.tipo }));
    window.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }));
    window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, archivos);
}

test('1. La abogada entra con doble factor y da de alta un cliente con expediente e invitación', async ({ page: p, browser }) => {
  const salida = node(['scripts/personal-invitar.ts', `--email=${ABOG.email}`, '--nombre=Abogada Expedientes', '--rol=abogado']);
  await p.goto(salida.match(/https?:\/\/\S+invitacion\/\?token=[A-Za-z0-9_-]{43}/)![0]);
  await p.getByLabel('Contraseña', { exact: true }).fill(ABOG.clave);
  await p.getByLabel('Repite la contraseña').fill(ABOG.clave);
  await p.getByRole('button', { name: 'Activar mi cuenta' }).click();
  await entrar(p, ABOG.email, ABOG.clave);
  await p.getByLabel('Confirma tu contraseña').fill(ABOG.clave);
  await p.getByRole('button', { name: 'Continuar' }).click();
  e.totp = (await p.locator('[data-secreto]').getAttribute('data-secreto'))!;
  await p.getByLabel(/Escribe el código de seis cifras/).fill(new TOTP({ secret: e.totp }).generate());
  await p.getByRole('button', { name: 'Activar' }).click();
  await expect(p).toHaveURL(/\/admin\/$/);

  await p.getByRole('link', { name: '+ Cliente' }).click();
  await p.getByLabel('Nombre y apellidos').fill(CLI.nombre);
  await p.getByLabel('Correo electrónico del cliente').fill(CLI.email);
  await p.getByLabel('NIF/CIF (opcional)').fill(CLI.nif);
  await p.getByLabel('Abrir expediente (opcional)').fill('Reclamación de salarios ficticia');
  await p.getByRole('button', { name: 'Dar de alta' }).click();
  await expect(p.getByText('Cliente dado de alta.')).toBeVisible();
  e.enlace = (await p.locator('[data-enlace-activacion]').inputValue());
  const correo = await esperarCorreo(CLI.email, /Tu acceso al área de clientes/);
  expect(enlaceDe(correo.text)).toBe(e.enlace);
  expect(correo.attachments).toBe(0);
  await p.getByRole('link', { name: 'Abrir el expediente' }).click();
  await p.waitForURL(/\/admin\/expedientes\/[0-9a-f-]{36}\/$/);
  e.sid = p.url().match(/expedientes\/([0-9a-f-]{36})/)![1];
  await expect(p.getByRole('heading', { name: 'Reclamación de salarios ficticia' })).toBeVisible();
  await expect(p.getByText('El cliente aún no ha activado su acceso')).toBeVisible();
  void browser;
});

test('2. Expediente conversacional: nota, texto pegado, archivos arrastrados y pegados, sin salir de la pantalla', async ({ page: p, browser }) => {
  await entrarAbogada(p);
  // Buscar al cliente por NIF y abrir su expediente: dos interacciones
  await p.getByLabel('Buscar').fill(CLI.nif);
  await p.getByRole('button', { name: 'Buscar' }).click();
  await p.getByRole('link', { name: /Carla Ficticia Exp · Reclamación de salarios ficticia/ }).click();
  await p.waitForURL(new RegExp(`/admin/expedientes/${e.sid}/$`));

  const texto = p.getByLabel('Escribe en el expediente');
  await texto.fill('Llamada con la clienta: confirma que la empresa le debe tres nóminas.');
  await p.getByRole('button', { name: 'Llamada' }).click();
  await p.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(p.getByRole('status')).toContainText('Guardado en el expediente');
  await expect(p.locator('[data-clase="nota"]', { hasText: 'tres nóminas' })).toContainText('Llamada');

  await texto.fill('NOTIFICACIÓN FICTICIA. '.repeat(30));
  await p.getByRole('button', { name: 'Texto pegado' }).click();
  await texto.press('Control+Enter');
  await expect(p.locator('[data-clase="nota"]', { hasText: 'NOTIFICACIÓN FICTICIA' })).toContainText('Texto aportado');

  const pdf1 = (await pdfFicticio(browser, 'Demanda ficticia (borrador)')).toString('base64');
  const pdf2 = (await pdfFicticio(browser, 'Informe ficticio para la clienta')).toString('base64');
  await soltar(p, [{ nombre: 'borrador-demanda.pdf', b64: pdf1, tipo: 'application/pdf' }, { nombre: 'informe-clienta.pdf', b64: pdf2, tipo: 'application/pdf' }]);
  await expect(p.locator('[data-subida="borrador-demanda.pdf"]')).toContainText('Guardado');
  await expect(p.locator('[data-subida="informe-clienta.pdf"]')).toContainText('Guardado');
  // Pegar una captura desde el portapapeles
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  await texto.focus();
  await p.evaluate((b64) => {
    const dt = new DataTransfer();
    dt.items.add(new File([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], 'image.png', { type: 'image/png' }));
    document.getElementById('compositor-texto')!.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, png);
  await expect(p.locator('[data-subida^="captura-"]')).toContainText('Guardado');
  // Un archivo que no es lo que dice ser se rechaza y se puede reintentar
  await soltar(p, [{ nombre: 'virus.pdf', b64: Buffer.from('MZ ejecutable').toString('base64'), tipo: 'application/pdf' }]);
  await expect(p.locator('[data-subida="virus.pdf"]')).toContainText('Formato no admitido');

  await p.reload();
  for (const n of ['borrador-demanda.pdf', 'informe-clienta.pdf']) await expect(p.locator(`[data-documento="${n}"]`)).toContainText('Privado');
  await expect(p.locator('[data-documento^="captura-"]')).toContainText('pegado');
  e.privado = (await p.locator('[data-documento="borrador-demanda.pdf"] a').first().getAttribute('href'))!.match(/documentos\/([0-9a-f-]{36})/)![1];

  // Organizar: mover a una carpeta con un clic
  const borr = p.locator('[data-documento="borrador-demanda.pdf"]');
  await borr.getByTitle('Cambiar de carpeta').click();
  await borr.getByLabel('Carpeta').fill('Escritos');
  await borr.getByRole('button', { name: 'Mover' }).click();
  await expect(borr.getByTitle('Cambiar de carpeta')).toContainText('Escritos');

  // Compartir solo el informe (dos clics), publicar estado, mensaje al cliente y tarea
  const inf = p.locator('[data-documento="informe-clienta.pdf"]');
  await inf.getByRole('button', { name: 'Compartir con el cliente' }).click();
  await inf.getByRole('button', { name: 'Confirmar: lo verá el cliente' }).click();
  await expect(inf.getByText(/Compartido|Visible para el cliente/).first()).toBeVisible();
  e.compartido = (await inf.locator('a').first().getAttribute('href'))!.match(/documentos\/([0-9a-f-]{36})/)![1];

  await p.getByRole('button', { name: /Estado visible para el cliente/ }).click();
  await p.getByLabel('Estado visible para el cliente').fill('Estamos estudiando tu documentación');
  await p.getByRole('button', { name: 'Publicar' }).click();
  await expect(p.getByText('publicado ✓')).toBeVisible();

  await p.getByRole('button', { name: 'Mensaje al cliente' }).click();
  await texto.fill('Hemos recibido los documentos y estamos revisándolos.');
  await p.getByRole('button', { name: 'Enviar al cliente…' }).click();
  await p.getByRole('button', { name: 'Confirmar: lo verá el cliente' }).click();
  await expect(p.getByRole('status')).toContainText('Mensaje enviado al cliente');

  await p.getByRole('button', { name: 'Tarea o plazo' }).click();
  await texto.fill('Preparar escrito de reclamación');
  await p.getByRole('button', { name: 'Crear tarea' }).click();
  await expect(p.locator('[data-tarea="Preparar escrito de reclamación"]')).toBeVisible();

  // Todo persiste tras recargar, con autor y orden
  await p.reload();
  await expect(p.locator('[data-clase="mensaje"]', { hasText: 'estamos revisándolos' })).toContainText('Mensaje al cliente · Abogada Expedientes');
  await expect(p.locator('[data-tarea="Preparar escrito de reclamación"]')).toContainText('Marcar hecha');
  await expect(p.locator('.expediente-cabecera')).toContainText('Estamos estudiando tu documentación');
  await expect(p.locator('[data-clase="evento"]', { hasText: 'Estamos estudiando tu documentación' })).toBeVisible();
});

test('3. La clienta activa su acceso y ve solo lo compartido; responde y adjunta', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  await p.goto(e.enlace!);
  await expect(p.getByRole('heading', { name: 'Activa tu acceso' })).toBeVisible();
  await p.getByLabel('Contraseña', { exact: true }).fill(CLI.clave);
  await p.getByLabel('Repite la contraseña').fill(CLI.clave);
  await p.getByLabel('He leído la información de privacidad.').check();
  await p.getByRole('button', { name: 'Activar mi cuenta' }).click();
  await expect(p.getByText('Cuenta activada.')).toBeVisible();
  await entrar(p, CLI.email, CLI.clave);
  await expect(p).toHaveURL(/\/inicio\/$/);
  await p.goto('/expedientes/');
  await p.getByRole('link', { name: 'Reclamación de salarios ficticia' }).click();
  await expect(p.getByText('Estamos estudiando tu documentación')).toBeVisible();
  await expect(p.locator('[data-doc-cliente="informe-clienta.pdf"]')).toContainText('Compartido por el despacho');
  await expect(p.getByText('borrador-demanda.pdf')).toHaveCount(0);
  await expect(p.getByText('tres nóminas')).toHaveCount(0);
  await expect(p.getByText('NOTIFICACIÓN FICTICIA')).toHaveCount(0);
  await expect(p.getByText('Hemos recibido los documentos y estamos revisándolos.')).toBeVisible();
  expect((await p.request.get(`/api/documentos/${e.compartido}/?descargar=1`)).status()).toBe(200);
  expect((await p.request.get(`/api/documentos/${e.privado}/`)).status()).toBe(404);
  const r = await p.request.get('/admin/');
  expect(r.url()).not.toMatch(/\/admin\//);

  await p.getByLabel('Escribe un mensaje').fill('Gracias. Os adjunto la última nómina.');
  await p.getByRole('button', { name: 'Enviar mensaje' }).click();
  await expect(p.getByText('Gracias. Os adjunto la última nómina.')).toBeVisible();
  await p.getByLabel('Subir archivo para tu asunto').setInputFiles({ name: 'nomina-octubre.pdf', mimeType: 'application/pdf', buffer: await pdfFicticio(browser, 'Nómina ficticia') });
  await expect(p.getByText('Guardado')).toBeVisible();
  await ctx.close();
});

test('4. El despacho ve la respuesta y el documento del cliente en la cronología', async ({ page: p }) => {
  await entrarAbogada(p);
  await p.goto(`/admin/expedientes/${e.sid}/`);
  await expect(p.locator('[data-clase="mensaje"]', { hasText: 'Os adjunto la última nómina' })).toContainText('Mensaje del cliente');
  await expect(p.locator('[data-documento="nomina-octubre.pdf"]')).toContainText('Documento del cliente');
  await expect(p.locator('[data-documento="nomina-octubre.pdf"]')).toContainText('Visible para el cliente');
  await expect(p.getByText('El cliente aún no ha activado su acceso')).toHaveCount(0);
});

test('5. Otra persona registrada no ve nada del expediente ni de sus documentos', async ({ browser }) => {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  const n = await registrar(p, 'Otro Ficticio', OTRO.email, OTRO.clave);
  await verificarYCompletar(p, OTRO.email, n, OTRO.clave);
  expect((await p.goto(`/solicitudes/${e.sid}/`))!.status()).toBe(404);
  await p.goto(`/admin/expedientes/${e.sid}/`);
  await expect(p).not.toHaveURL(/\/admin\//);
  for (const d of [e.privado, e.compartido]) expect((await p.request.get(`/api/documentos/${d}/`)).status()).toBe(404);
  const st = await p.evaluate(async (sid) => {
    const f = new FormData(); f.append('solicitud', sid!); f.append('archivo', new Blob(['%PDF-1.4\n%%EOF'], { type: 'application/pdf' }), 'x.pdf');
    return (await fetch('/api/documentos/', { method: 'POST', body: f })).status;
  }, e.sid);
  expect(st).toBe(404);
  await ctx.close();
});
