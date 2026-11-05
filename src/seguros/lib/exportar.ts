import { zipSync, strToU8 } from 'fflate';
import { q, type Db, pool } from './db';
import type { Usuario } from './auth/sesiones';
import { exigirPoliza, exigirTitular, filtroSql, titularesPermitidos } from './acceso';
import { almacen } from './almacen';
import { auditar } from './auditoria';
import { costeAnual, deCentimos } from './dinero';
import { exigirSiniestro } from './datos/siniestros';

/** CSV compatible con Excel en español: separador «;», BOM UTF-8, comillas cuando hace falta. */
export function csv(cabecera: string[], filas: (string | number | boolean | null | undefined)[][]) {
  const celda = (v: unknown) => {
    if (v === null || v === undefined) return '';
    let s = typeof v === 'boolean' ? (v ? 'sí' : 'no') : String(v);
    if (/^[=+\-@]/.test(s)) s = `'${s}`; // evita fórmulas al abrirlo en una hoja de cálculo
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + [cabecera, ...filas].map((f) => f.map(celda).join(';')).join('\r\n') + '\r\n';
}
const decimal = (v: string | null | undefined) => (v == null ? '' : v.replace('.', ','));

/** Pólizas (una fila por anualidad, con histórico) de los titulares que el usuario puede ver. */
export async function exportarPolizas(u: Usuario, titularId?: string | null, db: Db = pool()) {
  const params: unknown[] = [];
  let filtro = filtroSql(await titularesPermitidos(u, db), 't.id', params);
  if (titularId) { await exigirTitular(u, titularId, db); params.push(titularId); filtro += ` AND t.id = $${params.length}`; }
  const filas = await q<Record<string, string> & { datos_confirmados: boolean; plazo_oposicion_confirmado: boolean; archivada_en: Date | null; renovacion_automatica: boolean | null }>(
    `SELECT t.nombre AS titular, t.tipo AS tipo_titular, t.nif, r.nombre AS ramo, p.nombre, p.riesgo, p.aseguradora, p.numero, p.tomador, p.asegurado,
            p.mediador, p.mediador_telefono, p.asistencia_telefono, p.moneda, p.estado, p.renovacion_automatica, p.archivada_en,
            a.inicio, a.fin, a.prima_anual, a.periodicidad, a.importe_recibo, a.plazo_oposicion, a.plazo_oposicion_fuente, a.plazo_oposicion_confirmado, a.datos_confirmados,
            (SELECT count(*) FROM documentos d WHERE d.anualidad_id = a.id AND d.tipo = 'recibo' AND d.eliminado_en IS NULL)::text AS recibos
       FROM polizas p JOIN titulares t ON t.id = p.titular_id JOIN ramos r ON r.id = p.ramo_id
       JOIN anualidades a ON a.poliza_id = p.id AND a.anulada_en IS NULL
      WHERE ${filtro} ORDER BY t.nombre, p.nombre, a.inicio NULLS LAST`, params, db,
  );
  await auditar(u.id, 'exportacion', 'polizas', null, titularId ?? null, { filas: filas.length, formato: 'csv' }, db);
  return csv(
    ['Titular', 'Tipo de titular', 'NIF', 'Tipo de seguro', 'Póliza', 'Objeto asegurado', 'Aseguradora', 'Número', 'Tomador', 'Asegurado', 'Mediador', 'Teléfono mediador', 'Teléfono asistencia',
      'Moneda', 'Estado', 'Renovación automática', 'Archivada', 'Inicio', 'Vencimiento', 'Prima anual', 'Coste anual (estimado si no hay prima)', 'Periodicidad', 'Importe recibo',
      'Límite oposición', 'Fuente límite', 'Límite comprobado', 'Datos revisados', 'Recibos adjuntos'],
    filas.map((f) => {
      const c = costeAnual({ prima_anual: f.prima_anual ?? null, importe_recibo: f.importe_recibo ?? null, periodicidad: f.periodicidad ?? null });
      return [f.titular, f.tipo_titular, f.nif, f.ramo, f.nombre, f.riesgo, f.aseguradora, f.numero, f.tomador, f.asegurado, f.mediador, f.mediador_telefono, f.asistencia_telefono,
        f.moneda, f.estado, f.renovacion_automatica, !!f.archivada_en, f.inicio, f.fin, decimal(f.prima_anual), c ? decimal(deCentimos(c.centimos)) + (c.tipo === 'estimado' ? ' (estimado)' : '') : '',
        f.periodicidad, decimal(f.importe_recibo), f.plazo_oposicion, f.plazo_oposicion_fuente, f.plazo_oposicion_confirmado, f.datos_confirmados, f.recibos];
    }),
  );
}

async function leer(clave: string) {
  const { stream } = await almacen().leer(clave);
  const t: Buffer[] = [];
  for await (const x of stream as AsyncIterable<Buffer>) t.push(x);
  return new Uint8Array(Buffer.concat(t));
}
const seguro = (n: string) => n.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 120);

