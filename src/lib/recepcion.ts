// Recepción de los formularios en servidor: validación, antispam, aviso por correo y copia de seguridad.
// Sustituye a los antiguos public/api/*.php. Las reglas son las del navegador (consulta.ts y llamada.ts).
// Sin dependencias del marco: también la usan las pruebas y scripts/qa/serve.mjs. Importaciones con extensión.
//
// Entrega: correo a site.email por la API de Resend, con «Responder a» el correo de quien consulta. Solo se
// responde éxito si Resend lo acepta. Antes se guarda una copia fuera de la web, por si un correo no llegara.
// Pruebas: con PRAETORIA_ENTREGA_URL se envía allí en lugar de por correo.
import { randomUUID } from 'node:crypto';
import { appendFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  AREAS, DOCUMENTOS, IMPORTES, INCIDENCIAS, ORGANISMOS, PAPELES, PREFERENCIAS, PROBLEMAS_LABORALES, REPRESENTA, SITUACIONES,
  pareceAutomatico, responsable, validarConsulta,
} from './consulta.ts';
import { CONTACTO_SEGURO, MOTIVOS, formularioLlamada, validarLlamada } from './llamada.ts';
import { servicioPorId } from './servicios-indice.ts';
import { laboral, site } from './site.ts';

export const MAX_CONSULTA = 12000;
export const MAX_LLAMADA = 6000;

export type Respuesta = { status: number; headers: Record<string, string>; body: string };
type Campos = Record<string, unknown>;
type Datos = Record<string, string>;
type Lista = readonly { id: string; label: string }[];

const etiqueta = (lista: Lista, id: string) => lista.find((x) => x.id === id)?.label ?? '';
const dominio = new URL(site.url).hostname;

const json = (status: number, datos: unknown): Respuesta => ({
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  body: JSON.stringify(datos),
});
const aGracias = (): Respuesta => ({ status: 303, headers: { Location: '/gracias/', 'Cache-Control': 'no-store' }, body: '' });
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const pagina = (status: number, titulo: string, cuerpo: string): Respuesta => ({
  status,
  headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  body:
    '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    `<title>${esc(titulo)}</title><body style="font-family:system-ui;max-width:40rem;margin:3rem auto;padding:0 1rem"><h1>${esc(titulo)}</h1>` +
    `${cuerpo}<p><a href="javascript:history.back()">Volver al formulario</a> (los datos siguen escritos) o llámanos al ${esc(site.phone)}.</p></body></html>`,
});

/** Interpreta el cuerpo: JSON (envío desde la página) o formulario clásico (sin JavaScript). */
export function leerCampos(tipo: string, crudo: string): { esJson: boolean; campos: Campos | null } {
  const esJson = tipo.includes('application/json');
  if (!esJson) return { esJson, campos: Object.fromEntries(new URLSearchParams(crudo)) };
  try {
    const v: unknown = JSON.parse(crudo);
    if (!v || typeof v !== 'object' || Array.isArray(v)) return { esJson, campos: null };
    // Solo valores simples: un objeto o una lista en un campo cuentan como vacíos
    return { esJson, campos: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x !== null && typeof x === 'object' ? '' : x])) };
  } catch {
    return { esJson, campos: null };
  }
}

// Sin JavaScript solo cuenta el campo trampa: no hay marca de tiempo
const automatico = (c: Campos, esJson: boolean) => (esJson ? pareceAutomatico(c) : String(c['empresa-web'] ?? '').trim() !== '');
const textoResponsable = (area: Parameters<typeof responsable>[0]) => {
  const r = responsable(area);
  return `${r.nombre} (${r.telefono})`;
};

const ROTULOS: Record<string, string> = {
  prioridad: 'Prioridad', nombre: 'Nombre', telefono: 'Teléfono', email: 'Correo', preferencia: 'Prefiere contacto por',
  area: 'Área', servicio: 'Asunto', detalle: 'Detalle', motivo: 'Motivo', fecha: 'Fecha relevante',
  localidad: 'Localidad', seguro: 'Contacto seguro', franja: 'Franja para llamar',
  papel: 'Papel en el transporte', incidencia: 'Incidencia', importe: 'Importe',
  representa: 'Quién consulta', problema: 'Problema laboral', situacion: 'Situación',
  organismo: 'Organismo', documento: 'Documento', responsable: 'Responsable',
  mensaje: 'Mensaje', descripcion: 'Descripción', cuestionario: 'Resumen del cuestionario',
  origen: 'Página de origen', landing: 'Primera página de la visita',
  utm_source: 'utm_source', utm_medium: 'utm_medium', utm_campaign: 'utm_campaign', id: 'Referencia',
};

