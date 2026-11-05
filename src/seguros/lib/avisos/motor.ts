import { q, q1, type Db, pool } from '../db';
import { hoyMadrid, sumarDias, sumarMeses, ZONA } from '../fechas';
import { correoConfigurado } from '../correo';

/**
 * Motor de avisos (#4). Se ejecuta en el servidor (worker o cron), sin depender de visitas a la web.
 *
 * Reglas, siempre sobre la ÚLTIMA anualidad de pólizas activas o en negociación (no archivadas):
 *  - vencimiento_mes: un mes natural antes del vencimiento (31-03 → 28/29-02). No se sustituye por 30 días.
 *  - oposicion: N días antes de la fecha límite de oposición, solo si está confirmada con su fuente.
 *  - recordatorio: N días antes del vencimiento (configurable; 0 = desactivado).
 *  - vencida: el vencimiento ya pasó y no hay anualidad nueva: aviso contextual, nunca «vence en un mes».
 * Si una póliza se da de alta ya dentro de la ventana, el aviso sale en la siguiente ejecución.
 * Cambiar fechas, renovar, anular o archivar deja obsoletos los avisos que ya no corresponden.
 */

export type Ajustes = { margenOposicion: number; recordatorio: number; repetirDias: number; maxRepeticiones: number; horaEnvio: number };

export async function leerAjustes(db: Db = pool()): Promise<Ajustes> {
  const filas = await q<{ clave: string; valor: number }>(`SELECT clave, valor FROM ajustes WHERE clave LIKE 'avisos.%'`, [], db);
  const v = (k: string, d: number) => Number(filas.find((f) => f.clave === `avisos.${k}`)?.valor ?? d);
  return { margenOposicion: v('margen_oposicion_dias', 15), recordatorio: v('recordatorio_dias', 7), repetirDias: v('repetir_dias', 7), maxRepeticiones: v('max_repeticiones', 2), horaEnvio: v('hora_envio', 9) };
}

export const horaMadrid = (ahora: Date) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: ZONA, hour: '2-digit', hourCycle: 'h23' }).format(ahora));

type Candidata = {
  anualidad_id: string; poliza_id: string; titular_id: string; fin: string;
  plazo_oposicion: string | null; plazo_oposicion_confirmado: boolean; estado: string;
};

export type AvisoCalculado = { clave: string; anualidad_id: string; poliza_id: string; titular_id: string; tipo: string; fecha: string; referencia: string };

/** Avisos que deben existir hoy, según las reglas. Función pura (probada con reloj controlado). */
export function calcularAvisos(c: Candidata, hoy: string, a: Ajustes): AvisoCalculado[] {
  const base = { anualidad_id: c.anualidad_id, poliza_id: c.poliza_id, titular_id: c.titular_id };
  const r: AvisoCalculado[] = [];
  const mk = (tipo: string, fecha: string, referencia: string) => r.push({ ...base, tipo, fecha, referencia, clave: `${c.anualidad_id}:${tipo}:${referencia}:${fecha}` });
  if (c.fin < hoy) {
    if (c.estado === 'activa') mk('vencida', c.fin, c.fin);
    return r;
  }
  mk('vencimiento_mes', sumarMeses(c.fin, -1), c.fin);
  if (a.recordatorio > 0) mk('recordatorio', sumarDias(c.fin, -a.recordatorio), c.fin);
  if (c.plazo_oposicion && c.plazo_oposicion_confirmado && c.plazo_oposicion >= hoy) {
    mk('oposicion', sumarDias(c.plazo_oposicion, -a.margenOposicion), c.plazo_oposicion);
  }
  return r;
}

const SQL_CANDIDATAS = `
  SELECT a.id AS anualidad_id, p.id AS poliza_id, p.titular_id, a.fin, a.plazo_oposicion, a.plazo_oposicion_confirmado, p.estado
    FROM polizas p
    JOIN titulares t ON t.id = p.titular_id AND t.archivado_en IS NULL
    JOIN LATERAL (
      SELECT * FROM anualidades x WHERE x.poliza_id = p.id AND x.anulada_en IS NULL
       ORDER BY x.inicio DESC NULLS FIRST, x.creada_en DESC LIMIT 1) a ON TRUE
   WHERE p.archivada_en IS NULL AND p.estado IN ('activa', 'en_negociacion') AND a.fin IS NOT NULL`;

/**
 * Sincroniza la tabla de avisos con las reglas (idempotente). Devuelve cuántos se crearon y cuántos quedaron obsoletos.
 * Solo se programan avisos cuya fecha ya llegó o llegará; los de días pasados se crean igualmente para no perderlos
 * tras una caída (recuperación), salvo que su referencia ya haya pasado.
 */
