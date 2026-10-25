import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const config = [
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Exportación estática sin servicio de optimización: las imágenes ya están optimizadas en WebP.
      '@next/next/no-img-element': 'off',
    },
  },
  { ignores: ['out/', 'out-ga/', 'test-results/', 'playwright-report/', '.next/', 'dist/', '.astro/', 'scripts/', 'next-env.d.ts'] },
];

export default config;
