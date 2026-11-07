// #81 · Equipo y asignaciones: la superadministración invita empleados desde /admin/equipo, les asigna un
// expediente, encarga una tarea; la empleada solo ve ese asunto, la completa con su siguiente paso; otro
// empleado asume el asunto (relevo) y recupera el contexto; al retirar o desactivar, el acceso se corta.
import { test, expect, type Page, type Browser } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { TOTP } from 'otpauth';
import { entrar, esperarCorreo, enlace as enlaceDe, pdfFicticio } from './util';

const raiz = join(import.meta.dirname, '..', '..');
const suf = randomUUID().slice(0, 8);
type Cuenta = { nombre: string; email: string; clave: string; totp?: string };
const SA: Cuenta = { nombre: 'Titular Equipo', email: `titular.${suf}@ejemplo.test`, clave: `clave-titular-${suf}` };
const ELENA: Cuenta = { nombre: `Elena Empleada ${suf}`, email: `elena.${suf}@ejemplo.test`, clave: `clave-elena-${suf}` };
const ESTEBAN: Cuenta = { nombre: `Esteban Relevo ${suf}`, email: `esteban.${suf}@ejemplo.test`, clave: `clave-esteban-${suf}` };
const e: { x?: string; y?: string; docY?: string } = {};
test.describe.configure({ mode: 'serial' });

const node = (args: string[]) => execFileSync(process.execPath, ['--env-file=../.env.local', '--experimental-strip-types', ...args], { cwd: raiz, encoding: 'utf8' });

/** Activa una cuenta del personal con su enlace y deja configurado el doble factor. */
async function activar(p: Page, url: string, c: Cuenta) {
  await p.goto(url);
  await p.getByLabel('Contraseña', { exact: true }).fill(c.clave);
  await p.getByLabel('Repite la contraseña').fill(c.clave);
  await p.getByRole('button', { name: 'Activar mi cuenta' }).click();
  await entrar(p, c.email, c.clave);
  await p.getByLabel('Confirma tu contraseña').fill(c.clave);
  await p.getByRole('button', { name: 'Continuar' }).click();
  c.totp = (await p.locator('[data-secreto]').getAttribute('data-secreto'))!;
  await p.getByLabel(/Escribe el código de seis cifras/).fill(new TOTP({ secret: c.totp }).generate());
  await p.getByRole('button', { name: 'Activar' }).click();
  await expect(p).toHaveURL(/\/admin\/$/);
}

async function entrarComo(p: Page, c: Cuenta) {
  await entrar(p, c.email, c.clave);
  await expect(p).toHaveURL(/\/entrar\/codigo\/$/);
  await p.getByLabel('Código').fill(new TOTP({ secret: c.totp! }).generate());
  await p.getByRole('button', { name: 'Verificar' }).click();
  await expect(p).toHaveURL(/\/admin\/$/);
}

async function nuevoCliente(p: Page, nombre: string, asunto: string) {
  await p.goto('/admin/clientes/nuevo/');
  await p.getByLabel('Nombre y apellidos').fill(nombre);
  await p.getByLabel('Correo electrónico del cliente').fill(`${nombre.split(' ')[0]!.toLowerCase()}.${suf}@ejemplo.test`);
  await p.getByLabel('Abrir expediente (opcional)').fill(asunto);
  await p.getByRole('button', { name: 'Dar de alta' }).click();
  await p.getByRole('link', { name: 'Abrir el expediente' }).click();
  await p.waitForURL(/\/admin\/expedientes\/[0-9a-f-]{36}\/$/);
  return p.url().match(/expedientes\/([0-9a-f-]{36})/)![1]!;
}

async function invitar(p: Page, c: Cuenta) {
  await p.goto('/admin/equipo/');
  await p.getByLabel('Nombre').fill(c.nombre);
  await p.getByLabel('Correo').fill(c.email);
  await p.getByLabel('Abogado/a').check();
  await p.getByRole('button', { name: 'Invitar' }).click();
  await expect(p.getByText('Le hemos enviado el enlace por correo.')).toBeVisible();
  const url = await p.locator('[data-enlace-empleado]').inputValue();
  const correo = await esperarCorreo(c.email, /Tu acceso al panel de Praetoria/);
  expect(enlaceDe(correo.text)).toBe(url);
  return url;
}

