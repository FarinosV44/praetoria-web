// #97 · Estilos y exportación: crear y ajustar un estilo (versionado), vista previa, exportar un borrador a Word y
// PDF, y leer el estilo de un Word de referencia subido a la biblioteca. Textos FICTICIOS.
import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import JSZip from 'jszip';
import { TOTP } from 'otpauth';
import { entrar } from './util';

test.describe.configure({ mode: 'serial' });
const raiz = join(import.meta.dirname, '..', '..');
const suf = randomUUID().slice(0, 8);
const SA = { email: `est.sa.${suf}@ejemplo.test`, clave: `clave-est-sa-${suf}`, totp: '' };
const e: { estilo?: string; docx?: Buffer } = {};
const node = (args: string[]) => execFileSync(process.execPath, ['--env-file=../.env.local', '--experimental-strip-types', ...args], { cwd: raiz, encoding: 'utf8' });
const BORRADOR = 'AL JUZGADO (FICTICIO)\n\nHECHOS\n\n1. Hecho ficticio uno.\n\n5. Hecho ficticio dos.\n\nSUPLICO\n\nQue se tenga por presentado este escrito ficticio.';

async function entrarSA(p: Page) {
  await entrar(p, SA.email, SA.clave);
  await p.getByLabel('Código').fill(new TOTP({ secret: SA.totp }).generate());
  await p.getByRole('button', { name: 'Verificar' }).click();
  await expect(p).toHaveURL(/\/admin\/$/);
}

test('1. Crear un estilo, ajustarlo (nueva versión) y ver la muestra en PDF', async ({ page: p }) => {
  const s = node(['scripts/personal-invitar.ts', `--email=${SA.email}`, '--nombre=Titular Estilos', '--rol=administrador']);
  await p.goto(s.match(/https?:\/\/\S+invitacion\/\?token=[A-Za-z0-9_-]{43}/)![0]);
  await p.getByLabel('Contraseña', { exact: true }).fill(SA.clave);
  await p.getByLabel('Repite la contraseña').fill(SA.clave);
  await p.getByRole('button', { name: 'Activar mi cuenta' }).click();
  await entrar(p, SA.email, SA.clave);
  await p.getByLabel('Confirma tu contraseña').fill(SA.clave);
  await p.getByRole('button', { name: 'Continuar' }).click();
  SA.totp = (await p.locator('[data-secreto]').getAttribute('data-secreto'))!;
  await p.getByLabel(/Escribe el código de seis cifras/).fill(new TOTP({ secret: SA.totp }).generate());
  await p.getByRole('button', { name: 'Activar' }).click();
  await expect(p).toHaveURL(/\/admin\/$/);

  await p.goto('/admin/biblioteca/estilos/');
  await p.getByLabel('Nombre del estilo').fill(`Judicial ficticio ${suf}`);
  await p.getByRole('button', { name: 'Crear estilo' }).click();
  await p.waitForURL(/estilos\/[0-9a-f-]{36}\/$/);
  e.estilo = p.url().match(/estilos\/([0-9a-f-]{36})/)![1];
  await p.getByLabel('Arial').check();
  await p.getByLabel('Izquierdo').fill('35');
  await p.getByLabel('1.-, 2.-').check();
  await p.getByLabel(/Firma y datos profesionales/).fill('Letrado ficticio\nColegiado nº 0000');
  await p.getByRole('button', { name: 'Guardar (nueva versión)' }).click();
  await expect(p.getByRole('status')).toContainText('nueva versión');
  await p.reload();
  await expect(p.getByText(/^v2 ·/)).toBeVisible();
  const r = await p.request.get(`/api/escritos/muestra/?estilo=${e.estilo}&formato=pdf`);
  expect(r.status()).toBe(200);
  expect(r.headers()['content-type']).toBe('application/pdf');
  expect((await r.body()).subarray(0, 5).toString()).toBe('%PDF-');
});

test('2. Exportar un borrador a Word con el estilo: formato aplicado, renumerado y sin datos del autor', async ({ page: p }) => {
  await entrarSA(p);
  const r = await p.request.post('/api/escritos/exportar/', { multipart: { texto: BORRADOR, titulo: 'Demanda ficticia', estilo: e.estilo!, formato: 'docx' }, headers: { origin: new URL(p.url()).origin } });
  expect(r.status()).toBe(200);
  expect(r.headers()['content-disposition']).toMatch(/BORRADOR/);
  e.docx = Buffer.from(await r.body());
  const z = await JSZip.loadAsync(e.docx);
  const doc = await z.file('word/document.xml')!.async('string');
  expect(doc).toMatch(/Arial/);
  expect(doc).toMatch(/w:left="198[45]"/);
  expect(doc).toMatch(/1\.- .*2\.- /s);
  expect(doc).toContain('Colegiado nº 0000');
  expect(await z.file('docProps/core.xml')!.async('string')).not.toContain(SA.email);
  const pdf = await p.request.post('/api/escritos/exportar/', { multipart: { texto: BORRADOR, estilo: e.estilo!, formato: 'pdf' }, headers: { origin: new URL(p.url()).origin } });
  expect(pdf.headers()['content-type']).toBe('application/pdf');
});

test('3. Un Word subido a la biblioteca como estilo genera un perfil con su formato (no su texto)', async ({ page: p }) => {
  await entrarSA(p);
  await p.goto('/admin/biblioteca/');
  await p.getByLabel('Archivos para la biblioteca').setInputFiles([{ name: 'referencia-estilo.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: e.docx! }]);
  await expect(p.locator('[data-subida-bib="referencia-estilo.docx"]')).toContainText('guardado');
  await p.locator('[data-subida-bib="referencia-estilo.docx"]').getByRole('link').click();
  await p.waitForURL(/biblioteca\/[0-9a-f-]{36}\/$/);
  await p.getByRole('button', { name: 'Crear estilo a partir de este Word' }).click();
  await p.waitForURL(/estilos\/[0-9a-f-]{36}\/\?detectado=1$/);
  await expect(p.getByText('Formato leído del Word de referencia')).toBeVisible();
  await expect(p.getByLabel('Arial')).toBeChecked();
  await expect(p.getByLabel('Izquierdo')).toHaveValue('35');
  await expect(p.getByLabel(/Firma y datos profesionales/)).toHaveValue('');
});

test('4. Sin sesión no se exporta ni se ve una muestra', async ({ page: p }) => {
  expect((await p.request.get(`/api/escritos/muestra/?estilo=${e.estilo}`)).status()).toBe(401);
  await p.goto('/');
  expect((await p.request.post('/api/escritos/exportar/', { multipart: { texto: BORRADOR }, headers: { origin: new URL(p.url()).origin } })).status()).toBe(401);
});