export async function planificar(hoy: string, db: Db = pool()) {
  const ajustes = await leerAjustes(db);
  const candidatas = await q<Candidata>(SQL_CANDIDATAS, [], db);
  const deseados = candidatas.flatMap((c) => calcularAvisos(c, hoy, ajustes));
  let creados = 0;
  for (const a of deseados) {
    const r = await q(
      `INSERT INTO avisos (clave, anualidad_id, poliza_id, titular_id, tipo, fecha, referencia)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (clave) DO NOTHING RETURNING id`,
      [a.clave, a.anualidad_id, a.poliza_id, a.titular_id, a.tipo, a.fecha, a.referencia], db,
    );
    creados += r.length;
  }
  // Lo que ya no corresponde (fecha corregida, renovada, anulada, archivada, recordatorio desactivado…) queda obsoleto
  // y sus envíos pendientes se descartan. Los ya atendidos no se tocan.
  const obsoletos = await q<{ id: string }>(
    `UPDATE avisos SET estado = 'obsoleto', obsoleto_en = now()
      WHERE estado IN ('programado', 'emitido', 'pospuesto') AND NOT (clave = ANY($1::text[])) RETURNING id`,
    [deseados.map((d) => d.clave)], db,
  );
  if (obsoletos.length) {
    await q(`UPDATE envios SET estado = 'descartado', ultimo_error = 'Aviso obsoleto' WHERE estado IN ('pendiente', 'fallido') AND aviso_id = ANY($1::uuid[])`, [obsoletos.map((o) => o.id)], db);
  }
  return { creados, obsoletos: obsoletos.length };
}

/** Personas que deben recibir avisos de un titular: administradores activos y colaboradores con acceso. */
export const destinatarios = (titularId: string, db: Db = pool()) =>
  q<{ id: string; email: string; correo_avisos: string }>(
    `SELECT u.id, u.email, u.correo_avisos FROM usuarios u
      WHERE u.activo AND (u.rol = 'admin' OR EXISTS (SELECT 1 FROM accesos_titular a WHERE a.usuario_id = u.id AND a.titular_id = $1))`,
    [titularId], db,
  );

/** Crea los envíos de una emisión (idempotente por clave). */
export async function encolar(avisoId: string, titularId: string, emision: string, db: Db = pool()) {
  let n = 0;
  for (const u of await destinatarios(titularId, db)) {
    const subs = await q<{ id: string }>('SELECT id FROM push_suscripciones WHERE usuario_id = $1 AND revocada_en IS NULL', [u.id], db);
    const filas: [string, string | null][] = [['app', null], ...subs.map((s) => ['push', s.id] as [string, string])];
    // Sin SMTP no se encola correo: el estado del servicio lo muestra como «sin configurar».
    if (correoConfigurado() && (u.correo_avisos === 'siempre' || (u.correo_avisos === 'respaldo' && subs.length === 0))) filas.push(['correo', null]);
    for (const [canal, sub] of filas) {
      const r = await q(
        `INSERT INTO envios (clave, aviso_id, usuario_id, canal, suscripcion_id, estado, enviado_en)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (clave) DO NOTHING RETURNING id`,
        [`${avisoId}:${emision}:${canal}:${u.id}:${sub ?? ''}`, avisoId, u.id, canal, sub,
          canal === 'app' ? 'enviado' : 'pendiente', canal === 'app' ? new Date() : null], db,
      );
      n += r.length;
    }
  }
  return n;
}

/**
 * Emite los avisos cuya fecha ha llegado (a partir de la hora de envío en Madrid), los pospuestos que vencen
 * y las repeticiones de los no atendidos. Cada emisión tiene su propia clave: repetir la tarea no duplica.
 */