async function soltarPdf(p: Page, browser: Browser, nombre: string) {
  const b64 = (await pdfFicticio(browser, nombre)).toString('base64');
  await p.evaluate(({ nombre, b64 }) => {
    const dt = new DataTransfer();
    dt.items.add(new File([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], nombre, { type: 'application/pdf' }));
    window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, { nombre, b64 });
  await expect(p.locator(`[data-subida="${nombre}"]`)).toContainText('Guardado');
}

test('1. La superadministración invita a dos empleados y abre dos asuntos', async ({ page: p, browser }) => {
  const salida = node(['scripts/personal-invitar.ts', `--email=${SA.email}`, `--nombre=${SA.nombre}`, '--rol=administrador']);
  await activar(p, salida.match(/https?:\/\/\S+invitacion\/\?token=[A-Za-z0-9_-]{43}/)![0], SA);
  e.x = await nuevoCliente(p, 'Xenia Ficticia', 'Asunto X ficticio');
  e.y = await nuevoCliente(p, 'Yago Ficticio', 'Asunto Y ficticio');
  await soltarPdf(p, browser, 'confidencial-y.pdf');
  await p.reload();
  e.docY = (await p.locator('[data-documento="confidencial-y.pdf"] a').first().getAttribute('href'))!;
  await p.goto(`/admin/expedientes/${e.x}/`);
  await p.getByLabel('Escribe en el expediente').fill('Nota de contexto: la clienta pide prudencia con las fechas.');
  await p.getByRole('button', { name: 'Guardar' }).click();
  await expect(p.getByRole('status')).toContainText('Guardado en el expediente');

  const elena = await invitar(p, ELENA);
  const esteban = await invitar(p, ESTEBAN);
  await expect(p.locator(`[data-empleado="${ELENA.email}"]`)).toContainText('Invitación pendiente');
  for (const [url, c] of [[elena, ELENA], [esteban, ESTEBAN]] as const) {
    const ctx = await browser.newContext();
    await activar(await ctx.newPage(), url, c);
    await ctx.close();
  }
});

test('2. Sin asignación, la empleada no ve ningún asunto ni por URL, documento ni búsqueda', async ({ page: p }) => {
  await entrarComo(p, ELENA);
  await expect(p.locator('[data-bloque="asuntos"]')).toContainText('No tienes asuntos asignados.');
  expect((await p.goto(`/admin/expedientes/${e.x}/`))!.status()).toBe(404);
  expect((await p.goto(`/admin/solicitudes/${e.y}/`))!.status()).toBe(404);
  expect((await p.request.get(e.docY!)).status()).toBe(404);
  await p.goto(`/admin/buscar/?q=Ficticia`);
  await expect(p.locator('[data-bloque="asuntos"]')).toContainText('Ninguno');
  await expect(p.locator('[data-bloque="clientes"]')).toContainText('Ninguno');
  await expect(p.getByRole('link', { name: 'Equipo' })).toHaveCount(0);
  expect((await p.goto('/admin/equipo/'))!.url()).toMatch(/\/admin\/$/);
});

test('3. Se le asigna exactamente el asunto X y una tarea; nada más', async ({ page: p }) => {
  await entrarComo(p, SA);
  await p.goto(`/admin/expedientes/${e.x}/`);
  await p.getByRole('button', { name: '+ Persona' }).click();
  await p.getByLabel('Añadir al asunto').fill(ELENA.nombre);
  await p.getByRole('button', { name: 'Añadir' }).click();
  await expect(p.locator(`[data-miembro="${ELENA.nombre}"]`)).toBeVisible();
  await p.getByRole('button', { name: 'Tarea o plazo' }).click();
  await p.getByLabel('Escribe en el expediente').fill('Preparar borrador de demanda ficticia');
  await p.getByLabel('Para (opcional)').fill(ELENA.nombre);
  await p.getByRole('button', { name: 'Crear tarea' }).click();
  await expect(p.locator('[data-tarea="Preparar borrador de demanda ficticia"]')).toContainText(`responsable: ${ELENA.nombre}`);
  await expect(p.locator('[data-clase="evento"]', { hasText: 'encargada a' })).toBeVisible();
});

test('4. La empleada (móvil) ve su trabajo, completa la tarea con el siguiente paso; Y sigue cerrado', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  await entrarComo(p, ELENA);
  await expect(p.locator('[data-bloque="asuntos"]')).toContainText('Asunto X ficticio');
  await expect(p.locator('[data-bloque="hoy"], [data-bloque="proximas"]').filter({ hasText: 'Preparar borrador' })).toHaveCount(1);
  await p.locator('[data-bloque="asuntos"]').getByRole('link', { name: 'Asunto X ficticio' }).click();
  await expect(p.locator('[data-clase="nota"]', { hasText: 'Nota de contexto: la clienta pide prudencia' })).toBeVisible();
  const tarea = p.locator('[data-tarea="Preparar borrador de demanda ficticia"]');
  await tarea.getByRole('button', { name: 'Marcar hecha' }).click();
  await tarea.getByLabel('Resultado o siguiente paso').fill('Borrador hecho; siguiente paso: revisarlo con la clienta');
  await tarea.getByRole('button', { name: 'Hecha' }).click();
  await expect(p.locator('[data-clase="evento"]', { hasText: 'hecha — Borrador hecho; siguiente paso' })).toBeVisible();
  // Lo demás sigue fuera de su alcance
  expect((await p.goto(`/admin/expedientes/${e.y}/`))!.status()).toBe(404);
  expect((await p.request.get(e.docY!)).status()).toBe(404);
  await ctx.close();
});

