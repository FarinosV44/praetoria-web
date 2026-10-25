import type { NextConfig } from 'next';

// Exportación estática: Next genera un HTML por ruta en out/ y Netlify lo sirve como archivos.
// Redirecciones y cabeceras NO van aquí (no se aplican en export): viven en public/_redirects
// y netlify.toml, validados con el motor de Netlify (ver docs/seo/README.md).
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
  reactStrictMode: true,
  // En el alojamiento compartido de Hostinger el número de procesos está limitado: un solo proceso de generación
  // (scripts/build.mjs fija NEXT_BUILD_CPUS=1 en ese build). En el resto, el valor por defecto de Next.
  ...(process.env.NEXT_BUILD_CPUS ? { experimental: { cpus: Number(process.env.NEXT_BUILD_CPUS) } } : {}),
};

export default nextConfig;