/** Paquete ZIP de una póliza: datos (CSV), anualidades y todos sus documentos vigentes. */
export async function paquetePoliza(u: Usuario, polizaId: string) {
  const titular = await exigirPoliza(u, polizaId);
  const p = (await q<Record<string, string>>('SELECT p.*, t.nombre AS titular FROM polizas p JOIN titulares t ON t.id = p.titular_id WHERE p.id = $1', [polizaId]))[0]!;
  const anualidades = await q<Record<string, string>>('SELECT * FROM anualidades WHERE poliza_id = $1 AND anulada_en IS NULL ORDER BY inicio NULLS LAST', [polizaId]);
  const docs = await q<{ id: string; nombre_original: string; tipo: string; clave_almacen: string; anualidad_id: string | null }>(
    'SELECT id, nombre_original, tipo, clave_almacen, anualidad_id FROM documentos WHERE poliza_id = $1 AND eliminado_en IS NULL ORDER BY subido_en', [polizaId],
  );
  const archivos: Record<string, Uint8Array> = {
    'poliza.csv': strToU8(csv(['Campo', 'Valor'], ['titular', 'nombre', 'aseguradora', 'numero', 'riesgo', 'tomador', 'asegurado', 'beneficiario', 'mediador', 'mediador_telefono', 'mediador_email', 'asistencia_telefono', 'moneda', 'estado', 'notas'].map((k) => [k, p[k]]))),
    'anualidades.csv': strToU8(csv(['Inicio', 'Vencimiento', 'Prima anual', 'Periodicidad', 'Importe recibo', 'Límite oposición', 'Fuente', 'Comprobado', 'Datos revisados'],
      anualidades.map((a) => [a.inicio, a.fin, decimal(a.prima_anual), a.periodicidad, decimal(a.importe_recibo), a.plazo_oposicion, a.plazo_oposicion_fuente, a.plazo_oposicion_confirmado as unknown as boolean, a.datos_confirmados as unknown as boolean]))),
  };
  for (const [i, d] of docs.entries()) archivos[`documentos/${String(i + 1).padStart(2, '0')}-${d.tipo}-${seguro(d.nombre_original)}`] = await leer(d.clave_almacen);
  await auditar(u.id, 'exportacion', 'poliza', polizaId, titular, { documentos: docs.length, formato: 'zip' });
  return { nombre: `poliza-${seguro(String(p.nombre))}.zip`, datos: zipSync(archivos, { level: 6 }) };
}

/** Paquete ZIP de un siniestro: hechos, seguimiento, análisis (JSON), borradores y archivos. */
export async function paqueteSiniestro(u: Usuario, siniestroId: string) {
  const titular = await exigirSiniestro(u, siniestroId);
  const s = (await q<Record<string, unknown>>('SELECT * FROM siniestros WHERE id = $1', [siniestroId]))[0]!;
  const eventos = await q<Record<string, string>>('SELECT fecha, tipo, texto, importe FROM siniestro_eventos WHERE siniestro_id = $1 ORDER BY fecha, id', [siniestroId]);
  const analisis = await q<Record<string, unknown>>('SELECT version, estado, modelo, documentos, faltan, resultado, creado_en FROM siniestro_analisis WHERE siniestro_id = $1 ORDER BY version', [siniestroId]);
  const borradores = await q<{ texto: string; origen: string; creado_en: Date }>('SELECT texto, origen, creado_en FROM siniestro_borradores WHERE siniestro_id = $1 ORDER BY creado_en', [siniestroId]);
  const archivos = await q<{ nombre_original: string; tipo: string; clave_almacen: string }>('SELECT nombre_original, tipo, clave_almacen FROM siniestro_archivos WHERE siniestro_id = $1 AND eliminado_en IS NULL ORDER BY subido_en', [siniestroId]);
  const zip: Record<string, Uint8Array> = {
    'hechos.csv': strToU8(csv(['Campo', 'Valor'], ['titulo', 'relato', 'fecha_hecho', 'fecha_conocimiento', 'lugar', 'riesgo_afectado', 'danos', 'terceros', 'importe_estimado', 'pruebas', 'estado', 'referencia_aseguradora', 'plazo_comunicacion', 'plazo_comunicacion_fuente'].map((k) => [k, s[k] as string]))),
    'seguimiento.csv': strToU8(csv(['Fecha', 'Tipo', 'Detalle', 'Importe'], eventos.map((e) => [e.fecha, e.tipo, e.texto, decimal(e.importe)]))),
    'analisis.json': strToU8(JSON.stringify(analisis, null, 2)),
  };
  borradores.forEach((b, i) => { zip[`comunicaciones/${String(i + 1).padStart(2, '0')}-${b.origen}.txt`] = strToU8(b.texto); });
  for (const [i, a] of archivos.entries()) zip[`archivos/${String(i + 1).padStart(2, '0')}-${a.tipo}-${seguro(a.nombre_original)}`] = await leer(a.clave_almacen);
  await auditar(u.id, 'exportacion', 'siniestro', siniestroId, titular, { archivos: archivos.length, formato: 'zip' });
  return { nombre: `siniestro-${seguro(String(s.titulo))}.zip`, datos: zipSync(zip, { level: 6 }) };
}
