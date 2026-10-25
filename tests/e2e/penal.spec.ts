import { expect, test, type Page } from '@playwright/test';

// #32 Penal y #33 «Que me llame un abogado». La previsualización marca la revisión jurídica pendiente;
// las páginas penales no se indexan ni están en el sitemap hasta su revisión.
const registro = async (page: Page) => (await page.request.get('/__mock-forms/registro')).json();
const PENAL = ['/abogado-penalista-valencia/', '/asistencia-al-detenido/', '/citacion-juzgado-juicio-rapido/', '/alcoholemia-y-seguridad-vial/', '/lesiones-y-agresiones/', '/hurto-y-robo/', '/estafas/'];

test('Penal: accesible desde Particulares, con recorridos y aviso de revisión pendiente', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Particulares' }).click();
  await page.locator('header').getByRole('link', { name: 'Penal' }).click();
  await expect(page).toHaveURL(/\/abogado-penalista-valencia\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Abogados penalistas en Valencia');
  await expect(page.locator('.journey')).toHaveCount(8);
  await expect(page.locator('.revision-pendiente')).toContainText('Pendiente de revisión jurídica');
  await expect(page.locator('.area-head').getByRole('link', { name: 'Que me llame un abogado' })).toHaveAttribute('href', '/que-me-llame-un-abogado/?area=penal');
});

test('páginas penales: noindex, fuera del sitemap, fuentes del BOE y qué no puede esperar', async ({ page, request }) => {
  const sitemap = await (await request.get('/sitemap.xml')).text();
  for (const ruta of PENAL) {
    expect(sitemap).not.toContain(ruta);
    await page.goto(ruta);
    await expect(page.locator('meta[name="revision-juridica"]')).toHaveAttribute('content', 'pendiente-noindex');
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute('content', /noindex/);
    if (ruta !== PENAL[0]) {
      await expect(page.locator('.service-page__sources a').first()).toHaveAttribute('href', /^https:\/\/www\.boe\.es\/eli\//);
      await expect(page.locator('.urgencia')).toContainText('no confirma la asistencia');
    }
  }
});

test('«Que me llame un abogado»: aviso, envío real a la función y confirmación solo tras la recepción', async ({ page }) => {
  await page.request.post('/__mock-forms/reset');
  await page.goto('/citacion-juzgado-juicio-rapido/');
  await page.locator('.area-head').getByRole('link', { name: 'Que me llame un abogado' }).click();
  await expect(page).toHaveURL(/servicio=penal-citacion/);
  await expect(page.locator('.aviso-llamada')).toHaveText('Solicitud de contacto prioritario, sujeta a disponibilidad. El envío no confirma asistencia ni suspende plazos.');
  await expect(page.getByLabel('Área')).toHaveValue('penal');
  // Sin teléfono no se envía
  await page.getByLabel('Nombre').fill('Persona de prueba');
  await page.getByRole('button', { name: 'Solicitar que me llamen' }).click();
  await expect(page.locator('.form-errors')).toContainText('Teléfono');
  expect(await registro(page)).toHaveLength(0);
  await page.getByLabel('Teléfono').fill('600 000 000');
  await page.getByLabel('Motivo').selectOption('citacion');
  await page.getByLabel('¿Cómo podemos contactarte con seguridad?').selectOption('sin-mensajes');
  await page.getByLabel(/política de privacidad/).check();
  await page.waitForTimeout(3100); // antispam: tiempo mínimo desde la carga
  // Primer intento: falla la entrega; el formulario conserva los datos y ofrece reintentar
  await page.request.post('/__mock-forms/fallar?n=1');
  await page.getByRole('button', { name: 'Solicitar que me llamen' }).click();
  await expect(page.locator('.form-fail')).toContainText('No hemos podido recibir tu solicitud');
  await expect(page.getByRole('heading', { name: 'Hemos recibido tu solicitud' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Reintentar el envío' }).dblclick();
  await expect(page.getByRole('heading', { name: 'Hemos recibido tu solicitud' })).toBeVisible();
  await expect(page.locator('.form-ok')).toContainText('según disponibilidad');
  const r = await registro(page);
  expect(r).toHaveLength(1); // doble clic: una sola entrega
  expect(r[0]['form-name']).toBe('llamada-urgente');
  expect(r[0].prioridad).toBe('URGENTE');
  expect(r[0].servicio).toBe('Citaciones y juicios rápidos');
});

test('contacto enlaza la solicitud de llamada; ningún texto promete 24 horas ni atención inmediata', async ({ page }) => {
  await page.goto('/contacto/');
  await expect(page.locator('.direct__urgente').getByRole('link', { name: 'Que me llame un abogado' })).toBeVisible();
  for (const ruta of ['/que-me-llame-un-abogado/', ...PENAL]) {
    await page.goto(ruta);
    const texto = (await page.locator('main').innerText()).toLowerCase();
    expect(texto).not.toMatch(/24 ?h|24 horas|veinticuatro horas, todos|inmediat[ao]s? (respuesta|atención|asistencia)|disponibles siempre/);
  }
});
