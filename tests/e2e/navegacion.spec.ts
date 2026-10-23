import { expect, test } from '@playwright/test';

test('teclado: salto al contenido y submenú con Enter y Escape', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toBeFocused();
  const empresas = page.getByRole('button', { name: 'Empresas' });
  await empresas.focus();
  await page.keyboard.press('Enter');
  await expect(empresas).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(empresas).toHaveAttribute('aria-expanded', 'false');
});

test('las rutas inexistentes devuelven 404 con la página de error', async ({ page }) => {
  const res = await page.goto('/esta-pagina-no-existe/');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Esta página no existe' })).toBeVisible();
});

test('sin errores de JavaScript en las páginas principales', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const p of ['/', '/logistica-y-transporte-internacional/', '/abogado-divorcio-horta-nord-valencia/', '/abogado-hacienda-y-seguridad-social-en-valencia/', '/contacto/', '/blog/', '/residencia-trabajo-espana-arabe/']) {
    await page.goto(p);
  }
  expect(errors).toEqual([]);
});
