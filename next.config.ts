import { readFileSync } from 'node:fs';
import type { NextConfig } from 'next';
import { aRedireccionesNext } from './scripts/seo/next-redirects.mjs';

// Una sola aplicación con servidor Node: la web pública, prerenderizada, y el portal privado en /admin y
// en el área de clientes. Las páginas públicas se siguen generando en el build (no dependen de la base de datos).

/** Rutas del portal: llevan cabeceras estrictas y nunca se indexan. */
const RUTAS_PORTAL = [
  'admin', 'portal', 'entrar', 'crear-cuenta', 'bienvenida', 'invitacion', 'recuperar', 'restablecer',
  'documentacion', 'documentos', 'expedientes', 'inicio', 'mensajes', 'perfil', 'solicitudes',
  'api/auth', 'api/documentos', 'api/push', 'api/interno',
];

const cabecerasWeb = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const cabecerasPortal = [
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

const nextConfig: NextConfig = {
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ['pg', 'unpdf', 'mammoth'],
  experimental: {
    serverActions: { bodySizeLimit: '1mb' },
    // En Hostinger el número de procesos está limitado: un solo proceso de generación (lo fija scripts/build.mjs)
    ...(process.env.NEXT_BUILD_CPUS ? { cpus: Number(process.env.NEXT_BUILD_CPUS) } : {}),
  },
  async redirects() {
    return [
      // www → dominio principal (una sola versión indexable)
      { source: '/:path*', has: [{ type: 'host', value: 'www.praetoriaabogados.es' }], destination: 'https://praetoriaabogados.es/:path*', statusCode: 301 },
      // Redirecciones de la migración desde WordPress (docs/seo/inventario-urls.csv)
      ...aRedireccionesNext(readFileSync('public/_redirects', 'utf8')),
    ];
  },
  async headers() {
    const hsts = process.env.NODE_ENV === 'production'
      ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000' }]
      : [];
    const noIndexable = process.env.SITE_INDEXABLE === 'true' ? [] : [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }];
    return [
      { source: '/:path*', headers: [...cabecerasWeb, ...noIndexable] },
      ...RUTAS_PORTAL.map((r) => ({ source: `/${r}/:path*`, headers: [...cabecerasPortal, ...hsts] })),
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
    ];
  },
};

export default nextConfig;
