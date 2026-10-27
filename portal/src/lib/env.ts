import 'server-only';

function req(nombre: string): string {
  const v = process.env[nombre];
  if (!v || v === 'CAMBIAR') throw new Error(`Falta la variable de entorno ${nombre}`);
  return v;
}

export const env = {
  get origin() { return req('PORTAL_ORIGIN'); },
  get dbApp() { return req('DATABASE_URL_APP'); },
  get dbAuth() { return req('DATABASE_URL_AUTH'); },
  get authSecret() { return req('BETTER_AUTH_SECRET'); },
  get storageUrl() { return req('STORAGE_URL'); },
  get storageKey() { return req('STORAGE_SERVICE_KEY'); },
  get storageBucket() { return process.env.STORAGE_BUCKET || 'portal-documentos'; },
  get smtp() {
    return {
      host: req('SMTP_HOST'),
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER || undefined,
      pass: process.env.SMTP_PASS || undefined,
      from: process.env.SMTP_FROM || 'Praetoria Abogados <no-responder@praetoriaabogados.es>',
    };
  },
  get staffMfa() { return process.env.STAFF_MFA_REQUIRED !== 'false'; },
  get uploadMaxBytes() { return Number(process.env.UPLOAD_MAX_MB || 20) * 1024 * 1024; },
};
