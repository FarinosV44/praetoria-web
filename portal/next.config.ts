import type { NextConfig } from 'next';

// Aplicación privada: se ejecuta con servidor Node (no es exportación estática).
// Las cabeceras de seguridad se aplican a todas las rutas.
const seguridad = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), interest-cohort=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'none'",
      "object-src 'none'",
    ].join('; '),
  },
];

const config: NextConfig = {
  poweredByHeader: false,
  trailingSlash: true,
  skipTrailingSlashRedirect: true,
  outputFileTracingRoot: import.meta.dirname,
  serverExternalPackages: ['pg'],
  experimental: { serverActions: { bodySizeLimit: '1mb' } },
  async headers() {
    const extra = process.env.NODE_ENV === 'production'
      ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]
      : [];
    return [{ source: '/:path*', headers: [...seguridad, ...extra] }];
  },
};

export default config;
