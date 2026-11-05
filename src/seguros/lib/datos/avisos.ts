import { z } from 'zod';
import { q, q1, type Db, pool } from '../db';
import type { Usuario } from '../auth/sesiones';
import { esUuid, filtroSql, puedeVerTitular, titularesPermitidos, exigirRolAdmin } from '../acceso';
import { auditar } from '../auditoria';
import { NoEncontrado, Invalido } from '../errores';
import { atenderAviso, marcarLeido } from '../avisos/motor';
import { esFecha, hoyMadrid } from '../fechas';
import { validar } from '../validacion';
import { pushConfigurado } from '../avisos/push';
import { correoConfigurado } from '../correo';

export type AvisoLista = {
  id: string; tipo: string; fecha: string; referencia: string; estado: string; pospuesto_hasta: string | null;
  poliza_id: string; poliza: string; titular: string; ramo_icono: string; aseguradora: string;
  canales: { canal: string; estado: string; error: string | null; leido: boolean }[];
};

const SQL = (filtro: string) => `
  SELECT v.id, v.tipo, v.fecha, v.referencia, v.estado, v.pospuesto_hasta, v.poliza_id, p.nombre AS poliza, t.nombre AS titular,
         r.icono AS ramo_icono, p.aseguradora,
         coalesce((SELECT json_agg(json_build_object('canal', e.canal, 'estado', e.estado, 'error', e.ultimo_error, 'leido', e.leido_en IS NOT NULL) ORDER BY e.creado_en DESC)
                     FROM envios e WHERE e.aviso_id = v.id AND e.usuario_id = $1), '[]') AS canales
    FROM avisos v JOIN polizas p ON p.id = v.poliza_id JOIN titulares t ON t.id = v.titular_id JOIN ramos r ON r.id = p.ramo_id
   WHERE ${filtro}`;

/** Centro de avisos: lo emitido y pendiente de atender primero; después el historial reciente. */
export async function listarAvisos(u: Usuario, { historial = false } = {}, db: Db = pool()) {
  const params: unknown[] = [u.id];
  const f = filtroSql(await titularesPermitidos(u, db), 'v.titular_id', params);
  const estados = historial ? `v.estado IN ('reconocido', 'en_negociacion', 'obsoleto') AND v.emitido_en IS NOT NULL` : `v.estado IN ('emitido', 'pospuesto')`;
  return q<AvisoLista>(`${SQL(`${f} AND ${estados}`)} ORDER BY v.referencia ${historial ? 'DESC' : 'ASC'} LIMIT 100`, params, db);
}

export async function contarPendientes(u: Usuario, db: Db = pool()) {
  const params: unknown[] = [];
  const f = filtroSql(await titularesPermitidos(u, db), 'titular_id', params);
  const r = await q1<{ n: string }>(`SELECT count(*) n FROM avisos WHERE ${f} AND estado = 'emitido'`, params, db);
  return Number(r?.n ?? 0);
}

export async function obtenerAviso(u: Usuario, id: string, db: Db = pool()) {
  if (!esUuid(id)) throw new NoEncontrado('aviso');
  const t = await q1<{ titular_id: string }>('SELECT titular_id FROM avisos WHERE id = $1', [id], db);
  if (!t || !(await puedeVerTitular(u, t.titular_id, db))) throw new NoEncontrado('aviso');
  await marcarLeido(u.id, id, db);
  const a = await q1<AvisoLista & { titular_id: string }>(`${SQL('v.id = $2')}`.replace('t.nombre AS titular,', 't.nombre AS titular, v.titular_id,'), [u.id, id], db);
  if (!a) throw new NoEncontrado('aviso');
  return a;
}

export async function atender(u: Usuario, id: string, accion: string, hasta: string | null) {
  const a = await obtenerAviso(u, id);
  if (!['reconocer', 'posponer', 'negociar'].includes(accion)) throw new Invalido({ _: 'Acción no válida.' });
  if (accion === 'posponer' && (!hasta || !esFecha(hasta) || hasta <= hoyMadrid())) throw new Invalido({ hasta: 'Elige una fecha posterior a hoy.' });
  await atenderAviso(u.id, id, accion as 'reconocer' | 'posponer' | 'negociar', hasta);
  await auditar(u.id, `aviso_${accion}`, 'aviso', id, null, { hasta, poliza: a.poliza_id });
  return a;
}

// ---------------------------------------------------------------- Suscripciones push de este dispositivo
const esquemaSub = z.object({
  endpoint: z.url().startsWith('https://').max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
});

export async function guardarSuscripcion(u: Usuario, datos: unknown, agente: string | null) {
  const s = validar(esquemaSub, datos);
  await q(
    `INSERT INTO push_suscripciones (usuario_id, endpoint, p256dh, auth, agente) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (endpoint) DO UPDATE SET usuario_id = $1, p256dh = $3, auth = $4, agente = $5, revocada_en = NULL, ultimo_error = NULL`,
    [u.id, s.endpoint, s.keys.p256dh, s.keys.auth, agente?.slice(0, 200) ?? null],
  );
  await auditar(u.id, 'push_activado', 'usuario', u.id);
}

