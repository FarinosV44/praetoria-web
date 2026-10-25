import { expect, test, type Page } from '@playwright/test';

// #9: medición con la build con NEXT_PUBLIC_GA_ID (out-ga). Google no se contacta: la petición se aborta y los
// eventos se leen del dataLayer que rellena gtag. Comprueba consentimiento aceptado y rechazado, reenvíos y /gracias/.
type Ev = { n: string; p: Record<string, string> };
const eventos = (page: Page): Promise<Ev[]> =>
  page.evaluate(() =>
    ((window as unknown as { dataLayer?: IArguments[] }).dataLayer ?? [])
      .map((a) => Array.from(a))
      .filter((a) => a[0] === 'event')
      .map((a) => ({ n: a[1] as string, p: (a[2] ?? {}) as Record<string, string> })),
  );
const de = (evs: Ev[], n: string) => evs.filter((e) => e.n === n);
const registro = async (page: Page) => (await page.request.get('/__mock-forms/registro')).json();

// tel: y wa.me no deben navegar durante la prueba; el clic sigue llegando al listener de la medición
const sinNavegarFuera = (page: Page) =>
  page.evaluate(() =>
    window.addEventListener(
      'click',
      (e) => {
        const a = (e.target as Element).closest('a');
        if (a && /^(tel:|https:\/\/wa\.me)/.test(a.getAttribute('href') ?? '')) e.preventDefault();
      },
      true,
    ),
  );

async function recorrido(page: Page, eleccion: 'Aceptar' | 'Rechazar') {
  await page.route('**/googletagmanager.com/**', (r) => r.abort());
  await page.request.post('/__mock-forms/reset');
  await page.goto('/impugnar-despido/?utm_source=Google&utm_medium=cpc&utm_campaign=prueba&email=ana@example.com');
  await page.getByRole('dialog', { name: 'Aviso de cookies' }).getByRole('button', { name: eleccion }).click();
  await sinNavegarFuera(page);
  await page.locator('.page-head a[href="tel:+34649181290"]').click();
  await page.locator('.cta a[href^="https://wa.me/"]').click();
  await page.locator('.page-head').getByRole('link', { name: 'Solicitar revisión de mi despido' }).click();
  await expect(page).toHaveURL(/\/contacto\/\?servicio=laboral-despidos$/);

  await page.getByLabel('Nombre', { exact: true }).fill('Persona de prueba');
  await page.getByLabel('Soy la persona trabajadora').check();
  await page.getByLabel('¿Qué ha pasado y qué te gustaría conseguir?').fill('Me han despedido y quiero revisar la carta.');
  await page.getByRole('radio', { name: 'Llamada' }).check();
  await page.getByLabel(/^Teléfono/).fill('600 000 000');
  await page.getByLabel(/política de privacidad/).check();
  await page.waitForTimeout(3100);
  // Primer intento: Netlify Forms falla -> no hay conversión. Reintento: una sola conversión.
  await page.request.post('/__mock-forms/fallar?n=1');
  await page.getByRole('button', { name: 'Enviar mi consulta' }).click();
  await expect(page.getByRole('button', { name: 'Reintentar el envío' })).toBeVisible();
  expect(de(await eventos(page), 'form_success')).toHaveLength(0);
  await page.getByRole('button', { name: 'Reintentar el envío' }).click();
  await expect(page.getByRole('heading', { name: 'Hemos recibido tu consulta' })).toBeVisible();
}

test('aceptado: eventos del embudo sin datos personales, una conversión y atribución en la consulta', async ({ page }) => {
  await recorrido(page, 'Aceptar');
  const evs = await eventos(page);
  expect(de(evs, 'phone_click')[0]?.p).toMatchObject({ destino: 'laboral', landing: '/impugnar-despido/', ubicacion: 'cabecera_pagina' });
  expect(de(evs, 'whatsapp_click')[0]?.p).toMatchObject({ destino: 'laboral', ubicacion: 'banda_final' });
  expect(de(evs, 'cta_click')[0]?.p).toMatchObject({ destino: 'formulario', servicio: 'laboral-despidos', area: 'laboral', landing: '/impugnar-despido/' });
  expect(de(evs, 'form_start')).toHaveLength(1);
  expect(de(evs, 'form_success')).toHaveLength(1);
  expect(de(evs, 'form_success')[0]?.p).toEqual({ area: 'laboral', servicio: 'laboral-despidos' });
  const todo = JSON.stringify(evs);
  for (const pii of ['Persona', '600', '@', 'despedido']) expect(todo).not.toContain(pii);

  const r = await registro(page);
  expect(r).toHaveLength(1);
  expect(r[0]).toMatchObject({ origen: '/impugnar-despido/', landing: '/impugnar-despido/', utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'prueba' });

  // Ver un área o un servicio genera service_view (navegación interna, ya con consentimiento)
  await page.locator('.crumbs a[href="/"]').click();
  await page.locator('.page-home .area-card--destacada h3 a[href="/abogado-laboralista-valencia/"]').click();
  await expect(page).toHaveURL(/abogado-laboralista-valencia/);
  await expect.poll(async () => de(await eventos(page), 'service_view').at(-1)?.p).toMatchObject({ tipo_pagina: 'area', area: 'laboral' });
});

test('rechazado: no se carga Analytics ni se mide nada, y la consulta llega igual (sin campaña)', async ({ page }) => {
  await recorrido(page, 'Rechazar');
  expect(await page.evaluate(() => !!document.querySelector('script[src*="googletagmanager"]'))).toBe(false);
  expect(await eventos(page)).toEqual([]);
  const r = await registro(page);
  expect(r).toHaveLength(1);
  expect(r[0]).toMatchObject({ origen: '/impugnar-despido/', landing: '', utm_source: '', utm_medium: '', utm_campaign: '' });
});

test('visitar /gracias/ directamente no cuenta como conversión', async ({ page }) => {
  await page.route('**/googletagmanager.com/**', (r) => r.abort());
  await page.goto('/');
  await page.getByRole('dialog', { name: 'Aviso de cookies' }).getByRole('button', { name: 'Aceptar' }).click();
  await page.goto('/gracias/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(de(await eventos(page), 'form_success')).toHaveLength(0);
});
