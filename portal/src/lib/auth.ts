import 'server-only';
import { betterAuth } from 'better-auth';
import { nextCookies } from 'better-auth/next-js';
import { twoFactor } from 'better-auth/plugins';
import { poolAuth } from './db';
import { env } from './env';
import { enviarCorreo, plantillasCorreo } from './email';
import { VERSION_PRIVACIDAD } from './textos';

export const auth = betterAuth({
  appName: 'Praetoria · Área de clientes',
  baseURL: env.origin,
  secret: env.authSecret,
  trustedOrigins: [env.origin],
  database: poolAuth(),
  telemetry: { enabled: false },
  user: {
    additionalFields: {
      privacidadVersion: { type: 'string', required: true, input: true },
      privacidadAceptadaAt: { type: 'date', required: false, input: false },
    },
  },
  databaseHooks: {
    user: {
      create: {
        // El registro solo prospera si se acepta la versión vigente de la información de privacidad.
        before: async (u) => {
          if ((u as { privacidadVersion?: string }).privacidadVersion !== VERSION_PRIVACIDAD) return false;
          return { data: { ...u, privacidadAceptadaAt: new Date() } };
        },
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    autoSignIn: false,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 3600,
    sendResetPassword: async ({ user, url }) => {
      const m = plantillasCorreo.recuperacion(url);
      await enviarCorreo(user.email, m.asunto, m.texto);
    },
    onExistingUserSignUp: async ({ user }) => {
      const m = plantillasCorreo.cuentaExistente(`${env.origin}/entrar/`);
      await enviarCorreo(user.email, m.asunto, m.texto);
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: 3600,
    sendVerificationEmail: async ({ user, url }) => {
      const m = plantillasCorreo.verificacion(url);
      await enviarCorreo(user.email, m.asunto, m.texto);
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    freshAge: 60 * 15,
  },
  rateLimit: {
    enabled: true,
    storage: 'database',
    window: 60,
    max: 60,
    customRules: {
      '/sign-in/email': { window: 300, max: 10 },
      '/sign-up/email': { window: 3600, max: 10 },
      '/request-password-reset': { window: 3600, max: 5 },
      '/send-verification-email': { window: 3600, max: 5 },
      '/two-factor/verify-totp': { window: 300, max: 10 },
    },
  },
  advanced: {
    cookiePrefix: 'praetoria-portal',
    useSecureCookies: env.origin.startsWith('https://'),
    database: { generateId: 'uuid' },
  },
  plugins: [twoFactor({ issuer: 'Praetoria Abogados' }), nextCookies()],
});

export type Sesion = typeof auth.$Infer.Session;
