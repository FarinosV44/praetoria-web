import { expect, test, type Page } from '@playwright/test';

// #7: área Laboral (Lucía López, solo llamadas), recorrido por servicio y mejoras de familia.
const registro = async (page: Page) => (await page.request.get('/__mock-forms/registro')).json();

const SERVICIOS = [
  { pagina: '/impugnar-despido/', id: 'laboral-despidos', nombre: 'Despidos e impugnación', cta: 'Solicitar revisión de mi despido', problema: 'despido' },
  { pagina: '/reclamar-salarios-y-finiquito/', id: 'laboral-cantidades', nombre: 'Salarios y finiquitos', cta: 'Reclamar lo que me deben', problema: 'cantidades' },
  { pagina: '/incapacidad-permanente/', id: 'laboral-incapacidad', nombre: 'Incapacidad permanente', cta: 'Revisar mi caso de incapacidad', problema: 'incapacidad' },
  { pagina: '/accidente-laboral/', id: 'laboral-accidentes', nombre: 'Accidentes laborales y responsabilidad empresarial', cta: 'Consultar mi accidente laboral', problema: 'accidente' },
];

test('Laboral está en la navegación, la portada y el índice de áreas', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.page-home .directory').getByRole('link', { name: /Laboral/ })).toHaveAttribute('href', '/abogado-laboralista-valencia/');
  await page.goto('/areas/');
  await expect(page.getByRole('link', { name: /Laboral/ }).first()).toBeVisible();
  await expect(page.locator('#menu a[href="/abogado-laboralista-valencia/"]')).toHaveCount(1);
});

test('la landing laboral llama a Lucía López, sin WhatsApp a su número, y separa los recorridos', async ({ page }) => {
  await page.goto('/abogado-laboralista-valencia/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Abogados laboralistas en Valencia y El Puig');
  await expect(page.locator('.page-head a[href="tel:+34649181290"]')).toContainText('Lucía López');
  await expect(page.locator('.cta a[href="tel:+34649181290"]')).toBeVisible();
  expect(await page.locator('a[href*="649181290"]:not([href^="tel:"])').count()).toBe(0);
  await expect(page.locator('.journey')).toHaveCount(5);
  await expect(page.locator('.area-note')).toContainText('conflicto de intereses');
  for (const id of ['laboral-altas', 'laboral-acoso', 'laboral-condiciones']) await expect(page.locator(`#${id}`)).toHaveCount(1);
});

