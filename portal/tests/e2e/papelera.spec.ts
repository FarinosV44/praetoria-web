// Papelera de documentos del expediente (30 días) y pestaña «Expedientes» (abiertos/cerrados, agrupados). Datos ficticios.
import { test, expect, type Page, type Browser } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import pg from 'pg';
import { TOTP } from 'otpauth';
import { entrar, pdfFicticio } from './util';

test.describe.configure({ mode: 'serial' });
const raiz = join(import.meta.dirname, '..', '..');
const suf = randomUUID().slice(0, 8);
type Cuenta = { email: string; clave: string; totp?: string; ultimo?: string };
const SA: Cuenta = { email: `pap.sa.${suf}@ejemplo.test`, clave: `clave-pap-sa-${suf}` };
const e: { a?: string; b?: string; doc?: string } = {};
const node = (args: string[]) => execFileSync(process.execPath, ['--env-file=../.env.local', '--experimental-strip-types', ...args], { cwd: raiz, encoding: 'utf8' });

async function activar(p: Page, c: Cuenta, rol: string, nombre: string) {
  const s = node(['scripts/personal-invitar.ts', `--email=${c.email}`, `--nombre=${nombre}`, `--rol=${rol}`]);
  await p.goto(s.match(/https?:\/\/\S+invitacion\/\?token=[A-Za-z0-9_-]{43}/)![0]);
  await p.getByLabel('Contraseña', { exact: true }).fill(c.clave);
  await p.getByLabel('Repite la contraseña').fill(c.clave);
  await p.getByRole('button', { name: 'Activar mi cuenta' }).click();
  await entrar(p, c.email, c.clave);
  await p.getByLabel('Confirma tu contraseña').fill(c.clave);
  await p.getByRole('button', { name: 'Continuar' }).click();
  c.totp = (await p.locator('[data-secreto]').getAttribute('data-secreto'))!;
  c.ultimo = new TOTP({ secret: c.totp }).generate();
  await p.getByLabel(/Escribe el código de seis cifras/).fill(c.ultimo);
  await p.getByRole('button', { name: 'Activar' }).click();
  await expect(p).toHaveURL(/\/admin\/$/);
}

/** Volver a entrar con doble factor; un código TOTP ya usado se rechaza, así que se espera al siguiente. */
async function entrarComo(p: Page, c: Cuenta) {
  await entrar(p, c.email, c.clave);
  let codigo = new TOTP({ secret: c.totp! }).generate();
  while (codigo === c.ultimo) { await p.waitForTimeout(1000); codigo = new TOTP({ secret: c.totp! }).generate(); }
  c.ultimo = codigo;
  await p.getByLabel('Código').fill(codigo);
  await p.getByRole('button', { name: 'Verificar' }).click();
  await expect(p).toHaveURL(/\/admin\/$/);
}

async function expediente(p: Page, browser: Browser, nombre: string, asunto: string, archivo: string | null) {
  await p.goto('/admin/clientes/nuevo/');
  await p.getByLabel('Nombre y apellidos').fill(nombre);
  await p.getByLabel('Correo electrónico del cliente').fill(`${nombre.split(' ')[0]!.toLowerCase()}.pap.${suf}@ejemplo.test`);
  await p.getByLabel('Abrir expediente (opcional)').fill(asunto);
  await p.getByRole('button', { name: 'Dar de alta' }).click();
  await p.getByRole('link', { name: 'Abrir el expediente' }).click();
  await p.waitForURL(/\/admin\/expedientes\/[0-9a-f-]{36}\/$/);
  if (archivo) {
    const b64 = (await pdfFicticio(browser, `Documento ficticio ${archivo}`)).toString('base64');
    await p.evaluate(([b64, archivo]) => {
      const dt = new DataTransfer();
      dt.items.add(new File([Uint8Array.from(atob(b64!), (c) => c.charCodeAt(0))], archivo!, { type: 'application/pdf' }));
      window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    }, [b64, archivo]);
    await expect(p.locator(`[data-subida="${archivo}"]`)).toContainText('Guardado');
  }
  return p.url().match(/expedientes\/([0-9a-f-]{36})/)![1]!;
}

test('1. Eliminar un documento lo lleva a la papelera: desaparece, no se descarga y se restaura', async ({ page: p, browser }) => {
  await activar(p, SA, 'administrador', 'Titular Papelera');
  e.a = await expediente(p, browser, 'Paula Ficticia', `Reclamación ficticia ${suf}`, 'subido-por-error.pdf');
  await p.reload();
  const fila = p.locator('[data-clase="documento"]', { hasText: 'subido-por-error.pdf' });
  await expect(fila).toBeVisible();
  const enlace = await fila.locator('a[href*="/api/documentos/"]').first().getAttribute('href');
  e.doc = enlace!.match(/documentos\/([0-9a-f-]{36})/)![1]!;
  await fila.getByRole('button', { name: 'Eliminar subido-por-error.pdf' }).click();
  await fila.getByLabel('Motivo para eliminar subido-por-error.pdf').fill('Subido por error (prueba ficticia)');
  await fila.getByRole('button', { name: 'Confirmar: a la papelera' }).click();
  await expect(p.locator('[data-clase="documento"]', { hasText: 'subido-por-error.pdf' })).toHaveCount(0);
  await expect(p.locator('[data-clase="evento"]', { hasText: 'enviado a la papelera (Subido por error' })).toBeVisible();
  expect((await p.request.get(`/api/documentos/${e.doc}/`)).status()).toBe(404);
  const papelera = p.locator('[data-papelera]');
  await papelera.locator('summary').click();
  const item = papelera.locator('[data-en-papelera="subido-por-error.pdf"]');
  await expect(item).toContainText('30 días para restaurar');
  await expect(item).toContainText('Titular Papelera');
  await item.getByRole('button', { name: 'Restaurar' }).click();
  await expect(p.locator('[data-clase="documento"]', { hasText: 'subido-por-error.pdf' })).toBeVisible();
  expect((await p.request.get(`/api/documentos/${e.doc}/`)).status()).toBe(200);
});

