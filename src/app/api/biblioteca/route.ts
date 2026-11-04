import { NextResponse } from 'next/server';
import { createHash, randomUUID } from 'node:crypto';
import { headers } from 'next/headers';
import { auth } from '@/portal/lib/auth';
import { comoUsuario } from '@/portal/lib/db';
import { UUID } from '@/portal/lib/datos';
import { env } from '@/portal/lib/env';
import { DOCX, detectarTipo, nombreSeguro, pdfSospechoso } from '@/portal/lib/archivos';
import { datosIdentificables, metadatosDocx, sugerirClasificacion } from '@/portal/lib/biblioteca';
import { extraerTexto } from '@/portal/lib/ia';
import { borrarObjetoHuerfano, guardarObjeto } from '@/portal/lib/storage';
import { personalSinMfa } from '@/portal/lib/sesion';

export const runtime = 'nodejs';
const fallo = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status, headers: { 'cache-control': 'no-store' } });

// Subida a la biblioteca jurídica (#92): un archivo (PDF o Word) o un texto pegado. Crea un modelo nuevo con la
// clasificación sugerida (corregible) o añade una versión a un modelo existente. El original no se modifica nunca.
export async function POST(req: Request) {
  const h = await headers();
  if (h.get('origin') !== env.origin) return fallo(403, 'Origen no permitido.');
  const sesion = await auth.api.getSession({ headers: h });
  if (!sesion) return fallo(401, 'Tu sesión ha caducado. Vuelve a entrar.');
  if (await personalSinMfa(sesion.user.id, sesion.user.twoFactorEnabled)) return fallo(403, 'Activa el doble factor antes de continuar.');
  if (Number(h.get('content-length') || 0) > env.uploadMaxBytes + 64 * 1024) return fallo(413, `El archivo supera el máximo de ${env.uploadMaxBytes / 1024 / 1024} MB.`);
  let form: FormData;
  try { form = await req.formData(); } catch { return fallo(400, 'No hemos recibido el contenido completo.'); }
  const modelo = String(form.get('modelo') ?? '');
  const archivo = form.get('archivo');
  const pegado = String(form.get('texto') ?? '').trim();
  const nota = String(form.get('nota') ?? '').trim().slice(0, 500) || null;

  let datos: Uint8Array | null = null, mime: string | null = null, nombre = 'Texto pegado', texto = '';
  const avisos: string[] = [];
  if (archivo instanceof File && archivo.size > 0) {
    if (archivo.size > env.uploadMaxBytes) return fallo(413, `El archivo supera el máximo de ${env.uploadMaxBytes / 1024 / 1024} MB.`);
    try { void env.storageUrl; void env.storageKey; } catch { return fallo(503, 'El almacenamiento de documentos no está configurado en el servidor.'); }
    datos = new Uint8Array(await archivo.arrayBuffer());
    mime = await detectarTipo(datos);
    if (mime !== 'application/pdf' && mime !== DOCX) return fallo(415, 'En la biblioteca se guardan escritos en PDF o Word (DOCX).');
    if (mime === 'application/pdf') { const s = pdfSospechoso(datos); if (s) return fallo(422, s); }
    nombre = nombreSeguro(archivo.name);
    try { const x = await extraerTexto(datos, mime); texto = x.paginas.join('\n\n'); if (!texto) avisos.push(x.detalle ?? 'sin texto legible'); }
    catch { avisos.push('no se ha podido extraer el texto'); }
    if (mime === DOCX) avisos.push(...metadatosDocx(datos));
  } else if (pegado.length >= 20) {
    texto = pegado;
  } else return fallo(400, 'Arrastra un PDF o Word, o pega el texto del escrito.');
  if (texto.length > 600000) texto = texto.slice(0, 600000);
  avisos.push(...datosIdentificables(texto, nombre));

  const vid = randomUUID();
  let clave = '';
  try {
    const r = await comoUsuario(sesion.user.id, async (tx) => {
      let mid = modelo;
      let sugerida = null as null | ReturnType<typeof sugerirClasificacion>;
      if (!UUID.test(mid)) {
        const procs = (await tx.query('select id, materia_id, nombre from portal.bib_procedimientos where activo')).rows;
        sugerida = sugerirClasificacion(texto, nombre, procs);
        const titulo = (archivo instanceof File ? nombre.replace(/\.[A-Za-z0-9]{1,5}$/, '') : texto.split('\n').find((l) => l.trim().length > 3)?.trim() ?? 'Escrito pegado').slice(0, 200);
        mid = (await tx.query(`insert into portal.bib_modelos (titulo, materia_id, procedimiento_id, tipo_escrito, autor_id) values ($1, $2, $3, $4, $5) returning id`,
          [titulo.length >= 3 ? titulo : 'Escrito sin título', sugerida.materia, sugerida.procedimiento, sugerida.tipo, sesion.user.id])).rows[0].id;
      } else if (!(await tx.query('select 1 from portal.bib_modelos where id = $1', [mid])).rowCount) {
        throw Object.assign(new Error('No encontrado'), { http: 404 });
      }
      clave = datos ? `biblioteca/${mid}/${vid}` : '';
      const v = await tx.query(`insert into portal.bib_versiones (id, modelo_id, version, origen, storage_key, nombre_original, mime, tamano, sha256, texto, avisos, nota, subido_por)
        values ($1, $2, 0, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) returning version`,
        [vid, mid, datos ? 'archivo' : 'pegado', clave || null, datos ? nombre : null, mime, datos?.byteLength ?? null,
          datos ? createHash('sha256').update(datos).digest('hex') : null, texto, JSON.stringify(avisos), nota, sesion.user.id]);
      if (datos && mime) await guardarObjeto(clave, datos, mime);
      return { modelo: mid, version: v.rows[0].version as number, sugerida, avisos };
    });
    return NextResponse.json({ ok: true, ...r }, { headers: { 'cache-control': 'no-store' } });
  } catch (e) {
    if (clave) await borrarObjetoHuerfano(clave);
    const err = e as { http?: number; code?: string; message: string };
    if (err.http === 404) return fallo(404, 'No encontrado.');
    if (err.code === '42501' || /row-level/.test(err.message)) return fallo(403, 'No puedes añadir escritos a este modelo.');
    console.error('biblioteca: subida fallida', err.code ?? '', err.message.slice(0, 160));
    return fallo(500, 'No hemos podido guardar el escrito. Inténtalo de nuevo.');
  }
}
