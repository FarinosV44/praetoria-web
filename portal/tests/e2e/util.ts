import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import type { Browser, Page } from '@playwright/test';
import { expect } from '@playwright/test';

const buzon = join(import.meta.dirname, '..', '..', '.dev', 'correo');
export type Correo = { to: string; subject: string; text: string; attachments: number; date: string };

export function correos(para: string): Correo[] {
  let fs: string[] = [];
  try { fs = readdirSync(buzon).sort(); } catch { return []; }
  return fs.map((f) => JSON.parse(readFileSync(join(buzon, f), 'utf8')) as Correo).filter((c) => c.to.includes(para));
}

export async function esperarCorreo(para: string, asunto: RegExp, desde = 0): Promise<Correo> {
  for (let i = 0; i < 40; i++) {
    const c = correos(para).filter((x) => asunto.test(x.subject));
    if (c.length > desde) return c[c.length - 1]!;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`No ha llegado el correo «${asunto}» a ${para}`);
}

export const enlace = (texto: string) => texto.match(/https?:\/\/\S+/)![0];

/** Ejecuta el proceso real de envío de avisos (el mismo que el cron), sin esperar a la agrupación. */
export function enviarAvisos() {
  execFileSync(process.execPath, ['--env-file=.env.local', '--experimental-strip-types', 'scripts/notificaciones.ts', '--ya'], { cwd: join(import.meta.dirname, '..', '..') });
}

export async function registrar(page: Page, nombre: string, email: string, clave: string) {
  await page.goto('/crear-cuenta/');
  await page.getByLabel('Nombre y apellidos').fill(nombre);
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(clave);
  await page.getByLabel('Repite la contraseña').fill(clave);
  await page.getByRole('checkbox').check();
  const antes = correos(email).length;
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.getByText('Revisa tu correo')).toBeVisible();
  return antes;
}

export async function verificarYCompletar(page: Page, email: string, previos: number) {
  const c = await esperarCorreo(email, /Confirma tu correo/, previos);
  expect(c.attachments).toBe(0);
  await page.goto(enlace(c.text));
  await expect(page.getByText('Correo confirmado')).toBeVisible();
  await page.getByText('Yo, como particular').click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page).toHaveURL(/\/inicio\/$/);
}

export async function entrar(page: Page, email: string, clave: string) {
  await page.goto('/entrar/');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(clave);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForFunction(() => location.pathname !== '/entrar/' || !!document.querySelector('main [role=alert], main [role=status]'));
}

/** PDF ficticio generado con el propio navegador. */
export async function pdfFicticio(browser: Browser, titulo: string): Promise<Buffer> {
  const p = await browser.newPage();
  await p.setContent(`<h1>${titulo}</h1><p>DOCUMENTO FICTICIO PARA PRUEBAS. No contiene datos reales.</p>`);
  const b = await p.pdf({ format: 'A4' });
  await p.close();
  return b;
}

/** «Fotografía» ficticia (JPEG) generada con el propio navegador. */
export async function fotoFicticia(browser: Browser, texto: string): Promise<Buffer> {
  const p = await browser.newPage({ viewport: { width: 600, height: 800 } });
  await p.setContent(`<body style="background:#ddd;font:30px sans-serif;filter:blur(3px)"><p>${texto}</p><p>FICTICIO</p></body>`);
  const b = await p.screenshot({ type: 'jpeg', quality: 60 });
  await p.close();
  return b;
}
