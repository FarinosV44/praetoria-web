// Envío de avisos neutros por correo. Sin 'server-only' para poder usarlo también desde scripts
// (cron). Nunca incluye datos del asunto ni adjuntos: solo un aviso y el enlace al portal.
import pg from 'pg';
import nodemailer from 'nodemailer';

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
