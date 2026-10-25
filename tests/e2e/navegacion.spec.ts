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

test('Hacienda y Seguridad Social se enlaza desde Empresas y desde Particulares, con una sola URL (#31)', async ({ page }) => {
  const url = '/abogado-hacienda-y-seguridad-social-en-valencia/';
  await page.goto('/');
  for (const grupo of ['Empresas', 'Particulares']) {
    await page.getByRole('button', { name: grupo }).click();
    const sub = page.locator('.menu__item.open .sub');
    await expect(sub.locator(`a[href="${url}"]`)).toBeVisible();
    await page.keyboard.press('Escape');
  }
  await page.goto('/areas/');
  await expect(page.locator(`#empresas a[href="${url}"]`).first()).toBeVisible();
  await expect(page.locator(`#particulares a[href="${url}"]`).first()).toBeVisible();
  await page.goto(url);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://praetoriaabogados.es${url}`);
  await expect(page.locator('#segun-tu-situacion')).toContainText('Particulares');
  await expect(page.locator('#segun-tu-situacion')).toContainText('Empresas y autónomos');
  const sitemap = await (await page.request.get('/sitemap.xml')).text();
  expect(sitemap.split(url).length - 1).toBe(1);
});
