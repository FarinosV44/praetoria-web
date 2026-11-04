'use client';
import { createAuthClient } from 'better-auth/react';
import { twoFactorClient, inferAdditionalFields } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  plugins: [
    twoFactorClient({ onTwoFactorRedirect: () => { window.location.href = '/entrar/codigo/'; } }),
    inferAdditionalFields({ user: { privacidadVersion: { type: 'string', required: true } } }),
  ],
});
