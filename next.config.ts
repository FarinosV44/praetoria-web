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
// Gestor de seguros (/admin/seguros va incluido en «admin»). Sus vistas de documentos llevan cabeceras propias
// (se previsualizan dentro de la ficha, mismo origen), así que no reciben X-Frame-Options: DENY.
const RUTAS_SEGUROS_API = '/api/seguros/:ruta((?!documentos/|siniestros/archivos/).*)';

// Páginas que tienen versión Markdown: todo salvo el portal, las API y los archivos (lo que lleva punto).
const SIN_MARKDOWN = [...new Set(RUTAS_PORTAL.map((r) => r.split('/')[0])), 'api', 'mcp', '_next', 'media', 'iconos'];
const PAGINAS_PUBLICAS = `/:ruta((?!(?:${SIN_MARKDOWN.join('|')})(?:/|$))[^.]+)`;
const PIDE_MARKDOWN = [{ type: 'header' as const, key: 'accept', value: '.*text/markdown.*' }];

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
  serverExternalPackages: ['pg', 'unpdf', 'mammoth', 'pdfmake', 'docx', 'jszip', 'pdfjs-dist'],
  // Gestor de seguros: pdfjs carga su «worker» de forma dinámica (texto por página para comprobar citas).
  outputFileTracingIncludes: { '/**': ['./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'] },
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
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/', has: PIDE_MARKDOWN, destination: '/api/markdown/' },
        { source: PAGINAS_PUBLICAS, has: PIDE_MARKDOWN, destination: '/api/markdown/:ruta' },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  async headers() {
    const hsts = process.env.NODE_ENV === 'production'
      ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000' }]
      : [];
    const noIndexable = process.env.SITE_INDEXABLE === 'true' ? [] : [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }];
    return [
      { source: '/:path*', headers: [...cabecerasWeb, ...noIndexable] },
      ...RUTAS_PORTAL.map((r) => ({ source: `/${r}/:path*`, headers: [...cabecerasPortal, ...hsts] })),
      { source: RUTAS_SEGUROS_API, headers: [...cabecerasPortal, ...hsts] },
      { source: '/api/seguros/:ruta(documentos|siniestros/archivos)/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }, ...hsts] },
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
      { source: '/.well-known/mcp/:path*', headers: [{ key: 'Access-Control-Allow-Origin', value: '*' }] },
    ];
  },
};

export default nextConfig;