test('2. Pasados 30 días, la tarea periódica borra el archivo y deja solo el registro', async ({ page: p }) => {
  await entrarComo(p, SA);
  await p.goto(`/admin/expedientes/${e.a}/`);
  const fila = p.locator('[data-clase="documento"]', { hasText: 'subido-por-error.pdf' });
  await fila.getByRole('button', { name: 'Eliminar subido-por-error.pdf' }).click();
  await fila.getByRole('button', { name: 'Confirmar: a la papelera' }).click();
  await expect(p.locator('[data-clase="documento"]', { hasText: 'subido-por-error.pdf' })).toHaveCount(0);
  const adm = new pg.Client({ connectionString: process.env.DATABASE_URL_ADMIN });
  await adm.connect();
  try {
    await adm.query(`update portal.documentos set eliminado_at = now() - interval '31 days' where id = $1`, [e.doc]);
    const r = await p.request.post('/api/interno/avisos/', { headers: { 'x-cron-clave': process.env.CRON_CLAVE! } });
    expect(r.status()).toBe(200);
    expect((await r.json()).papelera.purgados).toBeGreaterThanOrEqual(1);
    expect((await adm.query('select purgado_at from portal.documentos where id = $1', [e.doc])).rows[0].purgado_at).not.toBeNull();
  } finally { await adm.end(); }
  await p.reload();
  await p.locator('[data-papelera] summary').click();
  await expect(p.locator('[data-en-papelera="subido-por-error.pdf"]')).toContainText('Borrado definitivamente');
  await expect(p.locator('[data-en-papelera="subido-por-error.pdf"]').getByRole('button', { name: 'Restaurar' })).toHaveCount(0);
});

test('3. Pestaña Expedientes: abiertos y cerrados, agrupados por cliente o por asunto, con búsqueda', async ({ page: p, browser }) => {
  await entrarComo(p, SA);
  e.b = await expediente(p, browser, 'Bruno Ficticio', `Despido ficticio ${suf}`, null);
  await p.getByRole('button', { name: 'Cerrar expediente' }).click();
  await p.getByRole('button', { name: 'Confirmar: cerrar el expediente' }).click();
  await expect(p.locator('[data-expediente-cerrado]')).toBeVisible();
  await expect(p.locator('[data-clase="evento"]', { hasText: 'Expediente cerrado' })).toBeVisible();

  await p.getByRole('link', { name: 'Expedientes', exact: true }).click();
  await expect(p).toHaveURL(/\/admin\/expedientes\/$/);
  await p.getByLabel('Buscar expedientes').fill(suf);
  await p.getByLabel('Buscar expedientes').press('Enter');
  await expect(p.locator(`[data-expediente="Reclamación ficticia ${suf}"]`)).toBeVisible();
  await expect(p.locator(`[data-expediente="Despido ficticio ${suf}"]`)).toHaveCount(0);
  await expect(p.locator('[data-grupo="Paula Ficticia"]')).toBeVisible();

  await p.getByRole('link', { name: /^Cerrados/ }).click();
  await expect(p).toHaveURL(/estado=cerrados/);
  await expect(p.locator(`[data-expediente="Despido ficticio ${suf}"]`)).toContainText('Cerrado');
  await expect(p.locator(`[data-expediente="Reclamación ficticia ${suf}"]`)).toHaveCount(0);

  await p.getByRole('link', { name: /^Todos/ }).click();
  await expect(p).toHaveURL(/estado=todos/);
  await p.getByRole('link', { name: 'Por tipo de asunto' }).click();
  await expect(p).toHaveURL(/estado=todos&agrupar=asunto/);
  await expect(p.locator('[data-grupo="Sin tipo de asunto"]')).toBeVisible();
  await expect(p.locator(`[data-expediente="Despido ficticio ${suf}"]`)).toBeVisible();
  await expect(p.locator(`[data-expediente="Reclamación ficticia ${suf}"]`)).toBeVisible();

  // Reabrir vuelve a ponerlo entre los abiertos
  await p.locator(`[data-expediente="Despido ficticio ${suf}"] a`).first().click();
  await p.getByRole('button', { name: 'Reabrir expediente' }).click();
  await expect(p.locator('[data-expediente-cerrado]')).toHaveCount(0);
});