export function cuerpoCorreo(datos: Datos, ahora = new Date()): string {
  const lineas: string[] = [];
  for (const [k, rotulo] of Object.entries(ROTULOS)) {
    const v = datos[k] ?? '';
    if (v) lineas.push(v.includes('\n') ? `${rotulo}:\n${v}\n` : `${rotulo}: ${v}`);
  }
  const cuando = new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(ahora).replace(',', '');
  lineas.push('', `Recibido desde el formulario de ${dominio} el ${cuando}.`);
  return lineas.join('\n');
}

/** Copia fuera de la carpeta de la web (~/consultas-web, la misma que usaba el PHP). Nunca bloquea el envío. */
function guardarCopia(tipo: string, datos: Datos) {
  if (process.env.PRAETORIA_ENTREGA_URL) return;
  try {
    const dir = process.env.CONSULTAS_COPIA_DIR || join(homedir(), 'consultas-web');
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const ahora = new Date();
    const mes = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit' }).format(ahora);
    appendFileSync(join(dir, `${mes}.jsonl`), JSON.stringify({ tipo, recibida: ahora.toISOString(), ...datos }) + '\n', { mode: 0o600 });
  } catch (e) {
    console.error(`formularios: no se pudo guardar la copia: ${(e as Error).message}`);
  }
}