export async function emitir(ahora: Date, db: Db = pool()) {
  const hoy = hoyMadrid(ahora);
  const a = await leerAjustes(db);
  if (horaMadrid(ahora) < a.horaEnvio) return { emitidos: 0, envios: 0, esperando: true };
  let emitidos = 0, envios = 0;

  const nuevos = await q<{ id: string; titular_id: string; anualidad_id: string; tipo: string }>(
    `SELECT id, titular_id, anualidad_id, tipo FROM avisos WHERE estado = 'programado' AND fecha <= $1 AND (referencia >= $1 OR tipo = 'vencida')`, [hoy], db,
  );
  // Si una póliza entra ya dentro de la ventana con el aviso de un mes y el recordatorio a la vez, solo sale el más próximo.
  const conRecordatorio = new Set(nuevos.filter((x) => x.tipo === 'recordatorio').map((x) => x.anualidad_id));
  for (const x of nuevos) {
    if (x.tipo === 'vencimiento_mes' && conRecordatorio.has(x.anualidad_id)) {
      await q(`UPDATE avisos SET estado = 'obsoleto', obsoleto_en = now() WHERE id = $1`, [x.id], db);
      continue;
    }
    envios += await encolar(x.id, x.titular_id, 'e0', db);
    await q(`UPDATE avisos SET estado = 'emitido', emitido_en = coalesce(emitido_en, $2), ultima_emision = $2 WHERE id = $1`, [x.id, ahora], db);
    emitidos++;
  }
  // Pospuestos cuya fecha ha llegado
  const pospuestos = await q<{ id: string; titular_id: string; pospuesto_hasta: string }>(
    `SELECT id, titular_id, pospuesto_hasta FROM avisos WHERE estado = 'pospuesto' AND pospuesto_hasta <= $1 AND (referencia >= $1 OR tipo = 'vencida')`, [hoy], db,
  );
  for (const x of pospuestos) {
    envios += await encolar(x.id, x.titular_id, `p${x.pospuesto_hasta}`, db);
    await q(`UPDATE avisos SET estado = 'emitido', ultima_emision = $2 WHERE id = $1`, [x.id, ahora], db);
    emitidos++;
  }
  // Repeticiones de avisos sin atender (no los de póliza vencida, que se avisan una vez)
  if (a.repetirDias > 0) {
    const sinAtender = await q<{ id: string; titular_id: string; repeticiones: number }>(
      `SELECT id, titular_id, repeticiones FROM avisos
        WHERE estado = 'emitido' AND tipo <> 'vencida' AND referencia >= $1 AND repeticiones < $2
          AND (ultima_emision AT TIME ZONE 'Europe/Madrid')::date <= ($1::date - $3::int)`,
      [hoy, a.maxRepeticiones, a.repetirDias], db,
    );
    for (const x of sinAtender) {
      envios += await encolar(x.id, x.titular_id, `r${x.repeticiones + 1}`, db);
      await q(`UPDATE avisos SET repeticiones = repeticiones + 1, ultima_emision = $2 WHERE id = $1`, [x.id, ahora], db);
      emitidos++;
    }
  }
  return { emitidos, envios, esperando: false };
}

// ---------------------------------------------------------------- Acciones de la persona sobre un aviso
export async function atenderAviso(usuarioId: string, avisoId: string, accion: 'reconocer' | 'posponer' | 'negociar', hasta: string | null, db: Db = pool()) {
  if (accion === 'posponer') {
    await q(`UPDATE avisos SET estado = 'pospuesto', pospuesto_hasta = $3, atendido_por = $2, atendido_en = now() WHERE id = $1 AND estado <> 'obsoleto'`, [avisoId, usuarioId, hasta], db);
  } else {
    await q(`UPDATE avisos SET estado = $3, atendido_por = $2, atendido_en = now() WHERE id = $1 AND estado <> 'obsoleto'`, [avisoId, usuarioId, accion === 'negociar' ? 'en_negociacion' : 'reconocido'], db);
    if (accion === 'negociar') await q(`UPDATE polizas SET estado = 'en_negociacion', actualizada_en = now() WHERE id = (SELECT poliza_id FROM avisos WHERE id = $1) AND estado = 'activa'`, [avisoId], db);
  }
  // Los envíos pendientes de este aviso ya no hacen falta.
  await q(`UPDATE envios SET estado = 'descartado', ultimo_error = 'Atendido' WHERE aviso_id = $1 AND estado = 'pendiente'`, [avisoId], db);
}

export async function marcarLeido(usuarioId: string, avisoId: string, db: Db = pool()) {
  await q('UPDATE envios SET leido_en = coalesce(leido_en, now()) WHERE aviso_id = $1 AND usuario_id = $2', [avisoId, usuarioId], db);
}

export async function registrarEjecucion<T>(tarea: string, fn: () => Promise<T>, db: Db = pool()): Promise<T> {
  const { id } = (await q1<{ id: string }>('INSERT INTO ejecuciones (tarea) VALUES ($1) RETURNING id', [tarea], db))!;
  try {
    const r = await fn();
    await q('UPDATE ejecuciones SET fin = now(), ok = true, resumen = $2 WHERE id = $1', [id, JSON.stringify(r)], db);
    return r;
  } catch (e) {
    await q('UPDATE ejecuciones SET fin = now(), ok = false, error = $2 WHERE id = $1', [id, String((e as Error).message).slice(0, 500)], db);
    throw e;
  }
}
