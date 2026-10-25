// Solicitud de llamada / contacto prioritario (#33): POST /api/llamada
//
// Igual que /api/consulta (validación compartida, campo trampa y tiempo mínimo, sin adjuntos), pero:
// - formulario corto: nombre, teléfono, área, motivo, fecha, localidad, forma segura de contacto y descripción breve;
// - se entrega a Netlify Forms en «llamada-urgente» (o «llamada-urgente-laboral»), con prioridad URGENTE,
//   para que el aviso por correo de Netlify llegue con un asunto propio que lo distinga;
// - solo responde éxito si Netlify Forms ha aceptado la entrega. No promete disponibilidad.
import { pareceAutomatico, responsable, AREAS } from '../../src/lib/consulta.ts';
import { CONTACTO_SEGURO, MOTIVOS, formularioLlamada, validarLlamada } from '../../src/lib/llamada.ts';
import { site } from '../../src/lib/site.ts';
import { conCors, gracias, preflight } from '../../src/lib/cors.ts';
import { servicioPorId } from '../../src/lib/servicios.ts';

const MAX_BYTES = 6_000;

type Ctx = { forward?: typeof fetch };

const json = (status: number, body: object) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
const seeOther = (location: string) => new Response(null, { status: 303, headers: { Location: location } });
const html = (status: number, titulo: string, cuerpo: string) =>
  new Response(
    `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titulo}</title><body style="font-family:system-ui;max-width:40rem;margin:3rem auto;padding:0 1rem"><h1>${titulo}</h1>${cuerpo}<p><a href="javascript:history.back()">Volver al formulario</a> o llama al ${site.phone}.</p></body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);

export default async function llamada(req: Request, context?: Ctx): Promise<Response> {
  if (req.method === 'OPTIONS') return preflight(req);
  return conCors(req, await atender(req, context));
}

async function atender(req: Request, context?: Ctx): Promise<Response> {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'metodo' });
  const len = Number(req.headers.get('content-length') ?? 0);
  if (len > MAX_BYTES) return json(413, { ok: false, error: 'tamano' });
  const raw = await req.text();
  if (raw.length > MAX_BYTES) return json(413, { ok: false, error: 'tamano' });

  const isJson = (req.headers.get('content-type') ?? '').includes('application/json');
  let fields: Record<string, unknown>;
  try {
    fields = isJson ? JSON.parse(raw) : Object.fromEntries(new URLSearchParams(raw));
  } catch {
    return json(400, { ok: false, error: 'formato' });
  }
  if (!fields || typeof fields !== 'object') return json(400, { ok: false, error: 'formato' });

  const automatico = isJson ? pareceAutomatico(fields) : String(fields['empresa-web'] ?? '').trim() !== '';
  if (automatico) return isJson ? json(200, { ok: true }) : seeOther(gracias(req));

  if (!isJson && !fields.id) fields.id = crypto.randomUUID();
  const v = validarLlamada(fields);
  if (!v.ok) {
    if (isJson) return json(422, { ok: false, error: 'validacion', errores: v.errores });
    const items = Object.values(v.errores).filter(Boolean).map((e) => `<li>${esc(e!)}</li>`).join('');
    return html(422, 'Revisa tu solicitud', `<p>No la hemos enviado todavía:</p><ul>${items}</ul>`);
  }

  const c = v.data;
  const resp = responsable(c.area);
  const body = new URLSearchParams({
    'form-name': formularioLlamada(c.area),
    prioridad: 'URGENTE',
    id: c.id,
    nombre: c.nombre,
    telefono: c.telefono,
    area: AREAS.find((a) => a.id === c.area)!.label,
    servicio: c.servicio ? (servicioPorId(c.servicio)?.nombre ?? '') : '',
    motivo: MOTIVOS.find((m) => m.id === c.motivo)!.label,
    fecha: c.fecha,
    localidad: c.localidad,
    seguro: CONTACTO_SEGURO.find((x) => x.id === c.seguro)!.label,
    franja: c.franja,
    descripcion: c.descripcion,
    responsable: `${resp.nombre} (${resp.telefono})`,
    origen: c.origen,
    privacidad: 'aceptada',
  });

  // Mismo despliegue que atiende la petición (ver consulta.mts): nunca process.env.URL, que hoy apunta a WordPress.
  const target = process.env.FORMS_ENDPOINT || `${new URL(req.url).origin}/__forms.html`;
  const doFetch = context?.forward ?? fetch;
  try {
    const r = await doFetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
    });
    if (r.status !== 200 && r.status !== 303) throw new Error(`Netlify Forms respondió ${r.status}`);
  } catch (e) {
    console.error('llamada: fallo al entregar a Netlify Forms', c.id, e instanceof Error ? e.message : e);
    return isJson
      ? json(502, { ok: false, error: 'entrega', id: c.id })
      : html(502, 'No hemos podido recibir tu solicitud', `<p>Ha fallado la entrega. Inténtalo de nuevo o, si es urgente, llama al ${site.phone}.</p>`);
  }
  console.log('llamada: recibida', c.id, c.area, c.motivo);
  return isJson ? json(200, { ok: true, id: c.id }) : seeOther(gracias(req));
}

export const config = { path: '/api/llamada' };
