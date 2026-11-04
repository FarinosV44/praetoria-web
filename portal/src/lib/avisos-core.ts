// Envío de avisos neutros por correo. Sin 'server-only' para poder usarlo también desde scripts
// (cron). Nunca incluye datos del asunto ni adjuntos: solo un aviso y el enlace al portal.
import pg from 'pg';
import nodemailer from 'nodemailer';
import { enviarPush, type Suscripcion } from './push-core.ts';

type Aviso = { id: string; destino: 'cliente' | 'despacho'; tipo: 'novedades' | 'recordatorio' | 'aviso_interno'; email: string | null };

export function contenidoAviso(tipo: Aviso['tipo'], origen: string) {
  const pie = '\n\nPraetoria Abogados\nEste mensaje se ha enviado automáticamente; no respondas a este correo.';
  if (tipo === 'aviso_interno') {
    return { asunto: '[Portal] Nueva actividad pendiente de revisar', texto: `Hay actividad nueva en el portal de clientes.\n\n${origen}/despacho/${pie}` };
  }
  if (tipo === 'recordatorio') {
    return { asunto: 'Documentación pendiente en tu área de clientes',
      texto: `Hola:\n\nTe recordamos que hay documentación pendiente en tu área de clientes de Praetoria Abogados. Por confidencialidad, no incluimos los detalles en este correo.\n\n${origen}/documentacion/${pie}` };
  }
  return { asunto: 'Tienes novedades en tu área de clientes',
    texto: `Hola:\n\nHay novedades en tu área de clientes de Praetoria Abogados. Por confidencialidad, no incluimos los detalles en este correo. Puedes consultarlas iniciando sesión:\n\n${origen}/inicio/${pie}` };
}

export async function enviarAvisosPendientes(opts: { pool: pg.Pool; ignorarRetraso?: boolean; limite?: number }) {
  const origen = process.env.PORTAL_ORIGIN!;
  const despacho = process.env.AVISOS_DESPACHO_EMAIL || '';
  const t = nodemailer.createTransport({
    host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  const from = process.env.SMTP_FROM || 'Praetoria Abogados <no-responder@praetoriaabogados.es>';
  const c = await opts.pool.connect();
  let enviados = 0, errores = 0;
  try {
    await c.query('begin');
    await c.query("select set_config('app.proceso', 'notificador', true)");
    const r = await c.query<Aviso>('select * from portal.tomar_avisos($1, $2)', [!!opts.ignorarRetraso, opts.limite ?? 50]);
    for (const a of r.rows) {
      const para = a.destino === 'despacho' ? (a.email || despacho) : a.email;
      try {
        if (!para) throw new Error('sin destinatario');
        const m = contenidoAviso(a.tipo, origen);
        await t.sendMail({ from, to: para, subject: m.asunto, text: m.texto });
        await c.query('select portal.marcar_aviso($1, true, null)', [a.id]);
        enviados++;
      } catch (e) {
        await c.query('select portal.marcar_aviso($1, false, $2)', [a.id, (e as Error).message]);
        errores++;
      }
    }
    await c.query('commit');
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  } finally { c.release(); }
  return { enviados, errores };
}

export async function programarRecordatorios(pool: pg.Pool, dias = 3) {
  const c = await pool.connect();
  try {
    await c.query('begin');
    await c.query("select set_config('app.proceso', 'notificador', true)");
    const r = await c.query<{ n: number }>('select portal.programar_recordatorios($1) n', [dias]);
    await c.query('commit');
    return r.rows[0]?.n ?? 0;
  } catch (e) { await c.query('rollback'); throw e; } finally { c.release(); }
}

/**
 * Motor de avisos de la agenda: toma los avisos vencidos (con reserva para no duplicar), los entrega por
 * push a todos los dispositivos activos del profesional y los deja en su bandeja interna, que es el canal
 * que nunca falla. Cada intento queda registrado en entregas_push.
 */
export async function procesarAgenda(pool: pg.Pool, limite = 50) {
  const tomar = await pool.connect();
  let avisos: { aviso_id: string; user_id: string; evento_id: string }[] = [];
  try {
    await tomar.query('begin');
    await tomar.query("select set_config('app.proceso', 'notificador', true)");
    avisos = (await tomar.query('select * from portal.tomar_avisos_agenda($1)', [limite])).rows;
    await tomar.query('commit');
  } catch (e) { await tomar.query('rollback').catch(() => {}); throw e; } finally { tomar.release(); }

  let entregados = 0;
  for (const a of avisos) {
    const c = await pool.connect();
    try {
      await c.query('begin');
      await c.query("select set_config('app.proceso', 'notificador', true)");
      const subs = (await c.query<Suscripcion>('select * from portal.suscripciones_de($1)', [a.user_id])).rows;
      const canales: string[] = ['interno'];
      for (const s of subs) {
        const r = await enviarPush(s, '/despacho/avisos/', a.aviso_id);
        await c.query('select portal.registrar_entrega($1, $2, $3, $4)', [a.aviso_id, s.id, r.ok ? 'ok' : (r.error ?? 'error'), r.status]);
        if (r.ok && !canales.includes('push')) canales.push('push');
      }
      if (!subs.length) await c.query(`select portal.registrar_entrega($1, null, 'sin dispositivos: solo bandeja interna', null)`, [a.aviso_id]);
      await c.query('select portal.cerrar_aviso($1, true, $2, null)', [a.aviso_id, canales.join('+')]);
      await c.query('commit');
      entregados++;
    } catch (e) {
      await c.query('rollback').catch(() => {});
      const k = await pool.connect();
      try {
        await k.query('begin');
        await k.query("select set_config('app.proceso', 'notificador', true)");
        await k.query('select portal.cerrar_aviso($1, false, null, $2)', [a.aviso_id, (e as Error).message]);
        await k.query('commit');
      } catch { await k.query('rollback').catch(() => {}); } finally { k.release(); }
    } finally { c.release(); }
  }
  return { tomados: avisos.length, entregados };
}

export async function replanificarRecurrentes(pool: pg.Pool) {
  const c = await pool.connect();
  try {
    await c.query('begin');
    await c.query("select set_config('app.proceso', 'notificador', true)");
    const r = await c.query<{ n: number }>('select portal.agenda_replanificar_recurrentes() n');
    await c.query('commit');
    return r.rows[0]?.n ?? 0;
  } catch (e) { await c.query('rollback'); throw e; } finally { c.release(); }
}

/** Un ciclo completo del motor (cada minuto, por cron). A las 06:00 UTC replanifica repeticiones y programa recordatorios. */
export async function ejecutarCicloAvisos(pool: pg.Pool, ahora = new Date()) {
  const agenda = await procesarAgenda(pool);
  const correo = await enviarAvisosPendientes({ pool });
  const diario = ahora.getUTCHours() === 6 && ahora.getUTCMinutes() === 0
    ? { replanificados: await replanificarRecurrentes(pool), recordatorios: await programarRecordatorios(pool) }
    : {};
  return { agenda, correo, ...diario };
}
