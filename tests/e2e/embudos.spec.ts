import { expect, test, type Page } from '@playwright/test';

// #8: embudos de Hacienda/SS, mercantil, civil y arte.
const registro = async (page: Page) => (await page.request.get('/__mock-forms/registro')).json();

async function completarYEnviar(page: Page, { mensaje = true } = {}) {
  await page.getByLabel('Nombre', { exact: true }).fill('Persona de prueba');
  if (mensaje) await page.getByLabel('¿Qué ha pasado y qué te gustaría conseguir?').fill('Necesito que revisen mi caso cuanto antes, por favor.');
  await page.getByRole('radio', { name: 'Llamada' }).check();
  await page.getByLabel(/^Teléfono/).fill('600 000 000');
  await page.getByLabel(/política de privacidad/).check();
  await page.waitForTimeout(3100); // antispam
  await page.getByRole('button', { name: 'Enviar mi consulta' }).click();
}

async function triage(page: Page, organismo: string, documento: string) {
  await page.goto('/abogado-hacienda-y-seguridad-social-en-valencia/');
  const t = page.locator('#triage');
  await t.getByLabel(organismo).check();
  await t.getByLabel('¿Qué tipo de documento es?').selectOption({ label: documento });
  await t.getByLabel('Fecha de recepción o apertura').fill('2026-10-15');
  await t.getByLabel('Descripción breve').fill('Me ha llegado una notificación y no sé qué plazo tengo.');
  await t.getByLabel('Nombre').fill('Persona de prueba');
  await t.getByLabel('Teléfono').fill('600000000');
  await t.getByLabel(/política de privacidad/).check();
  await t.getByRole('button', { name: 'Preparar mi resumen' }).click();
}

test('Hacienda: el cuestionario pasa organismo, documento, fecha y descripción al formulario y llega a revisión', async ({ page }) => {
  await page.request.post('/__mock-forms/reset');
  await triage(page, 'Seguridad Social (TGSS)', 'Diligencia de embargo');
  await page.locator('#triage-result').getByRole('link', { name: 'Enviar con el formulario de consulta' }).click();
  await expect(page).toHaveURL(/\/contacto\/\?servicio=hacienda-seguridad-social&cuestionario=hacienda$/);
  await expect(page.locator('#servicio')).toContainText('Deudas, apremios y embargos de la Seguridad Social');
  await expect(page.locator('#org-tgss')).toBeChecked();
  await expect(page.getByLabel('Tipo de documento')).toHaveValue('embargo');
  await expect(page.getByLabel('Fecha de recepción o apertura')).toHaveValue('2026-10-15');
  await expect(page.getByLabel('¿Qué ha pasado y qué te gustaría conseguir?')).toHaveValue(/no sé qué plazo tengo/);
  await expect(page.locator('#cuestionario')).toContainText('Organismo: Seguridad Social (TGSS)');
  await completarYEnviar(page, { mensaje: false });
  await expect(page.getByRole('heading', { name: 'Hemos recibido tu consulta' })).toBeVisible();
  await expect(page.locator('.form-ok')).toContainText('Deudas, apremios y embargos');
  const r = await registro(page);
  expect(r).toHaveLength(1);
  expect(r[0]).toMatchObject({ area: 'Hacienda y Seguridad Social', organismo: 'Seguridad Social (TGSS)', documento: 'Diligencia de embargo', fecha: '2026-10-15' });
  expect(r[0].cuestionario).toContain('Recibida o abierta el: 15/10/2026');
});

test('Hacienda: una resolución del INSS sobre una prestación se deriva al área laboral', async ({ page }) => {
  await page.request.post('/__mock-forms/reset');
  await triage(page, 'INSS', 'Resolución sobre una prestación');
  await expect(page.locator('#triage-result')).toContainText('área laboral');
  await page.locator('#triage-result').getByRole('link', { name: 'Enviar con el formulario de consulta' }).click();
  await expect(page).toHaveURL(/servicio=laboral-altas/);
  await expect(page.getByLabel('¿Sobre qué es tu consulta?')).toHaveValue('laboral');
  await expect(page.locator('#cuestionario')).toContainText('Organismo: INSS');
  await page.getByLabel('Soy la persona trabajadora').check();
  await completarYEnviar(page, { mensaje: false });
  await expect(page.getByText('La revisará el área laboral')).toBeVisible();
  expect((await registro(page))[0]).toMatchObject({ area: 'Laboral', servicio: 'Altas médicas y prestaciones', responsable: 'Lucía López (649 181 290)' });
});

test('Hacienda desde el formulario: el organismo es obligatorio', async ({ page }) => {
  await page.request.post('/__mock-forms/reset');
  await page.goto('/contacto/?area=hacienda');
  await completarYEnviar(page);
  await expect(page.locator('#err-organismo')).toBeVisible();
  expect(await registro(page)).toEqual([]);
});

test('Civil: elegir el asunto muestra su pregunta mínima y llega con la consulta', async ({ page }) => {
  await page.request.post('/__mock-forms/reset');
  await page.goto('/contacto/?area=civil');
  await page.getByLabel(/^Asunto/).selectOption({ label: 'Herencias, testamentos y sucesiones' });
  await expect(page.locator('#servicio')).toContainText('Herencias');
  await page.getByRole('radio', { name: 'No lo sé' }).check();
  await completarYEnviar(page);
  await expect(page.locator('.form-ok')).toContainText('Herencias, testamentos y sucesiones');
  expect((await registro(page))[0]).toMatchObject({ servicio: 'Herencias, testamentos y sucesiones', detalle: '¿Hay testamento? No lo sé' });
});

test('Civil y mercantil: recorridos en el área; mercantil separa los impagos de transporte', async ({ page }) => {
  await page.goto('/derecho-civil/');
  await expect(page.locator('.journey')).toHaveCount(4);
  await page.goto('/derecho-mercantil/');
  await expect(page.locator('.journey')).toHaveCount(3);
  await expect(page.locator('.journey').nth(2).getByRole('link', { name: '¿Es un porte impagado?' })).toHaveAttribute('href', '/reclamacion-portes-impagados/');
  await page.locator('#mercantil-reclamaciones').getByText('Qué revisamos').click();
  await expect(page.locator('#mercantil-reclamaciones')).toContainText('Transporte y logística');
});

test('Arte: explica el alcance jurídico y ofrece consulta especializada', async ({ page }) => {
  await page.goto('/arte-y-patrimonio/');
  await expect(page.locator('.area-note')).toContainText('especialista independiente');
  await expect(page.getByRole('link', { name: 'Solicitar una consulta especializada' }).first()).toHaveAttribute('href', /\/contacto\/\?servicio=arte-/);
});

test('«No sé qué área corresponde» sigue disponible y no pide asunto ni datos de un área', async ({ page }) => {
  await page.goto('/contacto/');
  await page.getByLabel('¿Sobre qué es tu consulta?').selectOption('no-se');
  await expect(page.getByLabel(/^Asunto/)).toHaveCount(0);
  await expect(page.locator('.form-extra')).toHaveCount(0);
});
