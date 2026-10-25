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
};

export default nextConfig;
