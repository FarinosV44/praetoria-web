import { expect, test } from '@playwright/test';

// #5: los CTA de servicio llevan a /contacto/?servicio=<id> y dejan preelegidos el área y el asunto.
const area = (page: import('@playwright/test').Page) => page.getByLabel('¿Sobre qué es tu consulta?');

test('?servicio preelige área y asunto, y se puede quitar', async ({ page }) => {
  await page.goto('/contacto/?servicio=transporte-portes-impagados');
  await expect(area(page)).toHaveValue('transporte');
  await expect(page.locator('#servicio')).toContainText('Reclamación de portes impagados');
  await expect(page.locator('input[name="servicio"]')).toHaveValue('transporte-portes-impagados');
  await page.getByRole('button', { name: 'Quitar o cambiar' }).click();
  await expect(page.locator('#servicio')).toHaveCount(0);
  await expect(page.locator('input[name="servicio"]')).toHaveValue('');
  await expect(area(page)).toHaveValue('transporte');
});

test('cambiar de área descarta el asunto preelegido', async ({ page }) => {
  await page.goto('/contacto/?servicio=transporte-portes-impagados');
  await expect(page.locator('#servicio')).toBeVisible();
  await area(page).selectOption('familia');
  await expect(page.locator('#servicio')).toHaveCount(0);
  await expect(page.locator('input[name="servicio"]')).toHaveValue('');
});

test('?area preelige solo el área; valores desconocidos se ignoran', async ({ page }) => {
  await page.goto('/contacto/?area=mercantil');
  await expect(area(page)).toHaveValue('mercantil');
  await expect(page.locator('#servicio')).toHaveCount(0);
  await page.goto('/contacto/?servicio=no-existe&area=inventada');
  await expect(area(page)).toHaveValue('');
  await expect(page.locator('#servicio')).toHaveCount(0);
});

test('el CTA de un servicio en su página de área abre el formulario con ese asunto', async ({ page }) => {
  await page.goto('/logistica-y-transporte-internacional/');
  await page.getByRole('link', { name: 'Reclamar un porte impagado' }).click();
  await expect(page).toHaveURL(/\/contacto\/\?servicio=transporte-portes-impagados$/);
  await expect(page.locator('#servicio')).toContainText('Reclamación de portes impagados');
});

test('la portada: objetivos y estrategia, áreas y método; sin retratos ni bloque de personas', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Tus objetivos. Nuestra estrategia jurídica.');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Abogados en Valencia para empresas y particulares');
  await expect(page.getByRole('heading', { name: 'Una estrategia para cada asunto' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Primero tu objetivo/ })).toBeVisible();
  await expect(page.locator('.metodo li')).toHaveCount(4);
  await expect(page.getByText('Quién lleva tu asunto')).toHaveCount(0);
  expect(await page.locator('img[src*="juan-jose"]').count()).toBe(0);
  // El Puig solo puede aparecer en la dirección real (tarjeta de contacto), no en los mensajes de la portada
  const mensajes = await page.evaluate(() => {
    const m = document.querySelector('main')!.cloneNode(true) as HTMLElement;
    m.querySelectorAll('.contactos').forEach((n) => n.remove());
    return m.textContent ?? '';
  });
  expect(mensajes).not.toContain('El Puig');
});

test('una consulta enviada desde un servicio llega con ese asunto', async ({ page }) => {
  await page.request.post('/__mock-forms/reset');
  await page.goto('/contacto/?servicio=mercantil-conflictos-socios');
  await expect(page.locator('#servicio')).toBeVisible();
  await page.getByLabel('Nombre').fill('Persona de prueba');
  await page.getByLabel('¿Qué ha pasado y qué te gustaría conseguir?').fill('Mi socio al 50% bloquea todas las decisiones de la junta.');
  await page.getByRole('radio', { name: 'Correo' }).check();
  await page.getByLabel(/^Correo electrónico/).fill('prueba@example.com');
  await page.getByLabel(/política de privacidad/).check();
  await page.waitForTimeout(3100); // antispam: mínimo 3 s desde la carga
  await page.getByRole('button', { name: 'Enviar mi consulta' }).click();
  await expect(page.getByRole('heading', { name: 'Hemos recibido tu consulta' })).toBeVisible();
  const r = await (await page.request.get('/__mock-forms/registro')).json();
  expect(r).toHaveLength(1);
  expect(r[0]).toMatchObject({ area: 'Mercantil y sociedades', servicio: 'Conflictos societarios' });
});

test('un artículo enlaza al servicio del que trata, con el asunto preelegido', async ({ page }) => {
  await page.goto('/impagos-transporte-reclamar-factura/');
  const caja = page.locator('.post-aside .aside-box');
  await expect(caja.getByRole('link', { name: 'reclamación de portes impagados' })).toHaveAttribute('href', '/reclamacion-portes-impagados/');
  await caja.getByRole('link', { name: 'Reclamar un porte impagado' }).click();
  await expect(page.locator('#servicio')).toContainText('Reclamación de portes impagados');
});
