import { z } from 'zod';
import { q, q1, type Db, pool, transaccion } from '../db';
import type { Usuario } from '../auth/sesiones';
import { exigirPoliza, exigirTitular, esUuid } from '../acceso';
import { auditar } from '../auditoria';
import { Invalido, NoEncontrado } from '../errores';
import { casilla, fechaOpc, importeOpc, textoOpc, textoReq, triestado, validar } from '../validacion';

export type Ramo = { id: string; clave: string; nombre: string; icono: string; orden: number; activo: boolean };

export const listarRamos = (db: Db = pool()) =>
  q<Ramo>('SELECT id, clave, nombre, icono, orden, activo FROM ramos ORDER BY orden, nombre', [], db);

export const ESTADOS_POLIZA = {
  activa: 'Activa',
  en_negociacion: 'En negociación',
  anulada: 'Anulada',
  sustituida: 'Sustituida',
} as const;

// ---------------------------------------------------------------- Esquemas
const esquemaPoliza = z.object({
  titular_id: z.string().refine(esUuid, 'Elige el titular.'),
  ramo_id: z.string().refine(esUuid, 'Elige el tipo de seguro.'),
  nombre: textoReq(160, 'Pon un nombre que identifique la póliza (p. ej., «Furgoneta 1234-ABC»).'),
  riesgo: textoOpc(500),
  aseguradora: textoReq(160, 'Indica la aseguradora.'),
  numero: textoOpc(80),
  tomador: textoOpc(160),
  asegurado: textoOpc(300),
  beneficiario: textoOpc(300),
  mediador: textoOpc(160),
  mediador_telefono: textoOpc(40),
  mediador_email: z.preprocess((v) => (typeof v === 'string' ? v.trim() : v) || null, z.email('Correo no válido.').max(200).nullable()),
  asistencia_telefono: textoOpc(40),
  moneda: z.preprocess((v) => (typeof v === 'string' && v.trim() ? v.trim().toUpperCase() : 'EUR'), z.string().regex(/^[A-Z]{3}$/, 'Moneda no válida (EUR, USD…).')),
  renovacion_automatica: triestado,
  estado: z.enum(['activa', 'en_negociacion', 'anulada', 'sustituida']).default('activa'),
  notas: textoOpc(4000),
});

const esquemaAnualidad = z.object({
  inicio: fechaOpc,
  fin: fechaOpc,
  prima_anual: importeOpc,
  periodicidad: z.preprocess((v) => v || null, z.enum(['anual', 'semestral', 'trimestral', 'mensual', 'unica']).nullable()),
  importe_recibo: importeOpc,
  plazo_oposicion: fechaOpc,
  plazo_oposicion_fuente: textoOpc(300),
  plazo_oposicion_confirmado: casilla,
  datos_confirmados: casilla,
  notas_anualidad: textoOpc(2000),
}).superRefine((a, ctx) => {
  if (a.inicio && a.fin && a.fin <= a.inicio) ctx.addIssue({ code: 'custom', path: ['fin'], message: 'El vencimiento debe ser posterior al inicio.' });
  if (a.plazo_oposicion && a.fin && a.plazo_oposicion > a.fin) ctx.addIssue({ code: 'custom', path: ['plazo_oposicion'], message: 'El plazo de oposición no puede ser posterior al vencimiento.' });
  if (a.plazo_oposicion_confirmado && !a.plazo_oposicion) ctx.addIssue({ code: 'custom', path: ['plazo_oposicion'], message: 'Indica la fecha antes de confirmarla.' });
  if (a.plazo_oposicion_confirmado && !a.plazo_oposicion_fuente) ctx.addIssue({ code: 'custom', path: ['plazo_oposicion_fuente'], message: 'Indica de dónde sale el plazo (documento, cláusula, página).' });
});

export type DatosAnualidad = z.infer<typeof esquemaAnualidad>;

// ---------------------------------------------------------------- Consultas
export type Poliza = z.infer<typeof esquemaPoliza> & {
  id: string; titular_nombre: string; titular_tipo: 'empresa' | 'particular'; ramo_nombre: string; ramo_icono: string;
  sustituida_por: string | null; creada_en: Date; actualizada_en: Date; archivada_en: Date | null;
  siniestros_telefono: string | null; siniestros_email: string | null; siniestros_web: string | null;
  origen_datos: Record<string, import('../ia/importacion').Origen>;
};

