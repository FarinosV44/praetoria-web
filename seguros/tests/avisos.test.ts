import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Usuario } from '../../src/seguros/lib/auth/sesiones';
import { calcularAvisos, emitir, planificar, atenderAviso, horaMadrid, type Ajustes } from '../../src/seguros/lib/avisos/motor';
import { procesarCola, type Canales } from '../../src/seguros/lib/avisos/cola';
import { tareaAvisos } from '../../src/seguros/lib/avisos/tarea';
import { actualizarAnualidad, crearAnualidad, listarAnualidades, archivarPoliza } from '../../src/seguros/lib/datos/polizas';
import { fijarAccesos } from '../../src/seguros/lib/datos/usuarios';
import { q, q1 } from '../../src/seguros/lib/db';
import { poliza, titular, usuario } from './ayudas';

const AJ: Ajustes = { margenOposicion: 15, recordatorio: 7, repetirDias: 7, maxRepeticiones: 2, horaEnvio: 9 };
const base = { anualidad_id: 'a', poliza_id: 'p', titular_id: 't', plazo_oposicion: null, plazo_oposicion_confirmado: false, estado: 'activa' };
const fecha = (tipo: string, fin: string, hoy = '2026-01-01', extra = {}) => calcularAvisos({ ...base, fin, ...extra }, hoy, AJ).find((a) => a.tipo === tipo)?.fecha;

describe('reglas de calendario (#4)', () => {
  it('un mes natural antes, con ajuste al último día válido', () => {
    expect(fecha('vencimiento_mes', '2027-03-31')).toBe('2027-02-28');
    expect(fecha('vencimiento_mes', '2028-03-31')).toBe('2028-02-29'); // bisiesto
    expect(fecha('vencimiento_mes', '2027-03-29')).toBe('2027-02-28');
    expect(fecha('vencimiento_mes', '2027-01-15')).toBe('2026-12-15');
    expect(fecha('vencimiento_mes', '2026-11-01')).toBe('2026-10-01'); // no son 30 días
  });
  it('plazo de oposición solo si está confirmado, con margen', () => {
    expect(fecha('oposicion', '2027-03-31', '2026-01-01', { plazo_oposicion: '2027-03-01' })).toBeUndefined();
    expect(fecha('oposicion', '2027-03-31', '2026-01-01', { plazo_oposicion: '2027-03-01', plazo_oposicion_confirmado: true })).toBe('2027-02-14');
  });
  it('póliza vencida: aviso contextual y ningún «vence en un mes»', () => {
    const r = calcularAvisos({ ...base, fin: '2026-10-01' }, '2026-11-05', AJ);
    expect(r.map((a) => a.tipo)).toEqual(['vencida']);
  });
  it('la hora se mide en Madrid, también con cambio de hora', () => {
    expect(horaMadrid(new Date('2026-03-29T07:30:00Z'))).toBe(9); // ya en horario de verano (UTC+2)
    expect(horaMadrid(new Date('2026-03-28T07:30:00Z'))).toBe(8); // invierno (UTC+1)
    expect(horaMadrid(new Date('2026-10-25T08:30:00Z'))).toBe(9); // vuelta a invierno
  });
});

const canales = (registro: string[], pushFalla?: 'caducada' | 'temporal'): Canales => ({
  pushListo: () => true,
  correoListo: () => true,
  push: async (s) => {
    registro.push(`push:${s.endpoint}`);
    if (pushFalla === 'caducada') return { ok: false, caducada: true, error: '410 Gone' };
    if (pushFalla === 'temporal') return { ok: false, caducada: false, error: '503' };
    return { ok: true };
  },
  correo: async (m) => { registro.push(`correo:${m.para}:${m.asunto}`); },
});