export async function borrarSuscripcion(u: Usuario, endpoint: string) {
  await q('UPDATE push_suscripciones SET revocada_en = now() WHERE usuario_id = $1 AND endpoint = $2 AND revocada_en IS NULL', [u.id, endpoint]);
}

export async function suscripcionDe(u: Usuario, endpoint: string) {
  return q1<{ id: string; endpoint: string; p256dh: string; auth: string; ultimo_exito: Date | null; ultimo_error: string | null; revocada_en: Date | null }>(
    'SELECT id, endpoint, p256dh, auth, ultimo_exito, ultimo_error, revocada_en FROM push_suscripciones WHERE usuario_id = $1 AND endpoint = $2', [u.id, endpoint],
  );
}

export async function preferencias(u: Usuario) {
  return (await q1<{ correo_avisos: string; push_detallado: boolean }>('SELECT correo_avisos, push_detallado FROM usuarios WHERE id = $1', [u.id]))!;
}

export async function guardarPreferencias(u: Usuario, d: { correo_avisos: string; push_detallado: boolean }) {
  if (!['nunca', 'respaldo', 'siempre'].includes(d.correo_avisos)) throw new Invalido({ correo_avisos: 'Opción no válida.' });
  await q('UPDATE usuarios SET correo_avisos = $2, push_detallado = $3 WHERE id = $1', [u.id, d.correo_avisos, d.push_detallado]);
}

// ---------------------------------------------------------------- Ajustes generales y estado del sistema
export async function guardarAjustesAvisos(u: Usuario, d: Record<string, unknown>) {
  exigirRolAdmin(u);
  const esquema = z.object({
    margen_oposicion_dias: z.coerce.number().int().min(1, 'Entre 1 y 90 días.').max(90, 'Entre 1 y 90 días.'),
    recordatorio_dias: z.coerce.number().int().min(0, 'Entre 0 y 27 días.').max(27, 'Entre 0 y 27 días.'),
    hora_envio: z.coerce.number().int().min(6, 'Entre las 6 y las 21 h.').max(21, 'Entre las 6 y las 21 h.'),
  });
  const v = validar(esquema, d);
  for (const [k, val] of Object.entries(v)) {
    await q(`INSERT INTO ajustes (clave, valor) VALUES ($1, $2) ON CONFLICT (clave) DO UPDATE SET valor = $2, actualizado_en = now()`, [`avisos.${k}`, JSON.stringify(val)]);
  }
  await auditar(u.id, 'ajustes_avisos', 'ajustes', null, null, v);
}

export async function estadoSistema() {
  const ultima = await q1<{ inicio: Date; fin: Date | null; ok: boolean | null; error: string | null; resumen: Record<string, number> | null }>(
    `SELECT inicio, fin, ok, error, resumen FROM ejecuciones WHERE tarea = 'avisos' ORDER BY id DESC LIMIT 1`,
  );
  const ultimaOk = await q1<{ fin: Date }>(`SELECT fin FROM ejecuciones WHERE tarea = 'avisos' AND ok ORDER BY id DESC LIMIT 1`);
  const fallidos = await q<{ canal: string; n: string; error: string }>(
    `SELECT canal, count(*) n, max(ultimo_error) error FROM envios WHERE estado = 'fallido' AND creado_en > now() - interval '30 days' GROUP BY canal`,
  );
  const pendientes = await q1<{ n: string }>(`SELECT count(*) n FROM envios WHERE estado = 'pendiente'`);
  const subs = await q1<{ n: string }>(`SELECT count(*) n FROM push_suscripciones WHERE revocada_en IS NULL`);
  const copia = await q1<{ fin: Date; ok: boolean; error: string | null; resumen: { archivo?: string; bytes?: number } | null }>(`SELECT fin, ok, error, resumen FROM ejecuciones WHERE tarea = 'copia' ORDER BY id DESC LIMIT 1`);
  const minutos = ultimaOk ? (Date.now() - new Date(ultimaOk.fin).getTime()) / 60000 : null;
  return {
    planificador: minutos === null ? 'nunca' as const : minutos <= 20 ? 'activo' as const : 'detenido' as const,
    minutosDesdeUltima: minutos === null ? null : Math.round(minutos),
    ultima, fallidos, pendientes: Number(pendientes?.n ?? 0), suscripciones: Number(subs?.n ?? 0),
    push: pushConfigurado(), correo: correoConfigurado(),
    ia: !!process.env.ANTHROPIC_API_KEY,
    copiasConfiguradas: !!process.env.COPIAS_CLAVE,
    copia,
    copiaReciente: !!copia?.ok && Date.now() - new Date(copia.fin).getTime() < 36 * 3600_000,
  };
}
