// #92/#93 · Biblioteca jurídica: subir escritos (varios a la vez y pegados), clasificación sugerida y corregible,
// variantes por procedimiento, aviso de datos identificables, aprobación con revisión de anonimización,
// búsqueda, comparación y permisos. Escritos FICTICIOS.
import { test, expect, type Page, type Browser } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { TOTP } from 'otpauth';
import { entrar } from './util';

test.describe.configure({ mode: 'serial' });
const raiz = join(import.meta.dirname, '..', '..');
const suf = randomUUID().slice(0, 8);
type Cuenta = { email: string; clave: string; totp?: string };
const SA: Cuenta = { email: `bib.sa.${suf}@ejemplo.test`, clave: `clave-bib-sa-${suf}` };
const ANA: Cuenta = { email: `bib.ana.${suf}@ejemplo.test`, clave: `clave-bib-ana-${suf}` };
const LUIS: Cuenta = { email: `bib.luis.${suf}@ejemplo.test`, clave: `clave-bib-luis-${suf}` };
const e: { a?: string; b?: string; versionA?: string } = {};
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
  await p.getByLabel(/Escribe el código de seis cifras/).fill(new TOTP({ secret: c.totp }).generate());
  await p.getByRole('button', { name: 'Activar' }).click();
  await expect(p).toHaveURL(/\/admin\/$/);
}
async function entrarComo(p: Page, c: Cuenta) {
  await entrar(p, c.email, c.clave);
  await p.getByLabel('Código').fill(new TOTP({ secret: c.totp! }).generate());
  await p.getByRole('button', { name: 'Verificar' }).click();
  await expect(p).toHaveURL(/\/admin\/$/);
}
async function pdf(browser: Browser, html: string) {
  const p = await browser.newPage();
  await p.setContent(`${html}<p>DOCUMENTO FICTICIO PARA PRUEBAS. No contiene datos reales.</p>`);
  const b = await p.pdf({ format: 'A4' });
  await p.close();
  return b;
}

test('1. Activación de la superadministración y de dos abogados; el catálogo invita a subir el primer modelo', async ({ page: p, browser }) => {
  await activar(p, SA, 'administrador', 'Titular Biblioteca');
  for (const [c, n] of [[ANA, 'Ana Biblioteca'], [LUIS, 'Luis Biblioteca']] as const) {
    const ctx = await browser.newContext(); await activar(await ctx.newPage(), c, 'abogado', n); await ctx.close();
  }
  await p.getByRole('link', { name: 'Biblioteca' }).click();
  await p.getByRole('link', { name: /Familia/ }).click();
  await expect(p.locator('[data-procedimiento="Modificación de medidas"]')).toContainText('modelo no disponible — sube el primero');
});

test('2. Ana sube dos variantes y un texto pegado: privados, clasificados por sugerencia y con aviso de datos', async ({ page: p, browser }) => {
  await entrarComo(p, ANA);
  await p.goto('/admin/biblioteca/');
  const a = await pdf(browser, '<h1>Demanda de modificación de medidas — variante A</h1><p>D. Juan Ficticio Pérez, con DNI 12345678Z, solicita la modificación de medidas por traslado de residencia.</p><p>SUPLICO al Juzgado…</p>');
  const b = await pdf(browser, '<h1>Demanda de modificación de medidas — variante B</h1><p>Se solicita la modificación de medidas por cambio de horario laboral del progenitor.</p><p>SUPLICO al Juzgado…</p>');
  await p.getByLabel('Archivos para la biblioteca').setInputFiles([
    { name: 'modificacion-medidas-A.pdf', mimeType: 'application/pdf', buffer: a },
    { name: 'modificacion-medidas-B.pdf', mimeType: 'application/pdf', buffer: b },
  ]);
  await expect(p.locator('[data-subida-bib="modificacion-medidas-A.pdf"]')).toContainText(/aviso.*datos identificables/);
  await expect(p.locator('[data-subida-bib="modificacion-medidas-B.pdf"]')).toContainText('guardado');
  await p.getByLabel('Texto del escrito').fill('Recurso de reposición ficticio contra liquidación tributaria. Ley General Tributaria. Se interpone recurso de reposición…');
  await p.getByRole('button', { name: 'Guardar texto' }).click();
  await expect(p.locator('[data-subida-bib="Texto pegado"]')).toContainText('guardado');

  await p.reload();
  const tarjeta = p.locator('[data-modelo="modificacion-medidas-A"]');
  await expect(tarjeta).toContainText('Familia · Modificación de medidas');
  await expect(tarjeta).toContainText('Pendiente de revisión');
  await tarjeta.getByRole('link', { name: 'modificacion-medidas-A' }).click();
  await p.waitForURL(/biblioteca\/[0-9a-f-]{36}\/$/);
  e.a = p.url().match(/biblioteca\/([0-9a-f-]{36})/)![1];
  await expect(p.locator('[data-avisos-identificables]')).toContainText(/DNI/);
  await expect(p.locator('[data-avisos-identificables]')).toContainText(/nombre de persona/);
  // Corregir la clasificación sin formularios eternos
  await p.getByLabel('Título', { exact: true }).fill('Modificación de medidas por traslado (ficticio)');
  await p.getByLabel('Variante', { exact: true }).fill('traslado de residencia');
  await p.getByLabel(/Modelo maestro/).check();
  await p.getByRole('button', { name: 'Guardar clasificación' }).click();
  await expect(p.getByRole('status')).toContainText('Clasificación guardada');
  await p.getByRole('button', { name: 'Enviar a revisión' }).click();
  await expect(p.locator('[data-estado-modelo]')).toHaveAttribute('data-estado-modelo', 'revision');
  e.versionA = (await p.getByRole('link', { name: 'Descargar original' }).getAttribute('href'))!;
  expect((await p.request.get(e.versionA)).status()).toBe(200);
});