describe('motor de avisos con base de datos (#4)', () => {
  let admin: Usuario, emp: string;
  beforeAll(async () => {
    admin = await usuario('admin');
    emp = await titular(admin, 'empresa', 'Empresa Sintética Avisos');
  });
  beforeEach(async () => {
    // Aísla cada prueba: archiva las pólizas de otras pruebas para que no generen avisos.
    await q(`UPDATE polizas SET archivada_en = now() WHERE archivada_en IS NULL`);
    await q(`UPDATE avisos SET estado = 'obsoleto'`);
    await q(`DELETE FROM envios`);
    await q(`UPDATE usuarios SET activo = false WHERE id <> $1`, [admin.id]);
  });

  it('avisa un mes antes, a partir de las 9:00 de Madrid, sin duplicar aunque se repita la tarea', async () => {
    const id = await poliza(admin, emp, { inicio: '2026-03-31', fin: '2027-03-31' });
    // El 27-02-2027 aún no toca
    expect((await emitir(new Date('2027-02-27T10:00:00Z'), undefined)).emitidos).toBe(0);
    await planificar('2027-02-27');
    expect((await emitir(new Date('2027-02-27T10:00:00Z'))).emitidos).toBe(0);
    // 28-02-2027 a las 8:00 de Madrid: espera; a las 9:00 sale
    await planificar('2027-02-28');
    expect((await emitir(new Date('2027-02-28T07:00:00Z'))).esperando).toBe(true);
    const r1 = await emitir(new Date('2027-02-28T08:00:00Z'));
    expect(r1.emitidos).toBe(1);
    // Repetir planificación y emisión no duplica
    await planificar('2027-02-28');
    expect((await emitir(new Date('2027-02-28T15:00:00Z'))).emitidos).toBe(0);
    const avisos = await q('SELECT tipo, fecha FROM avisos WHERE poliza_id = $1 AND estado = $2', [id, 'emitido']);
    expect(avisos).toEqual([{ tipo: 'vencimiento_mes', fecha: '2027-02-28' }]);
    // Sin suscripción push y con correo de respaldo: se encola correo además del centro de avisos
    const envios = await q<{ canal: string }>('SELECT canal FROM envios WHERE aviso_id IN (SELECT id FROM avisos WHERE poliza_id = $1) ORDER BY canal', [id]);
    expect(envios.map((e) => e.canal)).toEqual(['app', 'correo']);
    const reg: string[] = [];
    await procesarCola(canales(reg));
    await procesarCola(canales(reg));
    expect(reg.filter((x) => x.startsWith('correo')).length).toBe(1);
    expect(reg[0]).toContain('Renovación próxima');
  });

  it('póliza dada de alta dentro de la ventana: avisa en la siguiente ejecución (recuperación)', async () => {
    const id = await poliza(admin, emp, { inicio: '2026-01-20', fin: '2027-01-20' });
    await planificar('2027-01-05');
    await emitir(new Date('2027-01-05T09:00:00Z'));
    expect((await q('SELECT tipo FROM avisos WHERE poliza_id = $1 AND estado = $2', [id, 'emitido'])).map((a) => a.tipo)).toEqual(['vencimiento_mes']);
  });

  it('renovar o corregir la fecha impide los avisos de la versión anterior', async () => {
    const id = await poliza(admin, emp, { inicio: '2026-06-10', fin: '2027-06-10' });
    await planificar('2027-05-01');
    await crearAnualidad(admin, id, { inicio: '2027-06-10', fin: '2028-06-10', prima_anual: '700,00' });
    const r = await planificar('2027-05-01');
    expect(r.obsoletos).toBeGreaterThan(0);
    expect((await emitir(new Date('2027-05-12T10:00:00Z'))).emitidos).toBe(0);
    const vivos = await q<{ referencia: string }>(`SELECT referencia FROM avisos WHERE poliza_id = $1 AND estado <> 'obsoleto'`, [id]);
    expect(vivos.every((v) => v.referencia === '2028-06-10')).toBe(true);
    // Corregir la fecha de la nueva anualidad
    const [nueva] = await listarAnualidades(admin, id);
    await actualizarAnualidad(admin, nueva!.id, { inicio: '2027-06-10', fin: '2028-07-01' });
    await planificar('2027-05-01');
    const tras = await q<{ referencia: string }>(`SELECT DISTINCT referencia FROM avisos WHERE poliza_id = $1 AND estado <> 'obsoleto'`, [id]);
    expect(tras).toEqual([{ referencia: '2028-07-01' }]);
  });

  it('archivar o anular deja los avisos obsoletos y descarta envíos pendientes', async () => {
    const id = await poliza(admin, emp, { inicio: '2026-12-01', fin: '2027-12-01' });
    await planificar('2027-11-02');
    await emitir(new Date('2027-11-02T10:00:00Z'));
    await archivarPoliza(admin, id, true);
    await planificar('2027-11-02');
    const pend = await q(`SELECT 1 FROM envios WHERE estado = 'pendiente' AND aviso_id IN (SELECT id FROM avisos WHERE poliza_id = $1)`, [id]);
    expect(pend).toHaveLength(0);
  });

  it('aviso de oposición confirmado y póliza vencida contextual', async () => {
    const id = await poliza(admin, emp, { inicio: '2026-09-01', fin: '2027-09-01', plazo_oposicion: '2027-08-01', plazo_oposicion_confirmado: 'on', plazo_oposicion_fuente: 'CG sintéticas art. 3' });
    await planificar('2027-07-17');
    await emitir(new Date('2027-07-17T10:00:00Z'));
    expect((await q('SELECT tipo FROM avisos WHERE poliza_id = $1 AND estado = $2', [id, 'emitido'])).map((a) => a.tipo)).toEqual(['oposicion']);
    const venc = await poliza(admin, emp, { inicio: '2025-10-01', fin: '2026-10-01' });
    await planificar('2026-11-05');
    await emitir(new Date('2026-11-05T10:00:00Z'));
    expect((await q('SELECT tipo FROM avisos WHERE poliza_id = $1', [venc])).map((a) => a.tipo)).toEqual(['vencida']);
  });

  it('push: caducada se limpia y cae al correo de respaldo; temporal se reintenta', async () => {
    await q(`INSERT INTO push_suscripciones (usuario_id, endpoint, p256dh, auth) VALUES ($1, 'https://push.ejemplo.test/caducada', 'k', 'a')`, [admin.id]);
    const id = await poliza(admin, emp, { inicio: '2026-08-15', fin: '2027-08-15' });
    await planificar('2027-07-15');
    await emitir(new Date('2027-07-15T10:00:00Z'));
    const reg: string[] = [];
    await procesarCola(canales(reg, 'caducada'));
    expect((await q1<{ revocada_en: Date | null }>(`SELECT revocada_en FROM push_suscripciones WHERE endpoint LIKE '%caducada'`))!.revocada_en).not.toBeNull();
    const fallido = await q1<{ ultimo_error: string }>(`SELECT ultimo_error FROM envios WHERE canal = 'push' AND estado = 'fallido' AND aviso_id IN (SELECT id FROM avisos WHERE poliza_id = $1)`, [id]);
    expect(fallido?.ultimo_error).toMatch(/caducada/);
    await procesarCola(canales(reg));
    expect(reg.some((x) => x.startsWith('correo'))).toBe(true);

    // Fallo temporal: queda pendiente con reintento programado
    await q(`INSERT INTO push_suscripciones (usuario_id, endpoint, p256dh, auth) VALUES ($1, 'https://push.ejemplo.test/temporal', 'k', 'a')`, [admin.id]);
    const id2 = await poliza(admin, emp, { inicio: '2026-08-20', fin: '2027-08-20' });
    await planificar('2027-07-20');
    await emitir(new Date('2027-07-20T10:00:00Z'));
    await procesarCola(canales([], 'temporal'));
    const e = await q1<{ estado: string; intentos: number; ultimo_error: string }>(`SELECT estado, intentos, ultimo_error FROM envios WHERE canal = 'push' AND aviso_id IN (SELECT id FROM avisos WHERE poliza_id = $1)`, [id2]);
    expect(e).toMatchObject({ estado: 'pendiente', intentos: 1, ultimo_error: '503' });
  });

  it('reconocer, posponer y «en negociación»: sin repetir avisos ya atendidos', async () => {
    const id = await poliza(admin, emp, { inicio: '2026-10-10', fin: '2027-10-10' });
    await planificar('2027-09-10');
    await emitir(new Date('2027-09-10T10:00:00Z'));
    const av = (await q1<{ id: string }>('SELECT id FROM avisos WHERE poliza_id = $1 AND estado = $2', [id, 'emitido']))!;
    // Sin atender: se repite a los 7 días, una vez por emisión
    await planificar('2027-09-17');
    expect((await emitir(new Date('2027-09-17T10:00:00Z'))).emitidos).toBe(1);
    expect((await emitir(new Date('2027-09-17T11:00:00Z'))).emitidos).toBe(0);
    await atenderAviso(admin.id, av.id, 'posponer', '2027-09-20');
    await planificar('2027-09-18');
    expect((await emitir(new Date('2027-09-18T10:00:00Z'))).emitidos).toBe(0);
    await planificar('2027-09-20');
    expect((await emitir(new Date('2027-09-20T10:00:00Z'))).emitidos).toBe(1);
    await atenderAviso(admin.id, av.id, 'negociar', null);
    expect((await q1<{ estado: string }>('SELECT estado FROM polizas WHERE id = $1', [id]))!.estado).toBe('en_negociacion');
    await planificar('2027-09-30');
    expect((await emitir(new Date('2027-09-30T10:00:00Z'))).emitidos).toBe(0);
    // Posponer no cambia la fecha límite ni el vencimiento
    expect((await q1<{ fin: string }>('SELECT fin FROM anualidades WHERE poliza_id = $1', [id]))!.fin).toBe('2027-10-10');
  });

  it('destinatarios: solo usuarios con acceso al titular', async () => {
    const colab = await usuario('colaborador');
    const otro = await usuario('colaborador');
    await fijarAccesos(admin, colab.id, [emp]);
    const id = await poliza(admin, emp, { inicio: '2026-04-30', fin: '2027-04-30' });
    await planificar('2027-03-30');
    await emitir(new Date('2027-03-30T10:00:00Z'));
    const ids = (await q<{ usuario_id: string }>(`SELECT DISTINCT usuario_id FROM envios WHERE aviso_id IN (SELECT id FROM avisos WHERE poliza_id = $1)`, [id])).map((x) => x.usuario_id);
    expect(ids).toContain(colab.id);
    expect(ids).not.toContain(otro.id);
  });

  it('la tarea completa no se ejecuta dos veces a la vez y registra su ejecución', async () => {
    const [a, b] = await Promise.all([tareaAvisos(new Date('2027-01-01T10:00:00Z'), canales([])), tareaAvisos(new Date('2027-01-01T10:00:00Z'), canales([]))]);
    expect([a, b].some((r) => 'omitida' in r) || [a, b].every((r) => !('omitida' in r))).toBe(true);
    expect((await q1<{ ok: boolean }>(`SELECT ok FROM ejecuciones WHERE tarea = 'avisos' ORDER BY id DESC LIMIT 1`))!.ok).toBe(true);
  });
});
