// Acceso del superadministrador de principio a fin: invitación de un solo uso → contraseña → doble factor →
// ficha de cliente con documentos → agenda con avisos → bandeja de avisos → app instalable.
// Se ejecuta después de aceptacion.spec.ts (orden alfabético), que deja un cliente ficticio con documentos.
import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { TOTP } from 'otpauth';
import { entrar } from './util';

const raiz = join(import.meta.dirname, '..', '..');
const sufijo = randomUUID().slice(0, 8);
const ADMIN = { email: `superadmin.${sufijo}@ejemplo.test`, clave: `clave-superadmin-${sufijo}` };
const estado: { enlace?: string; totp?: string } = {};
test.describe.configure({ mode: 'serial' });

const node = (args: string[]) => execFileSync(process.execPath, ['--env-file=../.env.local', '--experimental-strip-types', ...args], { cwd: raiz, encoding: 'utf8' });

async function entrarAdmin(p: Page) {
  await entrar(p, ADMIN.email, ADMIN.clave);
  await expect(p).toHaveURL(/\/entrar\/codigo\/$/);
  await p.getByLabel('Código').fill(new TOTP({ secret: estado.totp! }).generate());
  await p.getByRole('button', { name: 'Verificar' }).click();
  await expect(p).toHaveURL(/\/admin\/$/);
}

test('1. La invitación crea la cuenta del superadministrador, de un solo uso', async ({ page: p }) => {
  const salida = node(['scripts/personal-invitar.ts', `--email=${ADMIN.email}`, '--nombre=Titular de Pruebas', '--rol=administrador']);
  estado.enlace = salida.match(/https?:\/\/\S+invitacion\/\?token=[A-Za-z0-9_-]{43}/)![0];
  await p.goto(estado.enlace);
  await p.getByLabel('Contraseña', { exact: true }).fill(ADMIN.clave);
  await p.getByLabel('Repite la contraseña').fill(ADMIN.clave);
  await p.getByRole('button', { name: 'Activar mi cuenta' }).click();
  await expect(p.getByText('Cuenta activada.')).toBeVisible();
  await p.goto(estado.enlace);
  await expect(p.getByText(/no es válida, ya se usó o ha caducado/)).toBeVisible();
});

test('2. Primer acceso: obliga a activar el doble factor', async ({ page: p }) => {
  await entrar(p, ADMIN.email, ADMIN.clave);
  await expect(p).toHaveURL(/\/admin\/seguridad\/$/);
  await p.goto('/admin/clientes/');
  await expect(p).toHaveURL(/\/admin\/seguridad\/$/);
  await p.getByLabel('Confirma tu contraseña').fill(ADMIN.clave);
  await p.getByRole('button', { name: 'Continuar' }).click();
  estado.totp = (await p.locator('[data-secreto]').getAttribute('data-secreto'))!;
  await p.getByLabel(/Escribe el código de seis cifras/).fill(new TOTP({ secret: estado.totp }).generate());
  await p.getByRole('button', { name: 'Activar' }).click();
  await expect(p).toHaveURL(/\/admin\/$/);
});

test('3. Ficha del cliente: asuntos y documentos por carpeta, que se abren y descargan', async ({ page: p }) => {
  await entrarAdmin(p);
  await p.getByRole('link', { name: 'Clientes', exact: true }).click();
  await p.getByRole('link', { name: 'Ana Ficticia Prueba' }).first().click();
  await expect(p.getByRole('heading', { name: 'Ana Ficticia Prueba' })).toBeVisible();
  await expect(p.getByText(/Asuntos \(1\)/)).toBeVisible();
  await expect(p.getByText('Documentación del cliente').first()).toBeVisible();
  const ver = p.getByRole('link', { name: 'carta-despido.pdf' });
  const href = (await ver.getAttribute('href'))!;
  const r1 = await p.request.get(href);
  expect(r1.status()).toBe(200);
  expect(r1.headers()['content-disposition']).toMatch(/^inline/);
  const r2 = await p.request.get(href.replace('?ver=1', '?descargar=1'));
  expect(r2.headers()['content-disposition']).toMatch(/^attachment/);
  // Mover a una carpeta
  await p.getByRole('link', { name: 'Revisar' }).first().click();
  const carta = p.locator('[data-requisito="Carta de despido"]');
  await carta.getByLabel('Carpeta').fill('Prueba');
  await carta.getByRole('button', { name: 'Mover' }).click();
  await expect(p.getByRole('status')).toContainText('Movido a la carpeta «Prueba»');
  await expect(p.getByText('Prueba', { exact: true }).first()).toBeVisible();
});