test('5. Relevo: Esteban asume el asunto y recupera el contexto; Elena sale y pierde el acceso', async ({ page: p, browser }) => {
  await entrarComo(p, SA);
  await p.goto(`/admin/expedientes/${e.x}/`);
  await p.getByRole('button', { name: '+ Persona' }).click();
  await p.getByLabel('Añadir al asunto').fill(ESTEBAN.nombre);
  await p.getByRole('button', { name: 'Añadir' }).click();
  await p.locator(`[data-miembro="${ESTEBAN.nombre}"]`).getByRole('button', { name: 'Hacer responsable' }).click();
  await expect(p.locator(`[data-miembro="${ESTEBAN.nombre}"]`)).toContainText('responsable');

  const ctx = await browser.newContext();
  const q = await ctx.newPage();
  await entrarComo(q, ESTEBAN);
  await q.getByRole('link', { name: 'Asunto X ficticio' }).first().click();
  await q.getByText('Continuar este asunto').click();
  const relevo = q.locator('[data-relevo]');
  await expect(relevo).toContainText('Nota de contexto: la clienta pide prudencia');
  await expect(relevo).toContainText('No hay tareas pendientes');
  await expect(q.locator('[data-clase="evento"]', { hasText: 'siguiente paso: revisarlo con la clienta' })).toBeVisible();
  // Como responsable, gestiona su equipo: retira a Elena
  await q.locator(`[data-miembro="${ELENA.nombre}"]`).getByRole('button', { name: 'Quitar' }).click();
  await expect(q.locator(`[data-miembro="${ELENA.nombre}"]`)).toHaveCount(0);

  const ctxE = await browser.newContext();
  const pe = await ctxE.newPage();
  await entrarComo(pe, ELENA);
  expect((await pe.goto(`/admin/expedientes/${e.x}/`))!.status()).toBe(404);
  await ctxE.close();

  // Desactivar a Esteban corta su sesión abierta
  await p.goto('/admin/equipo/');
  await p.locator(`[data-empleado="${ESTEBAN.email}"]`).getByRole('button', { name: 'Desactivar acceso' }).click();
  await expect(p.locator(`[data-empleado="${ESTEBAN.email}"]`)).toContainText('Desactivado');
  await q.goto(`/admin/expedientes/${e.x}/`);
  await expect(q).toHaveURL(/\/entrar\//);
  await ctx.close();
});
