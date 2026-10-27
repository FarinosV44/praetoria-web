// Capturas para revisión visual (no forman parte de la batería; se ejecutan con CAPTURAS=1).
import { test, devices } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { pdfFicticio, registrar, verificarYCompletar } from './util';

test.skip(!process.env.CAPTURAS, 'solo con CAPTURAS=1');
const dir = process.env.CAPTURAS!;

test('capturas móvil', async ({ browser }) => {
  const ctx = await browser.newContext(devices['Pixel 7']);
  const p = await ctx.newPage();
  const email = `capturas.${randomUUID().slice(0, 6)}@ejemplo.test`;
  await p.goto('/entrar/'); await p.screenshot({ path: `${dir}/01-entrar.png`, fullPage: true });
  const n = await registrar(p, 'Carmen Ficticia', email, 'clave-capturas-123');
  await p.screenshot({ path: `${dir}/02-registro-hecho.png`, fullPage: true });
  await verificarYCompletar(p, email, n);
  await p.screenshot({ path: `${dir}/03-inicio-vacio.png`, fullPage: true });
  await p.getByRole('link', { name: 'Iniciar una solicitud' }).click();
  await p.getByRole('button', { name: 'Empezar' }).click();
  await p.screenshot({ path: `${dir}/04-paso1.png`, fullPage: true });
  await p.getByText('Me han despedido').click();
  await p.getByRole('button', { name: 'Guardar y continuar' }).click();
  await p.getByLabel('Cuéntanos qué ha pasado').fill('Me han despedido por causas objetivas y no estoy de acuerdo con la indemnización.');
  await p.getByRole('button', { name: 'Guardar y continuar' }).click();
  await p.getByRole('button', { name: 'Guardar y continuar' }).click();
  await p.screenshot({ path: `${dir}/05-paso4.png`, fullPage: true });
  await p.getByLabel('Confirmo que la información es correcta.').check();
  await p.getByRole('button', { name: 'Enviar solicitud' }).click();
  await p.getByText('Solicitud enviada.').waitFor();
  await p.locator('[data-requisito="Carta de despido"]').getByLabel('Subir archivo para Carta de despido').setInputFiles({ name: 'carta.pdf', mimeType: 'application/pdf', buffer: await pdfFicticio(browser, 'Carta ficticia') });
  await p.getByText('Guardado').waitFor();
  await p.reload();
  await p.screenshot({ path: `${dir}/06-detalle.png`, fullPage: true });
  await p.goto('/inicio/');
  await p.screenshot({ path: `${dir}/07-inicio.png`, fullPage: true });
  await ctx.close();
});
