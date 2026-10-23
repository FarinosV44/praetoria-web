import { expect, test, type Page } from '@playwright/test';

// Se ejecuta contra una build con NEXT_PUBLIC_GA_ID (out-ga/). Analytics no debe cargarse sin aceptar.
const gaLoaded = (page: Page) => page.evaluate(() => !!document.querySelector('script[src*="googletagmanager"]'));

for (const choice of ['Rechazar', 'Aceptar'] as const) {
  test(`${choice}: Analytics ${choice === 'Aceptar' ? 'se carga' : 'no se carga'} y la elección se recuerda`, async ({ page }) => {
    await page.route('**/googletagmanager.com/**', (r) => r.abort());
    await page.goto('/');
    const dialog = page.getByRole('dialog', { name: 'Aviso de cookies' });
    await expect(dialog).toBeVisible();
    expect(await gaLoaded(page)).toBe(false);
    await dialog.getByRole('button', { name: choice }).click();
    await expect(dialog).toBeHidden();
    expect(await gaLoaded(page)).toBe(choice === 'Aceptar');
    await page.goto('/contacto/');
    await expect(page.getByRole('dialog', { name: 'Aviso de cookies' })).toBeHidden();
    expect(await gaLoaded(page)).toBe(choice === 'Aceptar');
    await page.getByRole('button', { name: 'Configurar cookies' }).click();
    await expect(page.getByRole('dialog', { name: 'Aviso de cookies' })).toBeVisible();
  });
}