export type Anualidad = {
  id: string; poliza_id: string; inicio: string | null; fin: string | null; prima_anual: string | null;
  periodicidad: string | null; importe_recibo: string | null; plazo_oposicion: string | null;
  plazo_oposicion_fuente: string | null; plazo_oposicion_confirmado: boolean; datos_confirmados: boolean;
  notas: string | null; creada_en: Date; anulada_en: Date | null;
};

export async function obtenerPoliza(u: Usuario, id: string, db: Db = pool()) {
  await exigirPoliza(u, id, db);
  const p = await q1<Poliza>(
    `SELECT p.*, t.nombre AS titular_nombre, t.tipo AS titular_tipo, r.nombre AS ramo_nombre, r.icono AS ramo_icono
       FROM polizas p JOIN titulares t ON t.id = p.titular_id JOIN ramos r ON r.id = p.ramo_id WHERE p.id = $1`, [id], db,
  );
  if (!p) throw new NoEncontrado('póliza');
  return p;
}

/** Anualidades de la póliza, la más reciente primero. */
export async function listarAnualidades(u: Usuario, polizaId: string, db: Db = pool()) {
  await exigirPoliza(u, polizaId, db);
  return q<Anualidad>(
    `SELECT * FROM anualidades WHERE poliza_id = $1 AND anulada_en IS NULL
      ORDER BY inicio DESC NULLS FIRST, creada_en DESC`, [polizaId], db,
  );
}

/**
 * Anualidad vigente en una fecha (para siniestros y avisos): la que contiene la fecha [inicio, fin).
 * Si hay varias candidatas por fechas incompletas se devuelven todas para que la persona elija.
 */
export async function anualidadesEnFecha(u: Usuario, polizaId: string, fecha: string, db: Db = pool()) {
  await exigirPoliza(u, polizaId, db);
  return q<Anualidad>(
    `SELECT * FROM anualidades WHERE poliza_id = $1 AND anulada_en IS NULL
        AND inicio IS NOT NULL AND inicio <= $2 AND (fin IS NULL OR fin > $2)
      ORDER BY inicio DESC`, [polizaId, fecha], db,
  );
}

// ---------------------------------------------------------------- Altas y cambios
function separar(datos: Record<string, unknown>) {
  const poliza = validar(esquemaPoliza, datos);
  const anualidad = validar(esquemaAnualidad, datos);
  return { poliza, anualidad };
}

async function comprobarSolape(db: Db, polizaId: string, a: DatosAnualidad, excluir?: string) {
  if (!a.inicio || !a.fin) return;
  const choque = await q1<{ inicio: string; fin: string }>(
    `SELECT inicio, fin FROM anualidades
      WHERE poliza_id = $1 AND anulada_en IS NULL AND ($4::uuid IS NULL OR id <> $4)
        AND inicio IS NOT NULL AND fin IS NOT NULL
        AND daterange(inicio, fin, '[)') && daterange($2::date, $3::date, '[)')`,
    [polizaId, a.inicio, a.fin, excluir ?? null], db,
  );
  if (choque) throw new Invalido({ inicio: `Se solapa con otra anualidad (${choque.inicio} – ${choque.fin}).` });
}

export async function crearPoliza(u: Usuario, datos: Record<string, unknown>) {
  const { poliza: p, anualidad: a } = separar(datos);
  await exigirTitular(u, p.titular_id);
  return transaccion(async (db) => {
    const ramo = await q1('SELECT 1 FROM ramos WHERE id = $1', [p.ramo_id], db);
    if (!ramo) throw new Invalido({ ramo_id: 'Tipo de seguro no válido.' });
    const { id } = (await q1<{ id: string }>(
      `INSERT INTO polizas (titular_id, ramo_id, nombre, riesgo, aseguradora, numero, tomador, asegurado, beneficiario,
         mediador, mediador_telefono, mediador_email, asistencia_telefono, moneda, renovacion_automatica, estado, notas, creada_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING id`,
      [p.titular_id, p.ramo_id, p.nombre, p.riesgo, p.aseguradora, p.numero, p.tomador, p.asegurado, p.beneficiario,
        p.mediador, p.mediador_telefono, p.mediador_email, p.asistencia_telefono, p.moneda, p.renovacion_automatica, p.estado, p.notas, u.id], db,
    ))!;
    const anualidadId = await insertarAnualidad(db, u, id, a);
    await auditar(u.id, 'poliza_creada', 'poliza', id, p.titular_id, { anualidad: anualidadId }, db);
    return id;
  });
}

