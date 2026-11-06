// Abrir expedientes para clientes ya existentes: desde Expedientes, desde la ficha y al intentar duplicar el alta. Datos ficticios.
import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { TOTP } from 'otpauth';
import { entrar } from './util';

test.describe.configure({ mode: 'serial' });
const raiz = join(import.meta.dirname, '..', '..');
const suf = randomUUID().slice(0, 8);
const SA = { email: `abr.sa.${suf}@ejemplo.test`, clave: `clave-abr-sa-${suf}` };
const CLI = { nombre: `Carla Ficticia ${suf}`, email: `carla.abr.${suf}@ejemplo.test` };
const node = (args: string[]) => execFileSync(process.execPath, ['--env-file=../.env.local', '--experimental-strip-types', ...args], { cwd: raiz, encoding: 'utf8' });

async function activar(p: Page) {
  const s = node(['scripts/personal-invitar.ts', `--email=${SA.email}`, '--nombre=Titular Abrir', '--rol=administrador']);
  await p.goto(s.match(/https?:\/\/\S+invitacion\/\?token=[A-Za-z0-9_-]{43}/)![0]);
  await p.getByLabel('Contraseña', { exact: true }).fill(SA.clave);
  await p.getByLabel('Repite la contraseña').fill(SA.clave);
  await p.getByRole('button', { name: 'Activar mi cuenta' }).click();
  await entrar(p, SA.email, SA.clave);
  await p.getByLabel('Confirma tu contraseña').fill(SA.clave);
  await p.getByRole('button', { name: 'Continuar' }).click();
  const totp = (await p.locator('[data-secreto]').getAttribute('data-secreto'))!;
  await p.getByLabel(/Escribe el código de seis cifras/).fill(new TOTP({ secret: totp }).generate());
  await p.getByRole('button', { name: 'Activar' }).click();
  await expect(p).toHaveURL(/\/admin\/$/);
}

test('Abrir expedientes para un cliente que ya existe', async ({ page: p }) => {
  await activar(p);
  // Cliente dado de alta SIN expediente
  await p.goto('/admin/clientes/nuevo/');
  await p.getByLabel('Nombre y apellidos').fill(CLI.nombre);
  await p.getByLabel('Correo electrónico del cliente').fill(CLI.email);
  await p.getByRole('button', { name: 'Dar de alta' }).click();
  await expect(p.getByRole('link', { name: 'Abrir el expediente' })).toHaveCount(0);

  // 1) Desde la pestaña Expedientes → Abrir expediente
  await p.getByRole('navigation', { name: 'Despacho' }).getByRole('link', { name: 'Expedientes', exact: true }).click();
  await p.getByRole('link', { name: '+ Abrir expediente' }).click();
  await p.getByLabel('Buscar cliente').fill(suf);
  await p.getByRole('radio', { name: new RegExp(CLI.nombre) }).check();
  await p.getByLabel('Título del asunto').fill(`Reclamación ficticia A ${suf}`);
  await p.getByRole('button', { name: 'Abrir expediente' }).click();
  await p.waitForURL(/\/admin\/expedientes\/[0-9a-f-]{36}\/$/);
  await expect(p.locator('h1')).toContainText(`Reclamación ficticia A ${suf}`);

  // 2) Desde la ficha del cliente, un segundo expediente
  await p.locator('.expediente-cabecera').getByRole('link', { name: CLI.nombre }).click();
  await expect(p).toHaveURL(/\/admin\/clientes\/[0-9a-f-]{36}\/$/);
  await p.getByLabel('Título del asunto').fill(`Desahucio ficticio B ${suf}`);
  await p.getByRole('button', { name: 'Abrir expediente' }).click();
  await p.waitForURL(/\/admin\/expedientes\/[0-9a-f-]{36}\/$/);
  await expect(p.locator('h1')).toContainText(`Desahucio ficticio B ${suf}`);

  // 3) Intentar dar de alta otra vez el mismo correo ofrece abrirle un expediente
  await p.goto('/admin/clientes/nuevo/');
  await p.getByLabel('Nombre y apellidos').fill(CLI.nombre);
  await p.getByLabel('Correo electrónico del cliente').fill(CLI.email);
  await p.getByRole('button', { name: 'Dar de alta' }).click();
  await expect(p.getByRole('alert').filter({ hasText: 'Ya hay un cliente con ese correo' })).toBeVisible();
  await p.getByRole('link', { name: 'Abrir un expediente para este cliente' }).click();
  await expect(p.getByRole('radio', { name: new RegExp(CLI.nombre) })).toBeChecked();

  // Los dos aparecen en Expedientes agrupados bajo el cliente
  await p.goto(`/admin/expedientes/?q=${suf}`);
  const grupo = p.locator(`[data-grupo="${CLI.nombre}"]`);
  await expect(grupo.locator('[data-expediente]')).toHaveCount(2);
});
