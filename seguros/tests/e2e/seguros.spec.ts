// Gestor de seguros en la superadministración: menú, acceso solo para el rol «administrador», panel de
// pólizas, ficha, subida de un documento ficticio, avisos y su envío por la app de Praetoria.
// Requiere: STAFF_MFA_REQUIRED=false en .env.local (la pila local no tiene TOTP en esta prueba), personal
// ficticio superadmin@ejemplo.test (administrador) y abogada@ejemplo.test (abogado), y la demo sintética.
import { test, expect, type Page } from '@playwright/test';

const SUPER = { email: 'superadmin@ejemplo.test', clave: process.env.SEGUROS_E2E_CLAVE_ADMIN ?? 'clave-superadmin-sintetica-1' };
const ABOGADA = { email: 'abogada@ejemplo.test', clave: process.env.SEGUROS_E2E_CLAVE_ABOGADA ?? 'clave-abogada-sintetica-1' };
const capturas = !!process.env.CAPTURAS;

async function entrar(p: Page, u: { email: string; clave: string }) {
  await p.setExtraHTTPHeaders({ 'x-forwarded-for': `10.9.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250) + 1}` });
  await p.goto('/entrar/');
  await p.getByLabel('Correo electrónico').fill(u.email);
  await p.getByLabel('Contraseña', { exact: true }).fill(u.clave);
  await p.getByRole('button', { name: 'Entrar' }).click();
  await expect(p).toHaveURL(/\/admin\/$/);
}

test('el menú Seguros solo existe para la superadministración', async ({ page: p }) => {
  await entrar(p, ABOGADA);
  await expect(p.getByRole('navigation', { name: 'Despacho' }).getByRole('link', { name: 'Seguros' })).toHaveCount(0);
  await p.goto('/admin/seguros/');
  await expect(p).toHaveURL(/\/admin\/$/);
  const r = await p.request.get('/api/seguros/exportar/polizas/');
  expect(r.status()).toBe(404);
});

test('panel, ficha, documento y avisos dentro de /admin/seguros', async ({ page: p }) => {
  await entrar(p, SUPER);
  await p.getByRole('navigation', { name: 'Despacho' }).getByRole('link', { name: 'Seguros' }).click();
  await expect(p).toHaveURL(/\/admin\/seguros\/$/);
  await expect(p.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(p.getByRole('navigation', { name: 'Seguros' }).first()).toBeVisible();
  if (capturas) await p.screenshot({ path: 'docs/portal/capturas/seguros-panel.png', fullPage: true });

  // Primera póliza del panel → ficha
  await p.locator('a.fila-enlace').first().click();
  await expect(p).toHaveURL(/\/admin\/seguros\/polizas\/[0-9a-f-]{36}\/?/);
  const ficha = p.url();
  await p.goto(ficha.replace(/\?.*/, '') + '?pestana=documentos');
  const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%% DOCUMENTO FICTICIO PARA PRUEBAS\n%%EOF\n');
  await p.locator('#archivo-directo').setInputFiles({ name: 'condiciones-ficticias.pdf', mimeType: 'application/pdf', buffer: pdf });
  await p.getByRole('button', { name: 'Subir' }).click();
  await expect(p.getByRole('status').filter({ hasText: 'Archivo guardado' })).toBeVisible();
  await expect(p.getByText('condiciones-ficticias.pdf').first()).toBeVisible();
  if (capturas) await p.screenshot({ path: 'docs/portal/capturas/seguros-ficha.png', fullPage: true });

  await p.getByRole('navigation', { name: 'Seguros' }).first().getByRole('link', { name: /Avisos/ }).click();
  await expect(p).toHaveURL(/\/admin\/seguros\/avisos\/$/);
  await p.goto('/admin/seguros/avisos/dispositivo/');
  await expect(p.getByRole('heading', { name: 'Avisos en el móvil' })).toBeVisible();
  await expect(p.getByRole('link', { name: 'App móvil' }).last()).toHaveAttribute('href', '/admin/app/');
  // Sin claves VAPID en local: se dice, no se simula
  await p.getByRole('button', { name: 'Comprobar y enviar prueba' }).click();
  await expect(p.getByText(/claves de notificaciones \(VAPID\)/).first()).toBeVisible();

  const csv = await p.request.get('/api/seguros/exportar/polizas/');
  expect(csv.status()).toBe(200);
  expect(csv.headers()['content-type']).toContain('text/csv');
});

test('en el móvil, barra inferior del gestor', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await entrar(p, SUPER);
  await p.goto('/admin/seguros/');
  await expect(p.getByRole('navigation', { name: 'Seguros (móvil)' })).toBeVisible();
  const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
  expect(ancho).toBeLessThanOrEqual(390);
  if (capturas) await p.screenshot({ path: 'docs/portal/capturas/seguros-movil.png', fullPage: false });
  await ctx.close();
});
