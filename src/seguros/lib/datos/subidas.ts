import { q, q1 } from '../db';
import type { Usuario } from '../auth/sesiones';
import { esUuid, exigirPoliza } from '../acceso';
import { almacen } from '../almacen';
import { nuevaClave } from '../almacen';
import { Invalido, NoEncontrado } from '../errores';
import { superaLimite } from '../auth/limites';
import { maxBytes, subirDocumento, type ResultadoSubida } from './documentos';
import { exigirSiniestro, subirArchivoSiniestro } from './siniestros';
import { anadirArchivos, importacionDe } from '../ia/importacion';

/**
 * Subida por partes (las acciones de servidor del portal admiten como máximo 1 MB):
 * 1) el servidor comprueba permisos y emite una autorización de un solo uso por archivo;
 * 2) el navegador envía cada archivo a /api/seguros/subida, que lo guarda en el bucket privado (recibirSubida);
 * 3) el servidor lo vuelve a leer, valida tipo real, tamaño y hash y lo registra (o lo borra).
 * Solo se puede confirmar una clave emitida para ese usuario y ese destino en los últimos 30 minutos.
 */
type Destino = 'poliza' | 'siniestro' | 'importacion';

/** Titular del destino (null en una importación: aún no se sabe de quién es). */
async function titularDe(u: Usuario, destino: Destino, id: string): Promise<string | null> {
  if (!esUuid(id)) throw new NoEncontrado(destino);
  if (destino === 'importacion') {
    const i = await importacionDe(u, id);
    if (i.estado !== 'subiendo') throw new Invalido({ archivo: 'Esta importación ya se ha enviado.' });
    return null;
  }
  return destino === 'poliza' ? exigirPoliza(u, id) : exigirSiniestro(u, id);
}

export async function prepararSubidas(u: Usuario, destino: Destino, destinoId: string, archivos: { nombre: string; bytes: number }[]) {
  const titular = await titularDe(u, destino, destinoId);
  if (!archivos.length || archivos.length > 10) throw new Invalido({ archivo: 'Elige entre 1 y 10 archivos.' });
  for (const a of archivos) {
    if (!(a.bytes > 0) || a.bytes > maxBytes()) throw new Invalido({ archivo: `«${a.nombre}» está vacío o supera ${process.env.MAX_UPLOAD_MB ?? 25} MB.` });
  }
  if (await superaLimite(`subida:${u.id}`, 60, 60)) throw new Invalido({ archivo: 'Has subido muchos archivos seguidos. Espera unos minutos.' });
  await q(`DELETE FROM subidas_pendientes WHERE creada_en < now() - interval '1 day'`);
  const r: { clave: string; url: string; nombre: string }[] = [];
  for (const a of archivos) {
    const clave = nuevaClave(titular ?? destinoId);
    await q('INSERT INTO subidas_pendientes (clave_almacen, usuario_id, titular_id, destino, destino_id, nombre) VALUES ($1,$2,$3,$4,$5,$6)',
      [clave, u.id, titular, destino, destinoId, a.nombre.slice(0, 180)]);
    r.push({ clave, url: `/api/seguros/subida/?clave=${encodeURIComponent(clave)}`, nombre: a.nombre });
  }
  return r;
}

/** Paso 2: guarda el archivo solo si la clave está pendiente para esta persona (30 minutos, un único envío). */
export async function recibirSubida(u: Usuario, clave: string, datos: Buffer, mime: string) {
  if (!datos.length || datos.length > maxBytes()) throw new Invalido({ archivo: `El archivo está vacío o supera ${process.env.MAX_UPLOAD_MB ?? 25} MB.` });
  const p = await q1<{ nombre: string }>(
    `UPDATE subidas_pendientes SET recibida_en = now()
      WHERE clave_almacen = $1 AND usuario_id = $2 AND recibida_en IS NULL AND creada_en > now() - interval '30 minutes' RETURNING nombre`, [clave, u.id]);
  if (!p) throw new NoEncontrado('autorización de subida');
  try { await almacen().guardarEnClave(clave, datos, mime); } catch (e) {
    await q('UPDATE subidas_pendientes SET recibida_en = NULL WHERE clave_almacen = $1', [clave]); // se puede reintentar
    throw e;
  }
}

export async function confirmarSubidas(u: Usuario, destino: Destino, destinoId: string, claves: string[], extra: { tipo: string; anualidadId?: string | null }) {
  await titularDe(u, destino, destinoId);
  const resultados: (ResultadoSubida & { nombre: string })[] = [];
  const lote: { clave: string; nombre: string; datos: Buffer }[] = [];
  for (const clave of claves.slice(0, 10)) {
    const p = await q1<{ nombre: string }>(
      `DELETE FROM subidas_pendientes WHERE clave_almacen = $1 AND usuario_id = $2 AND destino = $3 AND destino_id = $4
         AND creada_en > now() - interval '30 minutes' RETURNING nombre`, [clave, u.id, destino, destinoId],
    );
    if (!p) throw new Invalido({ archivo: 'La autorización de subida no es válida o ha caducado. Vuelve a intentarlo.' });
    let datos: Buffer;
    try { datos = await almacen().leerBuffer(clave); } catch { throw new Invalido({ archivo: `No se ha recibido «${p.nombre}». Vuelve a subirlo.` }); }
    if (destino === 'importacion') {
      lote.push({ clave, nombre: p.nombre, datos });
      resultados.push({ id: clave, duplicadoDe: null, nombre: p.nombre });
    } else if (destino === 'poliza') {
      resultados.push({ ...(await subirDocumento(u, { polizaId: destinoId, anualidadId: extra.anualidadId, tipo: extra.tipo, nombre: p.nombre, datos, claveExistente: clave })), nombre: p.nombre });
    } else {
      const id = await subirArchivoSiniestro(u, destinoId, { tipo: extra.tipo, nombre: p.nombre, datos, claveExistente: clave });
      resultados.push({ id, duplicadoDe: null, nombre: p.nombre });
    }
  }
  if (destino === 'importacion') await anadirArchivos(u, destinoId, lote);
  return resultados;
}
