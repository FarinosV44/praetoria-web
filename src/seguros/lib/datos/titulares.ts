import { z } from 'zod';
import { q, q1, type Db, pool, transaccion } from '../db';
import type { Usuario } from '../auth/sesiones';
import { exigirRolAdmin, exigirTitular, filtroSql, titularesPermitidos } from '../acceso';
import { auditar } from '../auditoria';
import { textoOpc, textoReq, validar } from '../validacion';

export type Titular = { id: string; tipo: 'empresa' | 'particular'; nombre: string; nif: string | null; notas: string | null; archivado_en: Date | null };

const esquema = z.object({
  tipo: z.enum(['empresa', 'particular'], { error: 'Indica si es empresa o particular.' }),
  nombre: textoReq(160, 'Indica el nombre del titular.'),
  nif: textoOpc(20),
  notas: textoOpc(2000),
});

export async function listarTitulares(u: Usuario, { incluirArchivados = false } = {}, db: Db = pool()) {
  const params: unknown[] = [];
  const f = filtroSql(await titularesPermitidos(u, db), 'id', params);
  return q<Titular & { polizas: string }>(
    `SELECT t.id, t.tipo, t.nombre, t.nif, t.notas, t.archivado_en,
            (SELECT count(*) FROM polizas p WHERE p.titular_id = t.id AND p.archivada_en IS NULL) AS polizas
       FROM titulares t WHERE ${f} ${incluirArchivados ? '' : 'AND archivado_en IS NULL'}
      ORDER BY t.tipo, lower(t.nombre)`, params, db,
  );
}

export async function obtenerTitular(u: Usuario, id: string, db: Db = pool()) {
  await exigirTitular(u, id, db);
  return (await q1<Titular>('SELECT id, tipo, nombre, nif, notas, archivado_en FROM titulares WHERE id = $1', [id], db))!;
}

export async function crearTitular(u: Usuario, datos: unknown) {
  exigirRolAdmin(u);
  const d = validar(esquema, datos);
  return transaccion(async (db) => {
    const t = (await q1<{ id: string }>(
      'INSERT INTO titulares (tipo, nombre, nif, notas) VALUES ($1,$2,$3,$4) RETURNING id', [d.tipo, d.nombre, d.nif, d.notas], db,
    ))!;
    await auditar(u.id, 'titular_creado', 'titular', t.id, t.id, { tipo: d.tipo }, db);
    return t.id;
  });
}

export async function actualizarTitular(u: Usuario, id: string, datos: unknown) {
  exigirRolAdmin(u);
  await exigirTitular(u, id);
  const d = validar(esquema, datos);
  await transaccion(async (db) => {
    await q('UPDATE titulares SET tipo=$2, nombre=$3, nif=$4, notas=$5, actualizado_en=now() WHERE id=$1', [id, d.tipo, d.nombre, d.nif, d.notas], db);
    await auditar(u.id, 'titular_modificado', 'titular', id, id, null, db);
  });
}

export async function archivarTitular(u: Usuario, id: string, archivar: boolean) {
  exigirRolAdmin(u);
  await exigirTitular(u, id);
  await transaccion(async (db) => {
    await q(`UPDATE titulares SET archivado_en = ${archivar ? 'now()' : 'NULL'}, actualizado_en = now() WHERE id = $1`, [id], db);
    await auditar(u.id, 'titular_archivado', 'titular', id, id, { archivado: archivar }, db);
  });
}
