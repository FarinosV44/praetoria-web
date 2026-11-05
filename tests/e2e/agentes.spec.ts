import { expect, test } from '@playwright/test';

test('la portada registra las herramientas de WebMCP al cargar', async ({ page }) => {
  await page.addInitScript(() => {
    const nombres: string[] = [];
    Object.assign(window, { __herramientas: nombres });
    Object.defineProperty(document, 'modelContext', {
      value: {
        registerTool: async (t: { name: string; description: string; inputSchema: object; execute: unknown }) => {
          if (!t.description || !t.inputSchema || typeof t.execute !== 'function') throw new Error('herramienta incompleta');
          nombres.push(t.name);
        },
      },
    });
  });
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => (window as unknown as { __herramientas: string[] }).__herramientas)).toEqual(['buscar_contenido', 'leer_pagina', 'datos_contacto']);
});

test('sin soporte de WebMCP la página no da errores', async ({ page }) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await page.goto('/');
  await page.waitForLoadState('load');
  await expect(page.locator('footer a[rel="about"]')).toBeVisible();
  expect(errores).toEqual([]);
});

test('la portada enlaza «Sobre nosotros» y declara el despacho como LocalBusiness', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('footer a[rel="about"]')).toHaveAttribute('href', '/el-despacho/');
  const nodos = (await page.locator('script[type="application/ld+json"]').allTextContents()).map((t) => JSON.parse(t));
  expect(nodos.some((n) => [n['@type']].flat().includes('LocalBusiness') && n.address && n.telephone)).toBe(true);
});

test('llms.txt y la tarjeta MCP se publican, sin lo pendiente de revisión', async ({ request }) => {
  const llms = await (await request.get('/llms.txt')).text();
  expect(llms).toMatch(/^# /);
  expect(llms).toContain('https://praetoriaabogados.es/contacto/');
  expect(llms).not.toContain('/gracias/');
  const sitemap = await (await request.get('/sitemap.xml')).text();
  for (const [, url] of llms.matchAll(/\]\((https:\/\/praetoriaabogados\.es\/[^)]*\/)\)/g)) {
    if (!url!.endsWith('/mcp/')) expect(sitemap, `${url} está en llms.txt pero no en el sitemap`).toContain(`<loc>${url}</loc>`);
  }
  const tarjeta = await (await request.get('/.well-known/mcp/server-card.json')).json();
  expect(tarjeta.serverInfo.name).toBeTruthy();
  expect(tarjeta.endpoint).toBe('https://praetoriaabogados.es/mcp/');
  expect(tarjeta.capabilities.tools).toBeTruthy();
});
