import nodemailer, { type Transporter } from 'nodemailer';

/** Correo saliente por SMTP. Si falta configuración, el canal queda «sin configurar» y no se simula ningún envío. */
export const correoConfigurado = () => !!(process.env.SMTP_HOST && process.env.SMTP_FROM);

let transporte: Transporter | null = null;

export async function enviarCorreo({ para, asunto, texto }: { para: string; asunto: string; texto: string }) {
  if (!correoConfigurado()) throw new Error('Correo sin configurar: faltan SMTP_HOST y SMTP_FROM.');
  transporte ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  const info = await transporte.sendMail({ from: process.env.SMTP_FROM, to: para, subject: asunto, text: texto });
  return { id: info.messageId as string };
}
