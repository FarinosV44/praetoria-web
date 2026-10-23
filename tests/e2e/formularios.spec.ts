import { expect, test } from '@playwright/test';

test.describe('cuestionario de divorcio', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/abogado-divorcio-horta-nord-valencia/');
  });

  const answer = (page: import('@playwright/test').Page, v: string) => page.locator('.quiz__step:not([hidden])').getByLabel(v, { exact: true }).click();

  test('caso sencillo: precio cerrado, foco en el resultado y respuestas en el WhatsApp', async ({ page }) => {
    for (const v of ['Quiero divorciarme o separarme', 'Sí, estamos completamente de acuerdo', 'No', 'No', 'No, nada urgente']) await answer(page, v);
    const result = page.locator('.quiz__result');
    await expect(result).toBeVisible();
    await expect(result).toBeFocused();
    await expect(result.getByRole('heading', { name: /precio cerrado/ })).toBeVisible();
    const href = decodeURIComponent((await result.getByRole('link', { name: /WhatsApp/ }).getAttribute('href')) ?? '');
    expect(href).toContain('¿Tenéis hijos en común? No');
  });

  test('caso con hijos menores: valoración personalizada', async ({ page }) => {
    for (const v of ['Quiero divorciarme o separarme', 'Sí, estamos completamente de acuerdo', 'Sí, menores o dependientes', 'No', 'No, nada urgente']) await answer(page, v);
    await expect(page.getByRole('heading', { name: 'Tu asunto necesita una valoración personalizada' })).toBeVisible();
  });

  test('volver atrás conserva la selección y pulsar la misma opción avanza', async ({ page }) => {
    await answer(page, 'No lo tengo claro');
    await page.getByRole('button', { name: 'Volver a la pregunta anterior' }).click();
    await expect(page.getByLabel('No lo tengo claro')).toBeChecked();
    await answer(page, 'No lo tengo claro');
    await expect(page.getByText('Pregunta 2 de 5')).toBeVisible();
  });

  test('empezar de nuevo', async ({ page }) => {
    for (const v of ['Quiero divorciarme o separarme', 'No hay acuerdo', 'No', 'No', 'No, nada urgente']) await answer(page, v);
    await page.getByRole('button', { name: 'Empezar de nuevo' }).click();
    await expect(page.getByText('Pregunta 1 de 5')).toBeVisible();
    await expect(page.getByLabel('Quiero divorciarme o separarme')).not.toBeChecked();
  });
});

test.describe('resumen de Hacienda', () => {
  test('avisa de lo que falta, prepara el resumen y permite corregir sin perder datos', async ({ page }) => {
    await page.goto('/abogado-hacienda-y-seguridad-social-en-valencia/');
    await page.getByRole('button', { name: 'Preparar mi resumen' }).click();
    await expect(page.locator('#triage').getByRole('alert')).toContainText('quién envía la notificación');
    await page.getByLabel('Hacienda (AEAT)').check();
    await page.getByLabel('¿Qué tipo de documento es?').selectOption('Diligencia de embargo');
    await page.getByLabel('Nombre').fill('Persona de prueba');
    await page.getByLabel('Teléfono').fill('600000000');
    await page.getByLabel(/política de privacidad/).check();
    await page.getByRole('button', { name: 'Preparar mi resumen' }).click();
    const result = page.locator('#triage-result');
    await expect(result).toBeFocused();
    await expect(result.locator('.summary')).toContainText('Documento: Diligencia de embargo');
    await page.getByRole('button', { name: 'Corregir mis respuestas' }).click();
    await expect(page.getByLabel('Nombre')).toHaveValue('Persona de prueba');
  });
});

test('el formulario de contacto lleva el marcado de Netlify Forms', async ({ page }) => {
  await page.goto('/contacto/');
  const form = page.locator('form[name="contacto"]');
  await expect(form).toHaveAttribute('data-netlify', 'true');
  await expect(form).toHaveAttribute('netlify-honeypot', 'empresa-web');
  await expect(form.locator('input[name="form-name"]')).toHaveValue('contacto');
});
