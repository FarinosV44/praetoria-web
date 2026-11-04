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
  /** Si es true, un documento solo se puede descargar o validar cuando el antivirus lo ha marcado como limpio. */
  get antivirusObligatorio() { return process.env.ANTIVIRUS_REQUIRED === 'true'; },
  /**
   * Cabecera con la IP real del cliente que fija el proxy de confianza. Obligatoria y sin valor por defecto:
   * una cabecera que el proxy no sobrescriba la falsifica cualquiera y anula el límite de intentos de acceso.
   */
  get cabeceraIp() { return req('TRUSTED_IP_HEADER'); },
  /** Asistente de IA (#48): opcional. Sin clave, el asistente no se muestra. */
  get iaClave() { return process.env.ANTHROPIC_API_KEY || null; },
  get iaModelo() { return process.env.IA_MODELO || 'claude-sonnet-5-5'; },
  get uploadMaxBytes() { return Number(process.env.UPLOAD_MAX_MB || 20) * 1024 * 1024; },
};
