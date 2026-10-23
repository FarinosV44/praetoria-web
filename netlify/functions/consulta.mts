// Recepción de consultas del formulario de contacto: POST /api/consulta
//
// 1. Acepta JSON (envío desde la página) o formulario clásico (sin JavaScript).
// 2. Valida en servidor con las mismas reglas que el navegador (src/lib/consulta.ts).
// 3. Descarta envíos automáticos (campo trampa o envío en menos de 3 s) sin avisar al bot.
// 4. Entrega la consulta a Netlify Forms (formulario "contacto" definido en public/__forms.html),
//    que la guarda, aplica su filtro antispam y envía el aviso por correo configurado en Netlify.
// 5. Solo responde éxito si Netlify Forms ha aceptado la entrega. Si falla, 502: el navegador ofrece reintentar.
//
// No acepta adjuntos ni guarda nada por su cuenta.
import { pareceAutomatico, responsable, validarConsulta, AREAS, PREFERENCIAS, PAPELES, INCIDENCIAS, IMPORTES, REPRESENTA, PROBLEMAS_LABORALES, SITUACIONES } from '../../src/lib/consulta.ts';
import { site } from '../../src/lib/site.ts';
import { servicioPorId } from '../../src/lib/servicios.ts';

const MAX_BYTES = 12_000;

type Ctx = { forward?: typeof fetch };

const json = (status: number, body: object) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

const seeOther = (location: string) => new Response(null, { status: 303, headers: { Location: location } });

export default async function consulta(req: Request, context?: Ctx): Promise<Response> {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'metodo' });

  const len = Number(req.headers.get('content-length') ?? 0);
  if (len > MAX_BYTES) return json(413, { ok: false, error: 'tamano' });
  const raw = await req.text();
  if (raw.length > MAX_BYTES) return json(413, { ok: false, error: 'tamano' });

  const type = req.headers.get('content-type') ?? '';
  const isJson = type.includes('application/json');
  let fields: Record<string, unknown>;
  try {
    fields = isJson ? JSON.parse(raw) : Object.fromEntries(new URLSearchParams(raw));
  } catch {
    return json(400, { ok: false, error: 'formato' });
  }
  if (!fields || typeof fields !== 'object') return json(400, { ok: false, error: 'formato' });

  // Sin JavaScript no hay marca de tiempo: solo se exige el campo trampa vacío
  const automatico = isJson ? pareceAutomatico(fields) : String(fields['empresa-web'] ?? '').trim() !== '';
  if (automatico) return isJson ? json(200, { ok: true }) : seeOther('/gracias/');

  if (!isJson && !fields.id) fields.id = crypto.randomUUID();
  const v = validarConsulta(fields);
  if (!v.ok) {
    if (isJson) return json(422, { ok: false, error: 'validacion', errores: v.errores });
    return new Response(paginaErrores(v.errores), { status: 422, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  const c = v.data;
  const resp = responsable(c.area);
  const body = new URLSearchParams({
    'form-name': 'contacto',
    id: c.id,
    nombre: c.nombre,
    email: c.email,
    telefono: c.telefono,
    area: AREAS.find((a) => a.id === c.area)!.label,
    servicio: c.servicio ? servicioPorId(c.servicio)!.nombre : '',
    papel: PAPELES.find((x) => x.id === c.papel)?.label ?? '',
    incidencia: INCIDENCIAS.find((x) => x.id === c.incidencia)?.label ?? '',
    importe: IMPORTES.find((x) => x.id === c.importe)?.label ?? '',
    fecha: c.fecha,
    representa: REPRESENTA.find((x) => x.id === c.representa)?.label ?? '',
    problema: PROBLEMAS_LABORALES.find((x) => x.id === c.problema)?.label ?? '',
    situacion: SITUACIONES.find((x) => x.id === c.situacion)?.label ?? '',
    cuestionario: c.cuestionario,
    responsable: `${resp.nombre} (${resp.telefono})`,
    preferencia: PREFERENCIAS.find((p) => p.id === c.preferencia)!.label,
    mensaje: c.mensaje,
    privacidad: 'aceptada',
  });

  const target = process.env.FORMS_ENDPOINT || `${process.env.URL || new URL(req.url).origin}/__forms.html`;
  const doFetch = context?.forward ?? fetch;
  try {
    const r = await doFetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
    });
    // Netlify Forms responde 200 (o 303 si hubiera "action"); cualquier otra cosa es un fallo de entrega
    if (r.status !== 200 && r.status !== 303) throw new Error(`Netlify Forms respondió ${r.status}`);
  } catch (e) {
    console.error('consulta: fallo al entregar a Netlify Forms', c.id, e instanceof Error ? e.message : e);
    return isJson ? json(502, { ok: false, error: 'entrega', id: c.id }) : new Response(paginaFallo(), { status: 502, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  console.log('consulta: recibida', c.id, c.area);
  return isJson ? json(200, { ok: true, id: c.id }) : seeOther('/gracias/');
}

export const config = { path: '/api/consulta' };

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);

function paginaErrores(errores: Record<string, string | undefined>) {
  const items = Object.values(errores).filter(Boolean).map((e) => `<li>${esc(e!)}</li>`).join('');
  return `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Revisa tu consulta</title><body style="font-family:system-ui;max-width:40rem;margin:3rem auto;padding:0 1rem"><h1>Revisa tu consulta</h1><p>No la hemos enviado todavía:</p><ul>${items}</ul><p><a href="javascript:history.back()">Volver al formulario</a> (los datos siguen escritos) o llámanos al ${site.phone}.</p></body></html>`;
}

function paginaFallo() {
  return `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width,initial-scale=1"><title>No se ha podido enviar</title><body style="font-family:system-ui;max-width:40rem;margin:3rem auto;padding:0 1rem"><h1>No hemos podido recibir tu consulta</h1><p>Ha fallado la entrega. Vuelve atrás e inténtalo de nuevo, o llámanos al ${site.phone} o escribe a ${site.email}.</p><p><a href="javascript:history.back()">Volver al formulario</a></p></body></html>`;
}
