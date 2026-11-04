// #51 · Fijar un plazo desde el hilo del expediente con su documento de origen, verificarlo y cambiarlo.
import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { TOTP } from 'otpauth';
import { entrar, pdfFicticio } from './util';

const raiz = join(import.meta.dirname, '..', '..');
const suf = randomUUID().slice(0, 8);
const A = { email: `plazos.${suf}@ejemplo.test`, clave: `clave-plazos-${suf}` };
const node = (args: string[]) => execFileSync(process.execPath, ['--env-file=../.env.local', '--experimental-strip-types', ...args], { cwd: raiz, encoding: 'utf8' });

async function activar(p: Page) {
  const salida = node(['scripts/personal-invitar.ts', `--email=${A.email}`, '--nombre=Abogada Plazos', '--rol=abogado']);
  await p.goto(salida.match(/https?:\/\/\S+invitacion\/\?token=[A-Za-z0-9_-]{43}/)![0]);
  await p.getByLabel('Contraseña', { exact: true }).fill(A.clave);
  await p.getByLabel('Repite la contraseña').fill(A.clave);
  await p.getByRole('button', { name: 'Activar mi cuenta' }).click();
  await entrar(p, A.email, A.clave);
  await p.getByLabel('Confirma tu contraseña').fill(A.clave);
  await p.getByRole('button', { name: 'Continuar' }).click();
  const totp = (await p.locator('[data-secreto]').getAttribute('data-secreto'))!;
  await p.getByLabel(/Escribe el código de seis cifras/).fill(new TOTP({ secret: totp }).generate());
  await p.getByRole('button', { name: 'Activar' }).click();
  await expect(p).toHaveURL(/\/admin\/$/);
}

test('Plazo desde el expediente: origen documental, verificación expresa, cambio de fecha auditado', async ({ page: p, browser }) => {
  await activar(p);
  await p.goto('/admin/clientes/nuevo/');
  await p.getByLabel('Nombre y apellidos').fill('Paula Ficticia Plazos');
  await p.getByLabel('Correo electrónico del cliente').fill(`paula.${suf}@ejemplo.test`);
  await p.getByLabel('Abrir expediente (opcional)').fill('Despido ficticio con plazo');
  await p.getByRole('button', { name: 'Dar de alta' }).click();
  await p.getByRole('link', { name: 'Abrir el expediente' }).click();
  await p.waitForURL(/\/admin\/expedientes\/[0-9a-f-]{36}\/$/);

  const b64 = (await pdfFicticio(browser, 'Notificación ficticia')).toString('base64');
  await p.evaluate((b64) => {
    const dt = new DataTransfer();
    dt.items.add(new File([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], 'notificacion-ficticia.pdf', { type: 'application/pdf' }));
    window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, b64);
  await expect(p.locator('[data-subida="notificacion-ficticia.pdf"]')).toContainText('Guardado');
  await p.reload();

  // Dos clics: modo tarea, escribir y guardar (fecha, origen y «es un plazo» en la misma línea)
  await p.getByRole('button', { name: 'Tarea o plazo' }).click();
  await p.getByLabel('Escribe en el expediente').fill('Presentar papeleta de conciliación');
  await p.getByLabel('Origen (documento o notificación, opcional)').fill('notificacion-ficticia.pdf');
  await p.getByLabel('Es un plazo (pendiente de verificar)').check();
  await p.getByRole('button', { name: 'Crear tarea' }).click();
  const t = p.locator('[data-tarea="Presentar papeleta de conciliación"]');
  await expect(t).toContainText('Plazo pendiente de verificar');
  await expect(t.getByRole('link', { name: /notificacion-ficticia\.pdf/ })).toBeVisible();

  await t.getByRole('button', { name: 'Verificar plazo' }).click();
  await t.getByLabel('He comprobado el cómputo y la fecha es correcta').check();
  await t.getByRole('button', { name: 'Confirmar verificación' }).click();
  await expect(t).toContainText('Plazo verificado');
  await expect(p.locator('[data-clase="evento"]', { hasText: 'Plazo «Presentar papeleta de conciliación» verificado' })).toBeVisible();

  await t.getByRole('button', { name: 'Cambiar fecha' }).click();
  const nueva = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(new Date(Date.now() + 5 * 86400e3));
  await t.getByLabel('Nueva fecha').fill(nueva);
  await t.getByRole('button', { name: 'Cambiar' }).click();
  await expect(t).toContainText('Plazo pendiente de verificar');
  await expect(p.locator('[data-clase="evento"]', { hasText: 'hay que volver a verificar el plazo' })).toBeVisible();

  await p.reload();
  await expect(t).toContainText('Plazo pendiente de verificar');
  await p.goto('/admin/agenda/?vista=verificar');
  await expect(p.getByText('Presentar papeleta de conciliación')).toBeVisible();
});