for (const s of SERVICIOS) {
  test(`recorrido ${s.nombre}: página → consulta con servicio y problema conservados hasta la recepción`, async ({ page }) => {
    await page.request.post('/__mock-forms/reset');
    await page.goto('/abogado-laboralista-valencia/');
    await page.locator(`.journey a[href="${s.pagina}"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`${s.pagina}$`));
    for (const h of ['Qué revisamos', 'Cómo trabajamos', 'Qué documentación ayuda', 'Preguntas frecuentes', 'Normas citadas']) {
      await expect(page.getByRole('heading', { level: 2, name: h })).toBeVisible();
    }
    await expect(page.locator('.page-head a[href="tel:+34649181290"]')).toBeVisible();
    await page.locator('.page-head').getByRole('link', { name: s.cta }).click();
    await expect(page).toHaveURL(new RegExp(`/contacto/\\?servicio=${s.id}$`));
    await expect(page.locator('#servicio')).toContainText(s.nombre);
    await expect(page.getByLabel('Tipo de problema')).toHaveValue(s.problema);

    await page.getByLabel('Nombre', { exact: true }).fill('Persona de prueba');
    await page.getByLabel('¿Qué ha pasado y qué te gustaría conseguir?').fill('Necesito que revisen mi situación laboral cuanto antes.');
    await page.getByRole('radio', { name: 'Llamada' }).check();
    await page.getByLabel(/^Teléfono/).fill('600 000 000');
    await page.getByLabel(/política de privacidad/).check();
    await page.waitForTimeout(3100);
    // Sin indicar a quién representa no se envía
    await page.getByRole('button', { name: 'Enviar mi consulta' }).click();
    await expect(page.locator('#err-representa')).toBeVisible();
    await page.getByLabel('Soy la persona trabajadora').check();
    await page.getByLabel('Situación actual').selectOption('fuera');
    await page.getByLabel(/Fecha en que te lo comunicaron/).fill('2026-10-20');
    await page.getByRole('button', { name: 'Enviar mi consulta' }).click();
    await expect(page.getByText('La revisará Lucía López')).toBeVisible();
    await expect(page.locator('.form-ok a[href="tel:+34649181290"]')).toBeVisible();
    const r = await registro(page);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ area: 'Laboral', servicio: s.nombre, representa: 'Soy la persona trabajadora', situacion: 'Ya no trabajo en la empresa', fecha: '2026-10-20', responsable: 'Lucía López (649 181 290)' });
  });
}

test('los artículos laborales enlazan con su servicio', async ({ page }) => {
  await page.goto('/despido-valencia-que-hacer/');
  await expect(page.locator('.post-aside a[href="/impugnar-despido/"]')).toBeVisible();
  await page.goto('/baja-laboral-de-larga-duracion-como-dejar-tu-empresa-con-indemnizacion-y-derecho-a-paro/');
  await expect(page.locator('.post-aside a[href="/abogado-laboralista-valencia/#laboral-condiciones"]')).toBeVisible();
});

test('familia: recorridos separan mutuo acuerdo y estudio personalizado', async ({ page }) => {
  await page.goto('/familia/');
  await expect(page.locator('.journey')).toHaveCount(3);
  await expect(page.locator('.journey').nth(0).getByRole('link')).toHaveAttribute('href', '/abogado-divorcio-horta-nord-valencia/#comprobar');
  await expect(page.locator('.journey').nth(1)).toContainText('estudio personalizado');
});

test('cuestionario de divorcio: conserva las respuestas y las pasa al formulario sin usar la URL', async ({ page }) => {
  await page.request.post('/__mock-forms/reset');
  await page.goto('/abogado-divorcio-horta-nord-valencia/');
  const quiz = page.locator('#quiz');
  for (const o of ['Quiero divorciarme o separarme', 'Sí, estamos completamente de acuerdo', 'No', 'No', 'No, nada urgente']) {
    await quiz.locator('fieldset:not([hidden])').getByText(o, { exact: true }).click();
  }
  await expect(quiz.getByText('podría tramitarse como divorcio de mutuo acuerdo')).toBeVisible();
  // Al recargar, el resultado sigue ahí (sessionStorage)
  await page.reload();
  await expect(page.locator('#quiz').getByText('podría tramitarse como divorcio de mutuo acuerdo')).toBeVisible();
  await page.locator('#quiz').getByRole('link', { name: 'Enviarlas con el formulario' }).click();
  await expect(page).toHaveURL(/\/contacto\/\?servicio=familia-divorcio&cuestionario=divorcio$/);
  await expect(page.locator('#cuestionario')).toContainText('mutuo acuerdo con precio cerrado');

  await page.getByLabel('Nombre', { exact: true }).fill('Persona de prueba');
  await page.getByLabel('¿Qué ha pasado y qué te gustaría conseguir?').fill('Queremos divorciarnos de mutuo acuerdo cuanto antes.');
  await page.getByRole('radio', { name: 'Correo' }).check();
  await page.getByLabel(/^Correo electrónico/).fill('prueba@example.com');
  await page.getByLabel(/política de privacidad/).check();
  await page.waitForTimeout(3100);
  await page.getByRole('button', { name: 'Enviar mi consulta' }).click();
  await expect(page.getByRole('heading', { name: 'Hemos recibido tu consulta' })).toBeVisible();
  const r = await registro(page);
  expect(r[0].servicio).toBe('Divorcios y separaciones');
  expect(r[0].cuestionario).toContain('¿Tenéis hijos en común? No');
});

test('cuestionario: «No enviarlo» las quita de la consulta', async ({ page }) => {
  await page.goto('/abogado-divorcio-horta-nord-valencia/');
  await page.evaluate(() =>
    sessionStorage.setItem(
      'praetoria:cuestionario-divorcio',
      JSON.stringify({ necesidad: 'No lo tengo claro', acuerdo: 'No hay acuerdo', hijos: 'Sí, menores o dependientes', bienes: 'No estoy seguro/a', urgente: 'Impago de pensión' }),
    ),
  );
  await page.goto('/contacto/?servicio=familia-divorcio&cuestionario=divorcio');
  await expect(page.locator('#cuestionario')).toContainText('valoración personalizada');
  await page.getByRole('button', { name: 'No enviarlo' }).click();
  await expect(page.locator('#cuestionario')).toHaveCount(0);
});
