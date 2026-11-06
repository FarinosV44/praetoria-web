import { createHash } from 'node:crypto';
import { q, q1, type Db, pool, transaccion } from '../db';
import type { Usuario } from '../auth/sesiones';
import { esUuid, exigirPoliza, puedeVerTitular } from '../acceso';
import { auditar } from '../auditoria';
import { almacen } from '../almacen';
import { Invalido, NoEncontrado } from '../errores';
import { detectarTipo, TIPOS_ADMITIDOS } from '../tipos-archivo';
import { registrarIntento, superaLimite } from '../auth/limites';
import { guardarTextoDocumento } from '../pdf-texto';

export const TIPOS_DOCUMENTO = {
  condiciones_particulares: 'Condiciones particulares',
  condiciones_generales: 'Condiciones generales',
  suplemento: 'Suplemento o modificación',
  renovacion: 'Renovación',
  recibo: 'Recibo',
  justificante_pago: 'Justificante de pago',
  comunicacion: 'Carta o correo',
  siniestro: 'Documentación de siniestro',
  informe: 'Informe o peritación',
  fotografia: 'Fotografía',
  reclamacion: 'Reclamación',
  oferta: 'Oferta',
  otro: 'Otro',
} as const;
export type TipoDocumento = keyof typeof TIPOS_DOCUMENTO;

export type Documento = {
  id: string; poliza_id: string; anualidad_id: string | null; titular_id: string; tipo: TipoDocumento;
  nombre_original: string; mime: string; bytes: string; sha256: string; paginas: number | null;
  estado: string; subido_en: Date; subido_por_nombre: string | null; duplicado_de: string | null;
  fecha_documento: string | null; descripcion: string | null; siniestro_id: string | null;
};

export const maxBytes = () => Number(process.env.MAX_UPLOAD_MB ?? 25) * 1024 * 1024;

export async function listarDocumentos(u: Usuario, polizaId: string, db: Db = pool()) {
  await exigirPoliza(u, polizaId, db);
  return q<Documento>(
    `SELECT d.id, d.poliza_id, d.anualidad_id, d.titular_id, d.tipo, d.nombre_original, d.mime, d.bytes, d.sha256, d.paginas,
            d.estado, d.subido_en, us.nombre AS subido_por_nombre, d.fecha_documento, d.descripcion,
            (SELECT ds.siniestro_id FROM documento_siniestros ds WHERE ds.documento_id = d.id LIMIT 1) AS siniestro_id,
            (SELECT o.nombre_original FROM documentos o WHERE o.titular_id = d.titular_id AND o.sha256 = d.sha256
               AND o.id <> d.id AND o.eliminado_en IS NULL AND o.subido_en < d.subido_en ORDER BY o.subido_en LIMIT 1) AS duplicado_de
       FROM documentos d LEFT JOIN usuarios us ON us.id = d.subido_por
      WHERE d.poliza_id = $1 AND d.eliminado_en IS NULL
      ORDER BY coalesce(d.fecha_documento, d.subido_en::date) DESC, d.subido_en DESC`, [polizaId], db,
  );
}

