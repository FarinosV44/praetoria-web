import { q, type Db, pool } from './db';

export type Accion =
  | 'acceso' | 'acceso_fallido' | 'salida' | 'clave_cambiada' | 'recuperacion_solicitada'
  | 'usuario_creado' | 'usuario_modificado' | 'permiso_concedido' | 'permiso_retirado'
  | 'titular_creado' | 'titular_modificado' | 'titular_archivado'
  | 'poliza_creada' | 'poliza_modificada' | 'poliza_archivada'
  | 'anualidad_creada' | 'anualidad_modificada'
  | 'documento_subido' | 'documento_descargado' | 'documento_eliminado'
  | 'exportacion' | string;

/** Registra una acción. `detalle` solo con identificadores y nombres de campo, nunca contenidos sensibles. */
export async function auditar(
  usuarioId: string | null, accion: Accion, entidad: string, entidadId: string | null,
  titularId: string | null = null, detalle: Record<string, unknown> | null = null, db: Db = pool(),
) {
  await q(
    'INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id, titular_id, detalle) VALUES ($1,$2,$3,$4,$5,$6)',
    [usuarioId, accion, entidad, entidadId, titularId, detalle], db,
  );
}
