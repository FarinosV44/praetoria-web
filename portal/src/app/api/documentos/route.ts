import { NextResponse } from 'next/server';
import { createHash, randomUUID } from 'node:crypto';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { comoUsuario } from '@/lib/db';
import { UUID } from '@/lib/datos';
import { env } from '@/lib/env';
import { detectarTipo, nombreSeguro, pdfSospechoso, TIPOS } from '@/lib/archivos';
import { borrarObjetoHuerfano, guardarObjeto } from '@/lib/storage';

export const runtime = 'nodejs';

const fallo = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status, headers: { 'cache-control': 'no-store' } });

// Subida de un documento a un requisito. Solo se confirma al cliente cuando el archivo está
// guardado en el almacenamiento privado Y registrado en la base de datos (misma transacción).
export async function POST(req: Request) {
  const h = await headers();
  if (h.get('origin') !== env.origin) return fallo(403, 'Origen no permitido.');
  const sesion = await auth.api.getSession({ headers: h });
  if (!sesion) return fallo(401, 'Tu sesión ha caducado. Vuelve a entrar.');
  const largo = Number(h.get('content-length') || 0);
  if (largo > env.uploadMaxBytes + 64 * 1024) return fallo(413, `El archivo supera el máximo de ${env.uploadMaxBytes / 1024 / 1024} MB.`);

  let form: FormData;
  try { form = await req.formData(); } catch { return fallo(400, 'No hemos recibido el archivo completo. Inténtalo de nuevo.'); }
  const requisitoId = String(form.get('requisito') ?? '');
  const archivo = form.get('archivo');
  if (!UUID.test(requisitoId) || !(archivo instanceof File)) return fallo(400, 'Falta el archivo.');
  if (archivo.size === 0) return fallo(400, 'El archivo está vacío.');
  if (archivo.size > env.uploadMaxBytes) return fallo(413, `El archivo supera el máximo de ${env.uploadMaxBytes / 1024 / 1024} MB.`);

  const datos = new Uint8Array(await archivo.arrayBuffer());
  const mime = await detectarTipo(datos);
  if (!mime) return fallo(415, `Formato no admitido. Sube un ${Object.values(TIPOS).join(', ')}.`);
  if (mime === 'application/pdf') {
    const p = pdfSospechoso(datos);
    if (p) return fallo(422, p);
  }
  const sha256 = createHash('sha256').update(datos).digest('hex');
  const id = randomUUID();
  let clave = '';
  try {
    const r = await comoUsuario(sesion.user.id, async (tx) => {
      const q = await tx.query('select solicitud_id from portal.requisitos where id = $1', [requisitoId]);
      if (!q.rowCount) throw Object.assign(new Error('No encontrado'), { http: 404 });
      clave = `${q.rows[0].solicitud_id}/${id}`;
      const ins = await tx.query(
        `insert into portal.documentos (id, requisito_id, solicitud_id, cliente_id, version, storage_key, nombre_original, mime, tamano, sha256, subido_por)
         values ($1, $2, $3, $4, 0, $5, $6, $7, $8, $9, $4) returning version`,
        [id, requisitoId, q.rows[0].solicitud_id, sesion.user.id, clave, nombreSeguro(archivo.name), mime, datos.byteLength, sha256]);
      await guardarObjeto(clave, datos, mime);
      return ins.rows[0].version as number;
    });
    return NextResponse.json({ ok: true, documento: { id, version: r } }, { headers: { 'cache-control': 'no-store' } });
  } catch (e) {
    if (clave) await borrarObjetoHuerfano(clave);
    const err = e as { http?: number; code?: string; message: string };
    if (err.http === 404) return fallo(404, 'No encontrado.');
    if (err.code === '42501') return fallo(403, err.message.length < 120 ? err.message : 'No puedes subir documentos aquí.');
    if (err.code === '54000') return fallo(429, err.message);
    console.error('subida:', err.message);
    return fallo(500, 'No hemos podido guardar el archivo. Inténtalo de nuevo.');
  }
}
