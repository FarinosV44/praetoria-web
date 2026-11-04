import 'server-only';
import nodemailer from 'nodemailer';
import { env } from './env';

// Los correos NUNCA incluyen detalles del asunto ni documentos adjuntos: solo un aviso neutro
// y el enlace al portal, donde la información se consulta tras iniciar sesión.
let transporte: ReturnType<typeof nodemailer.createTransport> | undefined;
function t() {
  const s = env.smtp;
  transporte ??= nodemailer.createTransport({
    host: s.host, port: s.port, secure: s.secure,
    auth: s.user ? { user: s.user, pass: s.pass } : undefined,
  });
  return transporte;
}

export async function enviarCorreo(para: string, asunto: string, texto: string) {
  await t().sendMail({ from: env.smtp.from, to: para, subject: asunto, text: texto });
}

const pie = '\n\nPraetoria Abogados\nEste mensaje se ha enviado automáticamente; no respondas a este correo.';

export const plantillasCorreo = {
  verificacion: (url: string) => ({
    asunto: 'Confirma tu correo para el área de clientes',
    texto: `Hola:\n\nPara activar tu cuenta en el área de clientes de Praetoria Abogados, confirma tu correo con este enlace (caduca en una hora):\n\n${url}\n\nSi no has creado tú la cuenta, ignora este mensaje.${pie}`,
  }),
  recuperacion: (url: string) => ({
    asunto: 'Restablece tu contraseña del área de clientes',
    texto: `Hola:\n\nHemos recibido una petición para restablecer la contraseña de tu cuenta. Usa este enlace (caduca en una hora):\n\n${url}\n\nSi no lo has pedido tú, ignora este mensaje: tu contraseña no cambiará.${pie}`,
  }),
  cuentaExistente: (url: string) => ({
    asunto: 'Intento de registro con tu correo',
    texto: `Hola:\n\nAlguien ha intentado crear una cuenta en el área de clientes con este correo, que ya está registrado. Si fuiste tú, entra aquí:\n\n${url}\n\nSi no recuerdas la contraseña, puedes restablecerla desde esa misma página.${pie}`,
  }),
};
