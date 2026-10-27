// Prueba de aceptación de la primera versión (brief «CLIENT PORTAL FIRST», apartado 9), de principio a
// fin contra la base de datos y el almacenamiento privado reales de la pila local. Todo es ficticio.
import { test, expect, devices, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { TOTP } from 'otpauth';
import { correos, entrar, enlace, enviarAvisos, esperarCorreo, fotoFicticia, pdfFicticio, registrar, verificarYCompletar } from './util';

const id = randomUUID().slice(0, 8);
const A = { nombre: 'Ana Ficticia Prueba', email: `ana.${id}@ejemplo.test`, clave: `clave-de-ana-${id}` };
const B = { nombre: 'Bruno Ficticio Prueba', email: `bruno.${id}@ejemplo.test`, clave: `clave-de-bruno-${id}` };
const LETRADA = { email: 'letrada.pruebas@ejemplo.test', clave: process.env.SEED_PERSONAL_PASSWORD! };
const movil = { ...devices['Pixel 7'] };
const estado: { solicitud?: string; expediente?: string; doc?: string; requisito?: string; totp?: string } = {};

test.describe.configure({ mode: 'serial' });

const tarjeta = (p: Page, titulo: string) => p.locator(`[data-requisito="${titulo}"]`);

async function subir(p: Page, titulo: string, nombre: string, mimeType: string, buffer: Buffer) {
  const t = tarjeta(p, titulo);
  await t.getByLabel(`Subir archivo para ${titulo}`).setInputFiles({ name: nombre, mimeType, buffer });
  await expect(t.getByText('Guardado')).toBeVisible({ timeout: 20_000 });
}

async function entrarLetrada(p: Page) {
  await entrar(p, LETRADA.email, LETRADA.clave);
  if (estado.totp) {
    await expect(p).toHaveURL(/\/entrar\/codigo\/$/);
    await p.getByLabel('Código').fill(new TOTP({ secret: estado.totp }).generate());
    await p.getByRole('button', { name: 'Verificar' }).click();
    await expect(p).toHaveURL(/\/despacho\/$/);
  }
}

test('1. Cliente A se registra desde el móvil, verifica el correo e inicia una solicitud laboral', async ({ browser }) => {
  const ctx = await browser.newContext(movil);
  const p = await ctx.newPage();
  const previos = await registrar(p, A.nombre, A.email, A.clave);
  // Sin verificar no puede entrar
  await entrar(p, A.email, A.clave);
  await expect(p.getByText('Antes de entrar tienes que confirmar tu correo')).toBeVisible();
  await verificarYCompletar(p, A.email, previos);

  await p.getByRole('link', { name: 'Iniciar una solicitud' }).click();
  await p.getByRole('button', { name: 'Empezar' }).click();
  await p.getByText('Me han despedido').click();
  await p.getByRole('button', { name: 'Guardar y continuar' }).click();
  await p.getByLabel('Cuéntanos qué ha pasado').fill('La empresa me entregó ayer una carta de despido disciplinario que no entiendo. Llevo cuatro años.');
  // Guardar borrador, salir y volver: no se pierde nada
  await p.getByRole('button', { name: 'Guardar borrador y salir' }).click();
  await expect(p.getByText('Borrador guardado')).toBeVisible();
  await expect(p.getByText('Borrador', { exact: true })).toBeVisible();
  await p.getByRole('link', { name: 'Me han despedido' }).click();
  await expect(p.getByText('Paso 3 de 4')).toBeVisible();
  await p.getByLabel('¿Quién es la otra parte? (empresa o persona)').fill('Empresa Ficticia de Pruebas, S.L.');
  await p.getByRole('button', { name: 'Guardar y continuar' }).click();
  await expect(p.getByRole('heading', { name: 'Documentación que te pediremos' })).toBeVisible();
  await expect(p.getByText('Carta de despido', { exact: true })).toBeVisible();
  await p.getByLabel('Confirmo que la información es correcta.').check();
  await p.getByRole('button', { name: 'Enviar solicitud' }).click();
  await expect(p.getByText('Solicitud enviada.')).toBeVisible();
  estado.solicitud = p.url().match(/solicitudes\/([0-9a-f-]{36})/)![1];

  // 2. Pide carta, contrato y nóminas; sube carta y nóminas (PDF + foto)
  for (const t of ['Carta de despido', 'Contrato de trabajo', 'Últimas nóminas']) await expect(tarjeta(p, t)).toBeVisible();
  await subir(p, 'Carta de despido', 'carta-despido.pdf', 'application/pdf', await pdfFicticio(browser, 'Carta de despido ficticia'));
  await subir(p, 'Últimas nóminas', 'nomina-septiembre.pdf', 'application/pdf', await pdfFicticio(browser, 'Nómina ficticia septiembre'));
  await subir(p, 'Últimas nóminas', 'foto-nomina-agosto.jpg', 'image/jpeg', await fotoFicticia(browser, 'Nómina agosto'));
  await p.reload();
  await expect(tarjeta(p, 'Carta de despido').getByText('Documento recibido')).toBeVisible();
  await expect(tarjeta(p, 'Últimas nóminas').getByText('Documento recibido')).toBeVisible();
  await expect(tarjeta(p, 'Contrato de trabajo').getByText('Pendiente de aportar')).toBeVisible();

  // 3. El panel indica que falta el contrato
  await p.goto('/inicio/');
  await expect(p.getByText('Nos faltan un documento para estudiar tu asunto.')).toBeVisible();
  await p.goto('/documentacion/');
  await expect(p.getByText('Contrato de trabajo')).toBeVisible();
  await ctx.close();
});

test('2. Validaciones: archivo disfrazado, PDF con JavaScript, sesión caducada', async ({ browser }) => {
  const ctx = await browser.newContext(movil);
  const p = await ctx.newPage();
  await entrar(p, A.email, A.clave);
  await expect(p).toHaveURL(/\/inicio\/$/);
  await p.goto(`/solicitudes/${estado.solicitud}/`);
  const t = tarjeta(p, 'Contrato de trabajo');
  await t.getByLabel('Subir archivo para Contrato de trabajo').setInputFiles({ name: 'contrato.pdf', mimeType: 'application/pdf', buffer: Buffer.from('MZ\x90\x00 esto es un ejecutable disfrazado') });
  await expect(t.getByText(/Formato no admitido/)).toBeVisible();
  const pdfMalo = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog /OpenAction << /S /JavaScript /JS (app.alert(1)) >> >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF');
  await t.getByLabel('Subir archivo para Contrato de trabajo').setInputFiles({ name: 'contrato2.pdf', mimeType: 'application/pdf', buffer: pdfMalo });
  await expect(t.getByText(/elementos activos/)).toBeVisible();
  await expect(t.getByRole('button', { name: 'Reintentar' }).first()).toBeVisible();
  // Sesión caducada
  await ctx.clearCookies();
  const r = await p.evaluate(async () => { const f = new FormData(); f.append('requisito', crypto.randomUUID()); f.append('archivo', new Blob(['x']), 'x.pdf'); return (await fetch('/api/documentos/', { method: 'POST', body: f })).status; });
  expect(r).toBe(401);
  await p.goto('/inicio/');
  await expect(p).toHaveURL(/\/entrar\/$/);
  await ctx.close();
});

test('3. La letrada activa el doble factor, revisa, pide subsanación y un documento adicional', async ({ browser }) => {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await entrarLetrada(p);
  await expect(p).toHaveURL(/\/despacho\/seguridad\/$/);
  await p.getByLabel('Confirma tu contraseña').fill(LETRADA.clave);
  await p.getByRole('button', { name: 'Continuar' }).click();
  estado.totp = (await p.locator('[data-secreto]').getAttribute('data-secreto'))!;
  await p.getByLabel(/Escribe el código de seis cifras/).fill(new TOTP({ secret: estado.totp }).generate());
  await p.getByRole('button', { name: 'Activar' }).click();
  await expect(p).toHaveURL(/\/despacho\/$/);

  await expect(p.getByRole('link', { name: /^SOL-/ }).first()).toBeVisible();
  await p.goto(`/despacho/solicitudes/${estado.solicitud}/`);
  await expect(p.getByText('Empresa Ficticia de Pruebas, S.L.')).toBeVisible();
  await p.getByRole('button', { name: 'Marcar en revisión' }).click();
  await expect(p.getByText('Solicitud marcada en revisión.')).toBeVisible();

  // Abre el documento: se descarga desde el almacenamiento privado tras comprobar permisos
  const foto = p.locator('[data-documento="foto-nomina-agosto.jpg"]');
  const href = await foto.getByRole('link').getAttribute('href');
  estado.doc = href!.match(/documentos\/([0-9a-f-]{36})/)![1];
  const descarga = await p.request.get(href!);
  expect(descarga.status()).toBe(200);
  expect(descarga.headers()['content-type']).toBe('image/jpeg');

  // La foto es ilegible: pide subsanación
  await foto.getByLabel('Motivo de la subsanación').fill('La fotografía no permite leer el documento. Por favor, vuelve a enviarlo.');
  await foto.getByRole('button', { name: 'Pedir subsanación' }).click();
  await expect(p.getByText('Subsanación pedida al cliente.')).toBeVisible();
  // Valida la carta
  await p.locator('[data-documento="carta-despido.pdf"]').getByRole('button', { name: 'Validar documento' }).click();
  await expect(p.getByText('Documento validado.')).toBeVisible();
  // Pide un documento adicional
  await p.getByText('Pedir un documento más').click();
  await p.getByLabel('Documento', { exact: true }).fill('Certificado de empresa');
  await p.getByLabel('Por qué lo necesitamos (lo verá el cliente)').fill('Necesitamos también el certificado de empresa para calcular la prestación.');
  await p.getByRole('button', { name: 'Pedir documento' }).click();
  await expect(p.getByText('Documento solicitado al cliente.')).toBeVisible();
  await p.getByLabel('Nota interna').fill('Nota interna de prueba: el cliente no debe verla.');
  await p.getByRole('button', { name: 'Guardar nota' }).click();
  await ctx.close();
});

test('4. Aviso neutro por correo; el cliente subsana y aporta lo que falta', async ({ browser }) => {
  const previos = correos(A.email).filter((c) => /novedades/.test(c.subject)).length;
  enviarAvisos();
  const aviso = await esperarCorreo(A.email, /Tienes novedades/, previos);
  expect(aviso.attachments).toBe(0);
  for (const sensible of ['despido', 'nómina', 'Certificado', 'fotografía', 'Empresa Ficticia']) expect(aviso.text).not.toContain(sensible);
  // Un único aviso pese a varios cambios seguidos
  expect(correos(A.email).filter((c) => /novedades/.test(c.subject)).length).toBe(previos + 1);

  const ctx = await browser.newContext(movil);
  const p = await ctx.newPage();
  await entrar(p, A.email, A.clave);
  await p.goto(enlace(aviso.text));
  await expect(p.getByText('Qué tienes que hacer ahora')).toBeVisible();
  await p.goto(`/solicitudes/${estado.solicitud}/`);
  const nominas = tarjeta(p, 'Últimas nóminas');
  await expect(nominas.getByText('Necesita subsanación')).toBeVisible();
  await expect(nominas.getByText('La fotografía no permite leer el documento.', { exact: false }).first()).toBeVisible();
  await expect(p.getByText('Nota interna de prueba')).toHaveCount(0);
  await subir(p, 'Últimas nóminas', 'nomina-agosto-legible.pdf', 'application/pdf', await pdfFicticio(browser, 'Nómina ficticia agosto'));
  await subir(p, 'Contrato de trabajo', 'contrato.pdf', 'application/pdf', await pdfFicticio(browser, 'Contrato ficticio'));
  await subir(p, 'Certificado de empresa', 'certificado.pdf', 'application/pdf', await pdfFicticio(browser, 'Certificado ficticio'));
  await p.reload();
  // La versión ilegible se conserva en el historial
  await expect(nominas.getByText('foto-nomina-agosto.jpg')).toBeVisible();
  await expect(nominas.getByText(/Hay que sustituirlo/)).toBeVisible();
  await p.getByLabel('Escribe un mensaje').fill('Ya he subido la nómina legible y el resto de documentos.');
  await p.getByRole('button', { name: 'Enviar mensaje' }).click();
  await expect(p.getByText('Ya he subido la nómina legible')).toBeVisible();
  await ctx.close();
});

test('5. La letrada valida todo, revisa conflictos y convierte la solicitud en expediente', async ({ browser }) => {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await entrarLetrada(p);
  await p.goto(`/despacho/?vista=validar`);
  await expect(p.getByRole('link', { name: /^SOL-/ }).first()).toBeVisible();
  await p.goto(`/despacho/solicitudes/${estado.solicitud}/`);
  await expect(p.getByText('Ya he subido la nómina legible')).toBeVisible();
  for (const nombre of ['nomina-septiembre.pdf', 'nomina-agosto-legible.pdf', 'contrato.pdf', 'certificado.pdf']) {
    await p.locator(`[data-documento="${nombre}"]`).getByRole('button', { name: 'Validar documento' }).click();
    await expect(p.getByRole('status')).toContainText('Documento validado');
  }
  // Nóminas admite varios archivos: se valida el requisito expresamente
  const nom = tarjeta(p, 'Últimas nóminas');
  await nom.getByText('Cambiar estado de este documento').click();
  await nom.getByLabel('Estado').selectOption('validado');
  await nom.getByRole('button', { name: 'Guardar' }).click();
  await expect(p.getByText('Estado del documento actualizado.')).toBeVisible();

  await expect(p.getByRole('button', { name: 'Aceptar y abrir expediente' })).toBeDisabled();
  await p.getByLabel('He revisado los posibles conflictos de intereses').check();
  await p.getByRole('button', { name: 'Registrar revisión' }).click();
  await expect(p.getByText('Revisión de conflictos registrada.')).toBeVisible();
  await p.getByLabel('Título del expediente').fill('Despido disciplinario · Ana Ficticia');
  await p.getByRole('button', { name: 'Aceptar y abrir expediente' }).click();
  await expect(p.getByRole('status')).toContainText('Expediente abierto');
  await expect(p.getByText(/^Expediente EXP-\d{4}-\d{5}/)).toBeVisible();
  await ctx.close();

  enviarAvisos();
  const cp = await browser.newContext(movil);
  const c = await cp.newPage();
  await entrar(c, A.email, A.clave);
  await c.goto('/expedientes/');
  await c.getByRole('link', { name: 'Despido disciplinario · Ana Ficticia' }).click();
  await c.waitForURL(/expedientes\/[0-9a-f-]{36}\/$/);
  estado.expediente = c.url().match(/expedientes\/([0-9a-f-]{36})/)![1];
  await expect(c.getByText('Aceptada: expediente abierto').first()).toBeVisible();
  // Documentos, versiones, mensajes e historial siguen unidos al cliente y al expediente
  for (const n of ['carta-despido.pdf', 'foto-nomina-agosto.jpg', 'nomina-agosto-legible.pdf', 'contrato.pdf', 'certificado.pdf']) await expect(c.getByText(n)).toBeVisible();
  await expect(c.getByText('Ya he subido la nómina legible')).toBeVisible();
  await expect(c.getByText(/· Expediente abierto$/)).toBeVisible();
  await expect(c.getByText(/· Solicitud enviada al despacho/)).toBeVisible();
  await expect(c.getByText(/conflictos/i)).toHaveCount(0);
  await cp.close();
});

test('6. Cliente B no accede a nada de A: interfaz, API, almacenamiento ni identificadores manipulados', async ({ browser }) => {
  const ctx = await browser.newContext(movil);
  const p = await ctx.newPage();
  // Registro con un correo ya existente: misma respuesta, sin revelar que existe
  await registrar(p, 'Intruso', A.email, 'otra-clave-cualquiera');
  await esperarCorreo(A.email, /Intento de registro/);
  const previos = await registrar(p, B.nombre, B.email, B.clave);
  await verificarYCompletar(p, B.email, previos);

  await expect(p.getByText('Iniciar una solicitud')).toBeVisible();
  for (const ruta of [`/solicitudes/${estado.solicitud}/`, `/expedientes/${estado.expediente}/`, `/solicitudes/${estado.solicitud}/editar/`]) {
    const r = await p.goto(ruta);
    expect(r!.status(), ruta).toBe(404);
  }
  for (const ruta of ['/despacho/', `/despacho/solicitudes/${estado.solicitud}/`]) {
    await p.goto(ruta);
    await expect(p).not.toHaveURL(/despacho/);
  }
  expect((await p.request.get(`/api/documentos/${estado.doc}/`)).status()).toBe(404);
  // Subida a un requisito de A con un identificador conocido
  const reqA = await (async () => {
    const lc = await browser.newContext(); const l = await lc.newPage(); await entrarLetrada(l);
    await l.goto(`/despacho/solicitudes/${estado.solicitud}/`);
    const v = await l.locator('[data-requisito="Contrato de trabajo"] input[name="requisito"]').first().getAttribute('value');
    await lc.close(); return v!;
  })();
  const st = await p.evaluate(async (rid) => {
    const f = new FormData(); f.append('requisito', rid);
    f.append('archivo', new Blob(['%PDF-1.4\n%%EOF'], { type: 'application/pdf' }), 'x.pdf');
    return (await fetch('/api/documentos/', { method: 'POST', body: f })).status;
  }, reqA);
  expect(st).toBe(404);
  // El almacenamiento no es accesible sin la clave de servicio, ni por URL pública
  const storage = process.env.STORAGE_URL!;
  const clave = `${estado.solicitud}/${estado.doc}`;
  expect((await p.request.get(`${storage}/object/public/portal-documentos/${clave}`)).status()).toBeGreaterThanOrEqual(400);
  expect((await p.request.get(`${storage}/object/portal-documentos/${clave}`)).status()).toBeGreaterThanOrEqual(400);
  expect((await p.request.get(`${storage}/object/authenticated/portal-documentos/${clave}`)).status()).toBeGreaterThanOrEqual(400);
  // Su panel está vacío
  await p.goto('/documentos/');
  await expect(p.getByText('Todavía no has enviado documentos.')).toBeVisible();
  await p.goto('/mensajes/');
  await expect(p.getByText('Ya he subido la nómina legible')).toHaveCount(0);
  await ctx.close();
});
