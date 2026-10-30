import { expect, test } from '@playwright/test';

// #6: recorrido guía → servicio → consulta en transporte, con el servicio conservado hasta la recepción.
const registro = async (page: import('@playwright/test').Page) => (await page.request.get('/__mock-forms/registro')).json();

test('el área de transporte ofrece cuatro recorridos y el de impagos lleva a su página de servicio', async ({ page }) => {
  await page.goto('/logistica-y-transporte-internacional/');
  const recorridos = page.locator('.journey');
  await expect(recorridos).toHaveCount(4);
  await expect(recorridos.nth(0)).toContainText('No me pagan un porte');
  await expect(recorridos.nth(1)).toContainText('mercancía');
  await expect(recorridos.nth(2)).toContainText('DeCA');
  await expect(recorridos.nth(3)).toContainText('transporte internacional');
  await expect(recorridos.nth(3).locator('a[href="#transporte-cmr-internacional"]')).toHaveCount(1);
  await expect(page.locator('#transporte-cmr-internacional')).toHaveCount(1);
  await recorridos.nth(0).getByRole('link', { name: 'Cómo lo reclamamos' }).click();
  await expect(page).toHaveURL(/\/reclamacion-portes-impagados\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Reclamación de portes impagados');
  for (const h of ['Qué revisamos', 'Cómo trabajamos', 'Qué documentación ayuda', 'Preguntas frecuentes', 'Para leer antes', 'Normas citadas']) {
    await expect(page.getByRole('heading', { level: 2, name: h })).toBeVisible();
  }
  await expect(page.locator('.service-page__sources a[href^="https://www.boe.es/"]')).toHaveCount(4);
});

test('guía → servicio → consulta: llega con servicio, incidencia y datos de transporte', async ({ page }) => {
  await page.request.post('/__mock-forms/reset');
  await page.goto('/accion-directa-en-el-transporte-como-reclamar-al-cargador-cuando-no-te-paga-tu-cliente/');
  await page.locator('.post-aside').getByRole('link', { name: 'reclamación de portes impagados' }).click();
  await expect(page).toHaveURL(/\/reclamacion-portes-impagados\/$/);
  await page.locator('.page-head').getByRole('link', { name: 'Reclamar un porte impagado' }).click();
  await expect(page).toHaveURL(/\/contacto\/\?servicio=transporte-portes-impagados$/);

  await expect(page.locator('#servicio')).toContainText('Reclamación de portes impagados');
  await expect(page.getByLabel('Tipo de incidencia')).toHaveValue('impago');
  await page.getByLabel('Nombre').fill('Persona de prueba');
  await page.getByLabel('Tu papel').selectOption('transportista');
  await page.getByLabel('Importe orientativo').selectOption('3000-15000');
  await page.getByLabel('Fecha de la factura, la entrega o la incidencia').fill('2026-09-15');
  await page.getByLabel('¿Qué ha pasado y qué te gustaría conseguir?').fill('Una agencia no me paga tres portes de septiembre.');
  await page.getByRole('radio', { name: 'Llamada' }).check();
  await page.getByLabel(/^Teléfono/).fill('600 000 000');
  await page.getByLabel(/política de privacidad/).check();
  await page.waitForTimeout(3100); // antispam
  await page.getByRole('button', { name: 'Enviar mi consulta' }).click();
  await expect(page.getByRole('heading', { name: 'Hemos recibido tu consulta' })).toBeVisible();
  const r = await registro(page);
  expect(r).toHaveLength(1);
  expect(r[0]).toMatchObject({
    area: 'Transporte y logística',
    servicio: 'Reclamación de portes impagados',
    papel: 'Transportista (hago el porte)',
    incidencia: 'Porte o factura impagada',
    importe: 'Entre 3.000 y 15.000 €',
    fecha: '2026-09-15',
  });
});

test('los datos de transporte solo aparecen en esa área y una fecha futura se rechaza', async ({ page }) => {
  await page.goto('/contacto/?area=transporte');
  await expect(page.getByLabel('Tu papel')).toBeVisible();
  await page.getByLabel('Fecha de la factura, la entrega o la incidencia').fill('2999-01-01');
  await page.getByRole('button', { name: 'Enviar mi consulta' }).click();
  await expect(page.locator('#err-fecha')).toContainText('no posterior a hoy');
  await page.getByLabel('¿Sobre qué es tu consulta?').selectOption('familia');
  await expect(page.getByLabel('Tu papel')).toHaveCount(0);
});

test('DeCA contextual: no aparece en artículos de reclamaciones, sí en las guías DeCA', async ({ page }) => {
  await page.goto('/impagos-transporte-reclamar-factura/');
  await expect(page.locator('.deca-bloque')).toHaveCount(0);
  await expect(page.locator('.cta').getByRole('link', { name: /Solicitar una valoración/ })).toHaveAttribute('href', '/contacto/?servicio=transporte-portes-impagados');
  await page.goto('/fraudes-transporte-aseguradora/');
  await expect(page.locator('.deca-bloque')).toHaveCount(0);
  await page.goto('/deca-obligatorio-en-2026-guia-legal-para-transportistas-y-cargadores/');
  await expect(page.locator('.deca-bloque')).toHaveCount(1);
});

test('el servicio de mercancías muestra qué revisamos y sus normas', async ({ page }) => {
  await page.goto('/logistica-y-transporte-internacional/#transporte-mercancias');
  const sv = page.locator('#transporte-mercancias');
  await sv.getByText('Qué revisamos y qué documentación ayuda').click();
  await expect(sv.getByText(/reservas por escrito/)).toBeVisible();
  await expect(sv.locator('a[href*="boe.es"]')).toHaveCount(5);
});
