import { expect, test } from '@playwright/test';

// #28: imágenes editoriales. Nada de oficinas vacías fuera de «El despacho», fotos con dimensiones
// (sin saltos de maquetación) y blog con imagen destacada, índice y bloque DeCA solo donde toca.
const oficina = 'img[src*="/media/v2/"], img[src*="detalle-madera"], source[srcset*="/media/v2/"]';

for (const ruta of ['/', '/abogado-laboralista-valencia/', '/impugnar-despido/', '/logistica-y-transporte-internacional/', '/derecho-civil/', '/abogado-el-puig/']) {
  test(`sin fotos de las instalaciones en ${ruta}`, async ({ page }) => {
    await page.goto(ruta);
    expect(await page.locator(oficina).count()).toBe(0);
    // Toda imagen de contenido declara sus dimensiones
    for (const img of await page.locator('main img').all()) {
      expect(await img.getAttribute('width')).toBeTruthy();
      expect(await img.getAttribute('height')).toBeTruthy();
    }
  });
}

test('«El despacho» muestra como máximo dos fotos de las instalaciones', async ({ page }) => {
  await page.goto('/el-despacho/');
  expect(await page.locator(oficina).count()).toBeLessThanOrEqual(2);
});

test('portada: imagen principal con alt descriptivo y prioridad de carga', async ({ page }) => {
  await page.goto('/');
  const img = page.locator('.portada__media img');
  await expect(img).toHaveAttribute('fetchpriority', 'high');
  expect((await img.getAttribute('alt'))!.length).toBeGreaterThan(20);
});

test('artículo de guía DeCA: imagen de contexto, índice y bloque DeCA con el logotipo oficial', async ({ page }) => {
  await page.goto('/deca-obligatorio-en-2026-guia-legal-para-transportistas-y-cargadores/');
  await expect(page.locator('.post-figura img')).toBeVisible();
  await expect(page.locator('.post-figura img')).not.toHaveAttribute('src', /deca-/);
  await expect(page.locator('.post-indice a').first()).toHaveAttribute('href', /^#/);
  await expect(page.locator('.deca-bloque img[src="/media/deca/deca-profesional-logo.png"]')).toBeVisible();
  const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
  const post = ld.map((t) => JSON.parse(t)).find((j) => j['@type'] === 'BlogPosting');
  expect(post.image[0].url).toMatch(/\/media\/ed\/.+\.webp$/);
});

test('artículo de producto DeCA: fotografía de contexto con crédito, no una captura de pantalla', async ({ page }) => {
  await page.goto('/aplicacion-movil-para-generar-deca/');
  await expect(page.locator('.post-figura img')).toHaveAttribute('src', /\/media\/ed\//);
  await expect(page.locator('.post-figura img')).not.toHaveAttribute('src', /\/media\/ed\/deca-/);
  await expect(page.locator('.post-figura figcaption')).toContainText('Unsplash');
});

test('artículos sin relación con DeCA no muestran el bloque DeCA', async ({ page }) => {
  for (const ruta of ['/despido-valencia-que-hacer/', '/herencia-que-hacer/', '/impagos-transporte-reclamar-factura/']) {
    await page.goto(ruta);
    await expect(page.locator('.deca-bloque')).toHaveCount(0);
  }
});

test('tablas del blog dentro de un contenedor desplazable en móvil', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/deca-para-empresas-cargadoras-obligaciones-del-departamento-de-logistica-y-como-cumplir-en-2026/');
  await expect(page.locator('.prose .tabla table').first()).toBeAttached();
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(ancho).toBeLessThanOrEqual(375);
});

test('recreaciones IA personalizadas: discretas y nunca en la portada (#28 §8)', async ({ page }) => {
  await page.goto('/el-despacho/');
  await expect(page.locator('.foto-secundaria img')).toBeVisible();
  await expect(page.locator('.foto-secundaria figcaption')).toHaveCount(0); // sin pie, por decisión del propietario (25/10/2026)
  await page.goto('/');
  expect(await page.locator('img[src*="personalizad"], img[src*="estrategia-revision-dossier"], img[src*="analisis-documentacion-caso"]').count()).toBe(0);
  await page.goto('/derecho-mercantil/');
  await expect(page.locator('.area-head__media img')).toHaveAttribute('src', /negociacion-mesa-reuniones/);
});
