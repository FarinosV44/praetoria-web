import { expect, test } from '@playwright/test';

// #34: contenidos importados desde un chat. Lo pendiente de revisión existe solo en la previsualización:
// con aviso, noindex y fuera de listados, sitemap y RSS.
for (const ruta of ['/citacion-juicio-delito-leve-que-hacer/', '/juicio-rapido-alcoholemia-valencia/']) {
  test(`ejemplo importado ${ruta}: aviso, noindex y fuera de listados`, async ({ page, request }) => {
    await page.goto(ruta);
    await expect(page.locator('.revision-pendiente')).toBeVisible();
    await expect(page.locator('meta[name="revision-juridica"]')).toHaveAttribute('content', 'pendiente-noindex');
    expect(await (await request.get('/sitemap.xml')).text()).not.toContain(ruta);
    expect(await (await request.get('/rss.xml')).text()).not.toContain(ruta);
    await page.goto('/blog/');
    expect(await page.locator(`a[href="${ruta}"]`).count()).toBe(0);
  });
}

test('landing importada: miga de pan hacia su área, FAQ y fuentes oficiales', async ({ page }) => {
  await page.goto('/juicio-rapido-alcoholemia-valencia/');
  await expect(page.locator('.crumbs a[href="/abogado-penalista-valencia/"]')).toBeVisible();
  await expect(page.locator('.service-page__sources a').first()).toHaveAttribute('href', /boe\.es/);
  await expect(page.locator('.area-head .btn--red')).toHaveAttribute('href', /\/que-me-llame-un-abogado\/\?area=penal/);
});