test('3. Luis (otro abogado) no ve lo que no está aprobado: ni en la búsqueda, ni por URL, ni el original', async ({ page: p }) => {
  await entrarComo(p, LUIS);
  await p.goto('/admin/biblioteca/?q=modificación de medidas');
  await expect(p.getByText('No hay modelos que coincidan.')).toBeVisible();
  expect((await p.goto(`/admin/biblioteca/${e.a}/`))!.status()).toBe(404);
  expect((await p.request.get(e.versionA!)).status()).toBe(404);
});

test('4. La superadministración aprueba tras confirmar la anonimización; Luis lo encuentra, lo compara y no puede editarlo', async ({ page: p, browser }) => {
  await entrarComo(p, SA);
  await p.goto(`/admin/biblioteca/${e.a}/`);
  await p.getByLabel(/He revisado la última versión/).check();
  await p.getByRole('button', { name: 'Aprobar para la biblioteca' }).click();
  await expect(p.locator('[data-estado-modelo]')).toHaveAttribute('data-estado-modelo', 'aprobado');
  // Aprobar también la variante B (como maestro) para poder compararlas
  await p.goto('/admin/biblioteca/?q=variante B');
  await p.locator('[data-modelo="modificacion-medidas-B"]').getByRole('link').first().click();
  await p.waitForURL(/biblioteca\/[0-9a-f-]{36}\/$/);
  e.b = p.url().match(/biblioteca\/([0-9a-f-]{36})/)![1];
  await p.getByLabel(/Modelo maestro/).check();
  await p.getByRole('button', { name: 'Guardar clasificación' }).click();
  await expect(p.getByRole('status')).toContainText('Clasificación guardada');
  await p.getByLabel(/He revisado la última versión/).check();
  await p.getByRole('button', { name: 'Aprobar para la biblioteca' }).click();
  await expect(p.locator('[data-estado-modelo]')).toHaveAttribute('data-estado-modelo', 'aprobado');

  const ctx = await browser.newContext();
  const q = await ctx.newPage();
  await entrarComo(q, LUIS);
  await q.goto('/admin/biblioteca/?q=traslado residencia');
  await expect(q.locator('[data-modelo="Modificación de medidas por traslado (ficticio)"]')).toContainText('Aprobado');
  await q.goto(`/admin/biblioteca/${e.a}/`);
  await q.getByRole('link', { name: 'comparar' }).first().click();
  await expect(q.locator('[data-diferencias]')).toContainText('traslado de residencia');
  await expect(q.locator('[data-diferencias]')).toContainText('cambio de horario laboral');
  await expect(q.getByRole('button', { name: 'Guardar clasificación' })).toHaveCount(0);
  expect((await q.request.get(e.versionA!)).status()).toBe(200);
  await ctx.close();
});

test('5. Un cliente no llega a la biblioteca ni a sus archivos', async ({ page: p }) => {
  // Cliente registrado por la vía pública del portal (sin personal)
  await p.goto('/admin/biblioteca/');
  await expect(p).toHaveURL(/\/entrar\//);
  expect((await p.request.get(e.versionA!)).status()).toBe(401);
});
