import { expect, test } from '@playwright/test';

test('menú móvil: abre, despliega y se cierra al navegar', async ({ page }) => {
  await page.goto('/');
  const toggle = page.getByRole('button', { name: 'Menú' });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', { name: 'Particulares' }).click();
  await page.getByRole('link', { name: /Familia y divorcio/ }).first().click();
  await expect(page).toHaveURL(/\/familia\/$/);
  await expect(page.getByRole('button', { name: 'Menú' })).toHaveAttribute('aria-expanded', 'false');
});

test('la barra fija de Llamar/WhatsApp no tapa ningún elemento enfocado', async ({ page }) => {
  for (const path of ['/contacto/', '/abogado-divorcio-horta-nord-valencia/']) {
    await page.goto(path);
    const bar = await page.locator('.quickbar').boundingBox();
    expect(bar).not.toBeNull();
    const covered = await page.evaluate(async (barTop) => {
      const bad: string[] = [];
      for (const el of document.querySelectorAll<HTMLElement>('main a, main button, main input, main select, main textarea')) {
        if (el.closest('[hidden]')) continue;
        el.focus();
        await new Promise((r) => requestAnimationFrame(() => r(null)));
        const r = el.getBoundingClientRect();
        if (r.height && r.bottom > barTop + 1) bad.push(el.outerHTML.slice(0, 70));
      }
      return bad;
    }, bar!.y);
    expect(covered, `en ${path}`).toEqual([]);
  }
});

test('la barra de contacto llama al teléfono general', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.quickbar').getByRole('link', { name: 'Llamar' })).toHaveAttribute('href', 'tel:+34607527719');
});

test('en las páginas laborales la barra móvil llama y escribe al área laboral', async ({ page }) => {
  await page.goto('/impugnar-despido/');
  const bar = page.locator('.quickbar');
  await expect(bar.getByRole('link', { name: /Llamar/ })).toHaveAttribute('href', 'tel:+34649181290');
  await expect(bar.getByRole('link', { name: /WhatsApp/ })).toHaveAttribute('href', /^https:\/\/wa\.me\/34649181290/);
  await expect(bar).toContainText('Área laboral');
  // y al navegar a otra área vuelve al contacto general
  await page.goto('/derecho-civil/');
  await expect(bar.getByRole('link', { name: /Llamar/ })).toHaveAttribute('href', 'tel:+34607527719');
});