function limpiarNombre(n: string) {
  // Sin rutas ni caracteres de control; se conserva el nombre para que el usuario lo reconozca.
  const base = n.split(/[\\/]/).pop() ?? 'documento';
  return base.replace(/[\u0000-\u001f\u007f"<>]/g, '').trim().slice(0, 180) || 'documento';
}

export type ResultadoSubida = { id: string; duplicadoDe: string | null };

/** Guarda un documento privado asociado a una póliza (y opcionalmente a una anualidad). */
export async function subirDocumento(
  u: Usuario,
  { polizaId, anualidadId, tipo, nombre, datos, claveExistente }: { polizaId: string; anualidadId?: string | null; tipo: string; nombre: string; datos: Buffer; claveExistente?: string },
): Promise<ResultadoSubida> {
  const titularId = await exigirPoliza(u, polizaId);
  // Si el archivo ya está en el almacén (subida directa) y algo no es válido, se borra.
  try { return await registrar(); } catch (e) { if (claveExistente) await almacen().borrar(claveExistente).catch(() => undefined); throw e; }
  async function registrar(): Promise<ResultadoSubida> {
  if (!(tipo in TIPOS_DOCUMENTO)) throw new Invalido({ tipo: 'Elige el tipo de documento.' });
  if (datos.length === 0) throw new Invalido({ archivo: 'El archivo está vacío.' });
  if (datos.length > maxBytes()) throw new Invalido({ archivo: `El archivo supera el máximo de ${process.env.MAX_UPLOAD_MB ?? 25} MB.` });
  const mime = detectarTipo(datos);
  if (!mime) throw new Invalido({ archivo: `Formato no admitido. Sube ${Object.values(TIPOS_ADMITIDOS).join(', ')}.` });
  if (anualidadId) {
    if (!esUuid(anualidadId) || !(await q1('SELECT 1 FROM anualidades WHERE id = $1 AND poliza_id = $2', [anualidadId, polizaId]))) {
      throw new Invalido({ anualidad_id: 'La anualidad no pertenece a esta póliza.' });
    }
  }
  // Límite de operaciones costosas: 60 subidas por hora y usuario.
  const claveLimite = `subida:${u.id}`;
  if (await superaLimite(claveLimite, 60, 60)) throw new Invalido({ archivo: 'Has subido muchos archivos seguidos. Espera unos minutos.' });

  const sha256 = createHash('sha256').update(datos).digest('hex');
  const duplicado = await q1<{ nombre_original: string }>(
    'SELECT nombre_original FROM documentos WHERE titular_id = $1 AND sha256 = $2 AND eliminado_en IS NULL ORDER BY subido_en LIMIT 1',
    [titularId, sha256],
  );
  const clave = claveExistente ?? await almacen().guardar(titularId, datos, mime);
  try {
    const id = await transaccion(async (db) => {
      const { id } = (await q1<{ id: string }>(
        `INSERT INTO documentos (poliza_id, anualidad_id, titular_id, tipo, nombre_original, mime, bytes, sha256, clave_almacen, subido_por)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [polizaId, anualidadId || null, titularId, tipo, limpiarNombre(nombre), mime, datos.length, sha256, clave, u.id], db,
      ))!;
      await auditar(u.id, 'documento_subido', 'documento', id, titularId, { poliza: polizaId, tipo, bytes: datos.length, duplicado: !!duplicado }, db);
      return id;
    });
    await registrarIntento(claveLimite, false); // cuenta para el límite
    // Texto por página para poder verificar citas. Si falla, el documento queda guardado igualmente.
    if (mime === 'application/pdf') await guardarTextoDocumento(id, datos).catch(() => undefined);
    return { id, duplicadoDe: duplicado?.nombre_original ?? null };
  } catch (e) {
    await almacen().borrar(clave);
    throw e;
  }
  }
}

/** Documento para servirlo: comprueba permisos sobre su titular. */
export async function documentoParaDescarga(u: Usuario, id: string, db: Db = pool()) {
  if (!esUuid(id)) throw new NoEncontrado('documento');
  const d = await q1<{ id: string; titular_id: string; nombre_original: string; mime: string; clave_almacen: string; poliza_id: string }>(
    'SELECT id, titular_id, nombre_original, mime, clave_almacen, poliza_id FROM documentos WHERE id = $1 AND eliminado_en IS NULL', [id], db,
  );
  if (!d || !(await puedeVerTitular(u, d.titular_id, db))) throw new NoEncontrado('documento');
  return d;
}

export async function cambiarDocumento(u: Usuario, id: string, cambios: { tipo?: string; anualidadId?: string | null }) {
  const d = await documentoParaDescarga(u, id);
  if (cambios.tipo && !(cambios.tipo in TIPOS_DOCUMENTO)) throw new Invalido({ tipo: 'Tipo no válido.' });
  if (cambios.anualidadId && !(await q1('SELECT 1 FROM anualidades WHERE id = $1 AND poliza_id = $2', [cambios.anualidadId, d.poliza_id]))) {
    throw new Invalido({ anualidad_id: 'La anualidad no pertenece a esta póliza.' });
  }
  await transaccion(async (db) => {
    await q(
      'UPDATE documentos SET tipo = coalesce($2, tipo), anualidad_id = CASE WHEN $4 THEN $3::uuid ELSE anualidad_id END WHERE id = $1',
      [id, cambios.tipo ?? null, cambios.anualidadId || null, cambios.anualidadId !== undefined], db,
    );
    await auditar(u.id, 'documento_modificado', 'documento', id, d.titular_id, { campos: Object.keys(cambios) }, db);
  });
  return d.poliza_id;
}

/**
 * Baja de un documento: deja de estar accesible al momento. El archivo se elimina del almacén
 * cuando vence el periodo de retención (ver docs/SEGURIDAD.md).
 */
export async function eliminarDocumento(u: Usuario, id: string) {
  const d = await documentoParaDescarga(u, id);
  await transaccion(async (db) => {
    await q('UPDATE documentos SET eliminado_en = now() WHERE id = $1', [id], db);
    await auditar(u.id, 'documento_eliminado', 'documento', id, d.titular_id, { poliza: d.poliza_id }, db);
  });
  return d.poliza_id;
}
