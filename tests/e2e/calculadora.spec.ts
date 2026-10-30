import { expect, test } from '@playwright/test';

test('calculadora de despido: improcedente con contrato anterior a 2012, objetivo con tope y error de salario', async ({ page }) => {
  await page.goto('/calculadora-indemnizacion-despido/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Calculadora de indemnización por despido');
  await page.fill('input[name=inicio]', '2008-05-01');
  await page.fill('input[name=fin]', '2026-10-30');
  await page.fill('input[name=salario]', '30.000');
  await page.getByRole('button', { name: 'Calcular indemnización' }).click();
  await expect(page.locator('.calc__importe')).toHaveText('54.184,93 €');
  await expect(page.locator('.calc__tramos li')).toHaveCount(2);
  await expect(page.locator('.calc__resultado a[href="/contacto/?servicio=laboral-despidos"]')).toHaveCount(1);

  await page.getByLabel('Objetivo (20 días por año)').check();
  await page.getByRole('button', { name: 'Calcular indemnización' }).click();
  await expect(page.locator('.calc__importe')).toHaveText('29.589,04 €');
  await expect(page.locator('.calc__resultado')).toContainText('tope legal de 360 días');

  await page.fill('input[name=salario]', '');
  await page.getByRole('button', { name: 'Calcular indemnización' }).click();
  await expect(page.locator('.calc__error[role=alert]')).toHaveText('Indica el salario bruto anual.');
});

test('la calculadora está enlazada desde el área laboral', async ({ page }) => {
  await page.goto('/abogado-laboralista-valencia/');
  await expect(page.locator('.journey a[href="/calculadora-indemnizacion-despido/"]')).toHaveCount(1);
});