/** true solo si la entrega se ha aceptado. */
async function entregar(formulario: string, asunto: string, datos: Datos, responderA = ''): Promise<boolean> {
  try {
    const prueba = process.env.PRAETORIA_ENTREGA_URL;
    if (prueba) {
      const r = await fetch(prueba, { method: 'POST', body: new URLSearchParams({ 'form-name': formulario, ...datos }), signal: AbortSignal.timeout(10_000) });
      return r.status === 200;
    }
    const clave = process.env.RESEND_API_KEY;
    if (!clave) {
      console.error('formularios: falta RESEND_API_KEY');
      return false;
    }
    const r = await fetch(process.env.PRAETORIA_RESEND_URL || 'https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${clave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `Web ${site.name} <info@${dominio}>`,
        to: [site.email],
        subject: asunto.replace(/[\r\n]+/g, ' ').trim(),
        text: cuerpoCorreo(datos),
        tags: [{ name: 'formulario', value: formulario }],
        ...(/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(responderA) ? { reply_to: responderA } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (r.ok) return true;
    console.error(`formularios: Resend respondió ${r.status}`);
    return false;
  } catch (e) {
    console.error(`formularios: fallo en la entrega: ${(e as Error).message}`);
    return false;
  }
}

const listaErrores = (errores: object) => Object.values(errores).map((e) => `<li>${esc(String(e))}</li>`).join('');

export async function recibirConsulta(tipo: string, crudo: string): Promise<Respuesta> {
  const { esJson, campos } = leerCampos(tipo, crudo);
  if (!campos) return json(400, { ok: false, error: 'formato' });
  if (automatico(campos, esJson)) return esJson ? json(200, { ok: true }) : aGracias();
  if (!esJson && !campos.id) campos.id = randomUUID();

  const v = validarConsulta(campos);
  if (!v.ok) {
    if (esJson) return json(422, { ok: false, error: 'validacion', errores: v.errores });
    return pagina(422, 'Revisa tu consulta', `<p>No la hemos enviado todavía:</p><ul>${listaErrores(v.errores)}</ul>`);
  }
  const r = v.data;
  const sv = r.servicio ? servicioPorId(r.servicio) : undefined;
  const datos: Datos = {
    id: r.id, nombre: r.nombre, email: r.email, telefono: r.telefono,
    area: etiqueta(AREAS, r.area),
    servicio: sv?.nombre ?? '',
    papel: etiqueta(PAPELES, r.papel), incidencia: etiqueta(INCIDENCIAS, r.incidencia), importe: etiqueta(IMPORTES, r.importe),
    fecha: r.fecha,
    representa: etiqueta(REPRESENTA, r.representa), problema: etiqueta(PROBLEMAS_LABORALES, r.problema), situacion: etiqueta(SITUACIONES, r.situacion),
    cuestionario: r.cuestionario,
    organismo: etiqueta(ORGANISMOS, r.organismo), documento: etiqueta(DOCUMENTOS, r.documento),
    origen: r.origen, landing: r.landing, utm_source: r.utm_source, utm_medium: r.utm_medium, utm_campaign: r.utm_campaign,
    detalle: r.detalle ? `${sv?.preguntaMinima?.label ?? ''} ${r.detalle}`.trim() : '',
    responsable: textoResponsable(r.area),
    preferencia: etiqueta(PREFERENCIAS, r.preferencia),
    mensaje: r.mensaje,
    privacidad: 'aceptada',
  };
  const esLaboral = r.area === 'laboral';
  const asunto = `Nueva consulta web · ${datos.area}${esLaboral ? ` (${laboral.name})` : ''} · ${datos.nombre}`;
  guardarCopia('consulta', datos);
  if (await entregar(esLaboral ? 'contacto-laboral' : 'contacto', asunto, datos, r.email)) return esJson ? json(200, { ok: true, id: r.id }) : aGracias();
  console.error(`consulta: fallo al enviar el aviso ${r.id}`);
  return esJson
    ? json(502, { ok: false, error: 'entrega', id: r.id })
    : pagina(502, 'No hemos podido recibir tu consulta', '<p>Ha fallado la entrega. Vuelve atrás e inténtalo de nuevo, o escríbenos directamente.</p>');
}

export async function recibirLlamada(tipo: string, crudo: string): Promise<Respuesta> {
  const { esJson, campos } = leerCampos(tipo, crudo);
  if (!campos) return json(400, { ok: false, error: 'formato' });
  if (automatico(campos, esJson)) return esJson ? json(200, { ok: true }) : aGracias();
  if (!esJson && !campos.id) campos.id = randomUUID();

  const v = validarLlamada(campos);
  if (!v.ok) {
    if (esJson) return json(422, { ok: false, error: 'validacion', errores: v.errores });
    return pagina(422, 'Revisa tu solicitud', `<p>No la hemos enviado todavía:</p><ul>${listaErrores(v.errores)}</ul>`);
  }
  const r = v.data;
  const datos: Datos = {
    prioridad: 'URGENTE', id: r.id, nombre: r.nombre, telefono: r.telefono,
    area: etiqueta(AREAS, r.area),
    servicio: r.servicio ? (servicioPorId(r.servicio)?.nombre ?? '') : '',
    motivo: etiqueta(MOTIVOS, r.motivo),
    fecha: r.fecha, localidad: r.localidad,
    seguro: etiqueta(CONTACTO_SEGURO, r.seguro),
    franja: r.franja, descripcion: r.descripcion,
    responsable: textoResponsable(r.area),
    origen: r.origen, privacidad: 'aceptada',
  };
  const esLaboral = r.area === 'laboral';
  const asunto = `URGENTE · Solicitud de llamada · ${datos.motivo}${esLaboral ? ` (${laboral.name})` : ''} · ${datos.nombre}`;
  guardarCopia('llamada', datos);
  if (await entregar(formularioLlamada(r.area), asunto, datos)) return esJson ? json(200, { ok: true, id: r.id }) : aGracias();
  console.error(`llamada: fallo al enviar el aviso ${r.id}`);
  return esJson
    ? json(502, { ok: false, error: 'entrega', id: r.id })
    : pagina(502, 'No hemos podido recibir tu solicitud', '<p>Ha fallado la entrega. Inténtalo de nuevo o, si es urgente, llama directamente.</p>');
}

/** Límite de tamaño y lectura del cuerpo, común a las dos rutas. */
export async function atender(req: Request, max: number, recibir: (tipo: string, crudo: string) => Promise<Respuesta>): Promise<Response> {
  const salida = (r: Respuesta) => new Response(r.status === 303 ? null : r.body, { status: r.status, headers: r.headers });
  if (Number(req.headers.get('content-length') ?? 0) > max) return salida(json(413, { ok: false, error: 'tamano' }));
  const crudo = await req.text();
  if (Buffer.byteLength(crudo) > max) return salida(json(413, { ok: false, error: 'tamano' }));
  return salida(await recibir(req.headers.get('content-type') ?? '', crudo));
}