test('4. Agenda: vista judicial con avisos una semana, 24 h y 1 h antes; el motor entrega el aviso vencido', async ({ page: p }) => {
  await entrarAdmin(p);
  await p.goto('/admin/agenda/');
  await p.locator('details', { hasText: 'Nuevo evento' }).evaluate((d) => { (d as HTMLDetailsElement).open = true; });
  await p.getByLabel('Qué', { exact: true }).fill('Vista judicial ficticia');
  await p.getByLabel('Tipo', { exact: true }).selectOption('vista');
  const dentro = new Date(Date.now() + 20 * 86400e3);
  const f = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(dentro);
  await p.getByLabel('Fecha', { exact: true }).fill(f);
  await p.getByLabel('Hora (Madrid)').fill('10:00');
  await p.getByLabel('1 semana antes').check();
  await p.getByLabel('24 horas antes').check();
  await p.getByLabel('1 hora antes').check();
  await p.getByRole('button', { name: 'Guardar y programar avisos' }).click();
  await expect(p.getByRole('status')).toContainText('Evento creado');
  await expect(p.getByText(/1 semana antes · Programado/)).toBeVisible();
  await expect(p.getByText(/24 horas antes · Programado/)).toBeVisible();
  await expect(p.getByText(/1 hora antes · Programado/)).toBeVisible();

  // «Llamar al cliente» dentro de 50 minutos con aviso 1 h antes → aviso ya vencido
  await p.goto('/admin/agenda/');
  await p.locator('details', { hasText: 'Nuevo evento' }).evaluate((d) => { (d as HTMLDetailsElement).open = true; });
  await p.getByLabel('Qué', { exact: true }).fill('Llamar al cliente ficticio');
  await p.getByLabel('Tipo', { exact: true }).selectOption('llamada');
  const pronto = new Date(Date.now() + 50 * 60e3);
  const partes = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(pronto).split(' ');
  await p.getByLabel('Fecha', { exact: true }).fill(partes[0]!);
  await p.getByLabel('Hora (Madrid)').fill(partes[1]!);
  await p.getByLabel('1 hora antes').check();
  await p.getByRole('button', { name: 'Guardar y programar avisos' }).click();
  await expect(p.getByRole('status')).toContainText('Evento creado');
  node(['scripts/agenda.ts']);
  await p.goto('/admin/avisos/');
  const aviso = p.locator('[data-aviso="Llamar al cliente ficticio"]');
  await expect(aviso).toBeVisible();
  await expect(p.getByRole('link', { name: /Avisos 1 sin leer/ })).toBeVisible();
  await aviso.getByRole('button', { name: 'Posponer 1 h' }).click();
  await expect(p.getByRole('status')).toContainText('Aviso pospuesto');
  await expect(p.getByText(/Llamar al cliente ficticio/).last()).toBeVisible();
});

test('5. App instalable: manifiesto, iconos y service worker sin caché de contenido privado', async ({ page: p, request }) => {
  const m = await (await request.get('/admin/manifest.webmanifest')).json();
  expect(m.name).toBe('Praetoria Abogados');
  expect(m.display).toBe('standalone');
  expect(m.icons.some((i: { purpose: string }) => i.purpose === 'maskable')).toBeTruthy();
  for (const i of m.icons) expect((await request.get(i.src)).status()).toBe(200);
  const sw = await (await request.get('/sw.js')).text();
  expect(sw).not.toMatch(/addEventListener\('fetch'/);
  expect(sw).toContain('Tienes un aviso pendiente en Praetoria.');
  await entrarAdmin(p);
  await p.goto('/admin/app/');
  await expect(p.getByRole('heading', { name: '1. Instala Praetoria en tu móvil' })).toBeVisible();
});

test('6. Un cliente no ve la agenda ni registra dispositivos del despacho', async ({ page: p, request }) => {
  const r = await request.post('/api/push/', { headers: { origin: process.env.E2E_BASE_URL ?? 'http://localhost:3100' }, data: { endpoint: 'https://x.test/1', keys: { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) } } });
  expect(r.status()).toBe(401);
  await p.goto('/admin/agenda/');
  await expect(p).toHaveURL(/\/entrar\/$/);
});