async function insertarAnualidad(db: Db, u: Usuario, polizaId: string, a: DatosAnualidad) {
  await comprobarSolape(db, polizaId, a);
  const { id } = (await q1<{ id: string }>(
    `INSERT INTO anualidades (poliza_id, inicio, fin, prima_anual, periodicidad, importe_recibo, plazo_oposicion,
       plazo_oposicion_fuente, plazo_oposicion_confirmado, datos_confirmados, notas, creada_por)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
    [polizaId, a.inicio, a.fin, a.prima_anual, a.periodicidad, a.importe_recibo, a.plazo_oposicion,
      a.plazo_oposicion_fuente, a.plazo_oposicion_confirmado, a.datos_confirmados, a.notas_anualidad, u.id], db,
  ))!;
  return id;
}

export async function actualizarPoliza(u: Usuario, id: string, datos: Record<string, unknown>) {
  const titularActual = await exigirPoliza(u, id);
  const p = validar(esquemaPoliza, datos);
  // Cambiar de titular exige permiso también sobre el nuevo.
  if (p.titular_id !== titularActual) await exigirTitular(u, p.titular_id);
  await transaccion(async (db) => {
    const antes = await q1<Record<string, unknown>>('SELECT * FROM polizas WHERE id = $1 FOR UPDATE', [id], db);
    await q(
      `UPDATE polizas SET titular_id=$2, ramo_id=$3, nombre=$4, riesgo=$5, aseguradora=$6, numero=$7, tomador=$8, asegurado=$9,
         beneficiario=$10, mediador=$11, mediador_telefono=$12, mediador_email=$13, asistencia_telefono=$14, moneda=$15,
         renovacion_automatica=$16, estado=$17, notas=$18, actualizada_en=now() WHERE id=$1`,
      [id, p.titular_id, p.ramo_id, p.nombre, p.riesgo, p.aseguradora, p.numero, p.tomador, p.asegurado, p.beneficiario,
        p.mediador, p.mediador_telefono, p.mediador_email, p.asistencia_telefono, p.moneda, p.renovacion_automatica, p.estado, p.notas], db,
    );
    // Los documentos siguen al titular de su póliza.
    if (p.titular_id !== titularActual) await q('UPDATE documentos SET titular_id = $2 WHERE poliza_id = $1', [id, p.titular_id], db);
    const cambiados = Object.keys(p).filter((k) => String(antes?.[k] ?? '') !== String((p as Record<string, unknown>)[k] ?? ''));
    await auditar(u.id, 'poliza_modificada', 'poliza', id, p.titular_id, { campos: cambiados }, db);
  });
}

export async function archivarPoliza(u: Usuario, id: string, archivar: boolean) {
  const titular = await exigirPoliza(u, id);
  await transaccion(async (db) => {
    await q(`UPDATE polizas SET archivada_en = ${archivar ? 'now()' : 'NULL'}, actualizada_en = now() WHERE id = $1`, [id], db);
    await auditar(u.id, 'poliza_archivada', 'poliza', id, titular, { archivada: archivar }, db);
  });
}

/** Nueva anualidad (renovación o versión). Las anteriores no se tocan. */
export async function crearAnualidad(u: Usuario, polizaId: string, datos: Record<string, unknown>) {
  const titular = await exigirPoliza(u, polizaId);
  const a = validar(esquemaAnualidad, datos);
  return transaccion(async (db) => {
    const id = await insertarAnualidad(db, u, polizaId, a);
    await q('UPDATE polizas SET actualizada_en = now() WHERE id = $1', [polizaId], db);
    await auditar(u.id, 'anualidad_creada', 'anualidad', id, titular, { poliza: polizaId, inicio: a.inicio, fin: a.fin, prima_anual: a.prima_anual }, db);
    return id;
  });
}

const CAMPOS_SENSIBLES_AUDITORIA = ['inicio', 'fin', 'prima_anual', 'importe_recibo', 'periodicidad', 'plazo_oposicion', 'plazo_oposicion_confirmado'] as const;

/** Corrige una anualidad (errores de captura). Las fechas y primas cambiadas quedan auditadas con su valor anterior. */
export async function actualizarAnualidad(u: Usuario, anualidadId: string, datos: Record<string, unknown>) {
  if (!esUuid(anualidadId)) throw new NoEncontrado('anualidad');
  const fila = await q1<{ poliza_id: string }>('SELECT poliza_id FROM anualidades WHERE id = $1 AND anulada_en IS NULL', [anualidadId]);
  if (!fila) throw new NoEncontrado('anualidad');
  const titular = await exigirPoliza(u, fila.poliza_id);
  const a = validar(esquemaAnualidad, datos);
  await transaccion(async (db) => {
    const antes = (await q1<Anualidad>('SELECT * FROM anualidades WHERE id = $1 FOR UPDATE', [anualidadId], db))!;
    await comprobarSolape(db, fila.poliza_id, a, anualidadId);
    await q(
      `UPDATE anualidades SET inicio=$2, fin=$3, prima_anual=$4, periodicidad=$5, importe_recibo=$6, plazo_oposicion=$7,
         plazo_oposicion_fuente=$8, plazo_oposicion_confirmado=$9, datos_confirmados=$10, notas=$11, actualizada_en=now() WHERE id=$1`,
      [anualidadId, a.inicio, a.fin, a.prima_anual, a.periodicidad, a.importe_recibo, a.plazo_oposicion,
        a.plazo_oposicion_fuente, a.plazo_oposicion_confirmado, a.datos_confirmados, a.notas_anualidad], db,
    );
    const cambios: Record<string, [unknown, unknown]> = {};
    for (const k of CAMPOS_SENSIBLES_AUDITORIA) {
      const viejo = antes[k] ?? null;
      const nuevo = a[k] ?? null;
      if (String(viejo) !== String(nuevo)) cambios[k] = [viejo, nuevo];
    }
    await auditar(u.id, 'anualidad_modificada', 'anualidad', anualidadId, titular, { poliza: fila.poliza_id, cambios }, db);
  });
  return fila.poliza_id;
}

/** Anulación lógica de una anualidad creada por error (se conserva en la base de datos). */
export async function anularAnualidad(u: Usuario, anualidadId: string) {
  if (!esUuid(anualidadId)) throw new NoEncontrado('anualidad');
  const fila = await q1<{ poliza_id: string }>('SELECT poliza_id FROM anualidades WHERE id = $1 AND anulada_en IS NULL', [anualidadId]);
  if (!fila) throw new NoEncontrado('anualidad');
  const titular = await exigirPoliza(u, fila.poliza_id);
  const restantes = await q1<{ n: string }>('SELECT count(*) n FROM anualidades WHERE poliza_id = $1 AND anulada_en IS NULL', [fila.poliza_id]);
  if (Number(restantes?.n) <= 1) throw new Invalido({ _: 'La póliza debe conservar al menos una anualidad.' });
  await transaccion(async (db) => {
    await q('UPDATE anualidades SET anulada_en = now() WHERE id = $1', [anualidadId], db);
    await auditar(u.id, 'anualidad_anulada', 'anualidad', anualidadId, titular, { poliza: fila.poliza_id }, db);
  });
  return fila.poliza_id;
}

// ---------------------------------------------------------------- Ramos editables (administración)
const esquemaRamo = z.object({
  nombre: textoReq(80, 'Indica el nombre.'),
  icono: z.enum(['coche', 'hogar', 'negocio', 'salud', 'vida', 'accidentes', 'rc', 'transporte', 'defensa', 'otros']).default('otros'),
});

export async function crearRamo(u: Usuario, datos: unknown) {
  if (u.rol !== 'admin') throw new Invalido({ _: 'Solo un administrador puede gestionar los tipos de seguro.' });
  const d = validar(esquemaRamo, datos);
  const clave = d.nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'ramo';
  if (await q1('SELECT 1 FROM ramos WHERE clave = $1', [clave])) throw new Invalido({ nombre: 'Ya existe un tipo de seguro con ese nombre.' });
  await q('INSERT INTO ramos (clave, nombre, icono, orden) VALUES ($1,$2,$3,(SELECT coalesce(max(orden),0)+5 FROM ramos WHERE clave <> $4))', [clave, d.nombre, d.icono, 'otros']);
  await auditar(u.id, 'ramo_creado', 'ramo', clave);
}

export async function actualizarRamo(u: Usuario, id: string, datos: Record<string, unknown>) {
  if (u.rol !== 'admin') throw new Invalido({ _: 'Solo un administrador puede gestionar los tipos de seguro.' });
  if (!esUuid(id)) throw new NoEncontrado('tipo de seguro');
  const d = validar(esquemaRamo, datos);
  const activo = datos.activo === 'on';
  await q('UPDATE ramos SET nombre = $2, icono = $3, activo = $4 WHERE id = $1', [id, d.nombre, d.icono, activo]);
  await auditar(u.id, 'ramo_modificado', 'ramo', id, null, { activo });
}
