import { expect, test, type Page } from '@playwright/test';

// Recorrido real: formulario -> recepción /api/consulta (public/api/consulta.php, la de producción) -> registro que sustituye al correo.
const registro = async (page: Page) => (await page.request.get('/__mock-forms/registro')).json();

test.beforeEach(async ({ page }) => {
  await page.request.post('/__mock-forms/reset');
  await page.goto('/contacto/');
});

// La función descarta envíos hechos en menos de 3 s desde que se carga el formulario (antispam)
const esperarTiempoMinimo = (page: Page) => page.waitForTimeout(3100);

async function rellenar(page: Page, { preferencia = 'Llamada', telefono = '600 000 000', email = '', area = 'Transporte y logística' } = {}) {
  await page.getByLabel('Nombre').fill('Persona de prueba');
  await page.getByLabel('¿Sobre qué es tu consulta?').selectOption({ label: area });
  await page.getByLabel('¿Qué ha pasado y qué te gustaría conseguir?').fill('Un cliente no me paga dos portes desde hace tres meses.');
  await page.getByRole('radio', { name: preferencia }).check();
  if (telefono) await page.getByLabel(/^Teléfono/).fill(telefono);
  if (email) await page.getByLabel(/^Correo electrónico/).fill(email);
  await page.getByLabel(/política de privacidad/).check();
}

test('el área no viene elegida por defecto y es obligatoria', async ({ page }) => {
  await expect(page.getByLabel('¿Sobre qué es tu consulta?')).toHaveValue('');
  await page.getByRole('button', { name: 'Enviar mi consulta' }).click();
  await expect(page.locator('.form-errors')).toBeFocused();
  await expect(page.locator('#err-area')).toBeVisible();
  await expect(page.getByLabel('¿Sobre qué es tu consulta?')).toHaveAttribute('aria-invalid', 'true');
});

test('llamada sin teléfono: error accesible y no se envía nada', async ({ page }) => {
  await rellenar(page, { telefono: '' });
  await page.getByRole('button', { name: 'Enviar mi consulta' }).click();
  await expect(page.locator('#err-telefono')).toContainText('necesitamos tu teléfono');
  await expect(page.getByLabel(/^Teléfono/)).toHaveAttribute('aria-describedby', 'err-telefono');
  expect(await registro(page)).toEqual([]);
});

test('WhatsApp sin teléfono y correo inválido también se piden antes de enviar', async ({ page }) => {
  await rellenar(page, { preferencia: 'WhatsApp', telefono: '' });
  await page.getByRole('button', { name: 'Enviar mi consulta' }).click();
  await expect(page.locator('#err-telefono')).toContainText('WhatsApp');
  await page.getByRole('radio', { name: 'Correo' }).check();
  await page.getByLabel(/^Correo electrónico/).fill('esto-no-es-un-correo');
  await page.getByRole('button', { name: 'Enviar mi consulta' }).click();
  await expect(page.locator('#err-email')).toContainText('no parece una dirección válida');
  expect(await registro(page)).toEqual([]);
});

test('envío correcto: llega una sola consulta con área y responsable, y se confirma sin salir de la página', async ({ page }) => {
  await rellenar(page);
  await esperarTiempoMinimo(page);
  const boton = page.getByRole('button', { name: 'Enviar mi consulta' });
  await boton.dblclick(); // el doble clic no debe duplicar el envío
  await expect(page.getByRole('heading', { name: 'Hemos recibido tu consulta' })).toBeVisible();
  await expect(page).toHaveURL(/\/contacto\/$/);
  const r = await registro(page);
  expect(r).toHaveLength(1);
  expect(r[0]).toMatchObject({ 'form-name': 'contacto', area: 'Transporte y logística', responsable: 'Juan José Farinós Ibáñez (607 527 719)', preferencia: 'Llamada' });
});

test('Laboral: se indica y se asigna al área laboral', async ({ page }) => {
  await rellenar(page, { area: 'Laboral' });
  await page.getByLabel('Soy la persona trabajadora').check();
  await expect(page.getByText('Los asuntos laborales los atiende el área laboral')).toBeVisible();
  await esperarTiempoMinimo(page);
  await page.getByRole('button', { name: 'Enviar mi consulta' }).click();
  await expect(page.getByText('La revisará el área laboral')).toBeVisible();
  expect((await registro(page))[0]).toMatchObject({ 'form-name': 'contacto-laboral', responsable: 'Lucía López (649 181 290)' });
});

test('fallo de red: avisa, conserva los datos y el reintento entrega una sola vez', async ({ page }) => {
  await rellenar(page);
  await esperarTiempoMinimo(page);
  await page.route('**/api/consulta', (r) => r.abort('internetdisconnected'), { times: 1 });
  await page.getByRole('button', { name: 'Enviar mi consulta' }).click();
  await expect(page.locator('.form-fail')).toContainText('No hemos podido recibir tu consulta');
  await expect(page.getByLabel('Nombre')).toHaveValue('Persona de prueba');
  await page.getByRole('button', { name: 'Reintentar el envío' }).click();
  await expect(page.getByRole('heading', { name: 'Hemos recibido tu consulta' })).toBeVisible();
  expect(await registro(page)).toHaveLength(1);
});

test('si falla el envío del aviso no se muestra éxito', async ({ page }) => {
  await page.request.post('/__mock-forms/fallar?n=1');
  await rellenar(page);
  await esperarTiempoMinimo(page);
  await page.getByRole('button', { name: 'Enviar mi consulta' }).click();
  await expect(page.locator('.form-fail')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Hemos recibido tu consulta' })).toHaveCount(0);
  expect(await registro(page)).toEqual([]);
});

test.describe('sin JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('el formulario clásico también entrega la consulta y lleva a /gracias/', async ({ page }) => {
    await page.goto('/contacto/');
    await rellenar(page);
    await page.getByRole('button', { name: 'Enviar mi consulta' }).click();
    await expect(page).toHaveURL(/\/gracias\/$/);
    expect(await registro(page)).toHaveLength(1);
  });
});
