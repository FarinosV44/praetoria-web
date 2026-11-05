import { NextResponse } from 'next/server';
import { createHash, randomUUID } from 'node:crypto';
import { fileTypeFromBuffer } from 'file-type';
import { headers } from 'next/headers';
import { auth } from '@/portal/lib/auth';
import { comoUsuario } from '@/portal/lib/db';
import { UUID } from '@/portal/lib/datos';
import { env } from '@/portal/lib/env';
import { detectarTipo, nombreSeguro, pdfSospechoso, TIPOS } from '@/portal/lib/archivos';
import { borrarObjetoHuerfano, guardarObjeto } from '@/portal/lib/storage';
import { personalSinMfa } from '@/portal/lib/sesion';

export const runtime = 'nodejs';

// Cada rechazo deja una línea en los registros con una referencia corta y el motivo técnico (nunca nombres de
// archivo, contenido ni datos personales), y la referencia viaja a la pantalla para poder localizarlo (#100).
const fallo = (status: number, error: string, motivo = '') => {
  const ref = randomUUID().slice(0, 8);
  console.warn(`subida rechazada ref=${ref} http=${status}${motivo ? ` motivo=${motivo}` : ''}`);
  return NextResponse.json({ ok: false, error, ref }, { status, headers: { 'cache-control': 'no-store' } });
};
const tipoLegible = (t?: string) => ({ 'application/x-cfb': 'Word o Excel antiguo (.doc/.xls)', 'application/msword': 'Word antiguo (.doc)',
  'application/zip': 'ZIP', 'application/vnd.oasis.opendocument.text': 'OpenDocument (.odt)', 'image/tiff': 'TIFF', 'image/gif': 'GIF',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel (.xlsx)', 'application/vnd.ms-outlook': 'correo de Outlook (.msg)' } as Record<string, string>)[t ?? ''];

// Subida de un documento a un requisito. Solo se confirma al cliente cuando el archivo está
// guardado en el almacenamiento privado Y registrado en la base de datos (misma transacción).
export async function POST(req: Request) {
  const h = await headers();
  if (h.get('origin') !== env.origin) return fallo(403, 'La página no coincide con la dirección del portal. Recarga la página e inténtalo de nuevo.', 'origen');
  // Sin el almacenamiento configurado no se acepta nada (antes acababa en un error 500 sin explicación).
  try { void env.storageUrl; void env.storageKey; } catch {
    console.error('subida: falta la configuración del almacenamiento (STORAGE_URL / STORAGE_SERVICE_KEY)');
    return fallo(503, 'El almacenamiento de documentos no está configurado en el servidor. Avisa al administrador.', 'sin-config-almacenamiento');
  }
  const sesion = await auth.api.getSession({ headers: h });
  if (!sesion) return fallo(401, 'Tu sesión ha caducado. Vuelve a entrar.', 'sin-sesion');
  if (await personalSinMfa(sesion.user.id, sesion.user.twoFactorEnabled)) return fallo(403, 'Activa el doble factor antes de continuar.', 'sin-mfa');
  const largo = Number(h.get('content-length') || 0);
  if (largo > env.uploadMaxBytes + 64 * 1024) return fallo(413, `El archivo supera el máximo de ${env.uploadMaxBytes / 1024 / 1024} MB.`, 'tamano');

  let form: FormData;
  try { form = await req.formData(); } catch { return fallo(400, 'No hemos recibido el archivo completo. Inténtalo de nuevo.', 'formulario-incompleto'); }
  // Destino: un documento solicitado (requisito) o, sin él, el asunto (solicitud) con una carpeta.
  const requisitoId = String(form.get('requisito') ?? '');
  const solicitudId = String(form.get('solicitud') ?? '');
  const carpeta = String(form.get('carpeta') ?? '').trim().slice(0, 80);
  const origen = ['archivo', 'portapapeles', 'foto'].includes(String(form.get('origen'))) ? String(form.get('origen')) : 'archivo';
  const archivo = form.get('archivo');
  if (!(UUID.test(requisitoId) || UUID.test(solicitudId)) || !(archivo instanceof File)) return fallo(400, 'Falta el archivo.', 'sin-archivo');
  if (archivo.size === 0) return fallo(400, 'El archivo está vacío.', 'vacio');
  if (archivo.size > env.uploadMaxBytes) return fallo(413, `El archivo supera el máximo de ${env.uploadMaxBytes / 1024 / 1024} MB.`, 'tamano');

  const datos = new Uint8Array(await archivo.arrayBuffer());
  const mime = await detectarTipo(datos);
  if (!mime) {
    const real = (await fileTypeFromBuffer(datos))?.mime;
    const t = tipoLegible(real);
    return fallo(415, `${t ? `Este archivo es ${t}, que no admitimos. ` : 'Formato no admitido. '}Sube un ${Object.values(TIPOS).join(', ')}${t?.includes('Word') ? ' (en Word: Archivo → Guardar como → .docx o PDF)' : ''}.`,
      `tipo:${real ?? 'desconocido'}`);
  }
  if (mime === 'application/pdf') {
    const p = pdfSospechoso(datos);
    if (p) return fallo(422, p, 'pdf-activo');
  }
  const sha256 = createHash('sha256').update(datos).digest('hex');
  const id = randomUUID();
  let clave = '';
  try {
    const r = await comoUsuario(sesion.user.id, async (tx) => {
      // La RLS decide si el asunto o el requisito existen para este usuario.
      const q = UUID.test(requisitoId)
        ? await tx.query('select solicitud_id from portal.requisitos where id = $1', [requisitoId])
        : await tx.query('select id solicitud_id from portal.solicitudes where id = $1', [solicitudId]);
      if (!q.rowCount) throw Object.assign(new Error('No encontrado'), { http: 404 });
      clave = `${q.rows[0].solicitud_id}/${id}`;
      const ins = await tx.query(
        `insert into portal.documentos (id, requisito_id, solicitud_id, cliente_id, version, storage_key, nombre_original, mime, tamano, sha256, subido_por, carpeta, origen)
         values ($1, $2, $3, $4, 0, $5, $6, $7, $8, $9, $4, nullif($10, ''), $11) returning version`,
        [id, UUID.test(requisitoId) ? requisitoId : null, q.rows[0].solicitud_id, sesion.user.id, clave, nombreSeguro(archivo.name), mime, datos.byteLength, sha256,
          carpeta, origen]);
      await guardarObjeto(clave, datos, mime);
      return ins.rows[0].version as number;
    });
    return NextResponse.json({ ok: true, documento: { id, version: r } }, { headers: { 'cache-control': 'no-store' } });
  } catch (e) {
    if (clave) await borrarObjetoHuerfano(clave).catch(() => {});
    const err = e as { http?: number; code?: string; message: string };
    if (err.http === 404) return fallo(404, 'No encontramos este asunto o no lo tienes asignado.', 'asunto-no-visible');
    if (err.code === '42501') return fallo(403, err.message.length < 120 ? err.message : 'No puedes subir documentos aquí.', 'permiso');
    if (err.code === '54000') return fallo(429, err.message, 'limite');
    if (/Almacenamiento/.test(err.message)) return fallo(503, 'El almacenamiento de documentos no responde. No se ha guardado nada; inténtalo en unos minutos.', `almacenamiento:${err.message.slice(14, 80)}`);
    return fallo(500, 'No hemos podido guardar el archivo. No se ha guardado nada; inténtalo de nuevo.', `bd:${err.code ?? 'sin-codigo'}`);
  }
}
