import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Pruebas del gestor de seguros (/admin/seguros) contra PostgreSQL real y SOLO con datos sintéticos.
export default defineConfig({
  root: path.resolve(import.meta.dirname, '..'),
  resolve: { alias: { '@': path.resolve(import.meta.dirname, '../src'), 'server-only': path.resolve(import.meta.dirname, 'tests/server-only.ts') } },
  test: {
    include: ['seguros/tests/**/*.test.ts'],
    globalSetup: ['seguros/tests/global-setup.ts'],
    setupFiles: ['seguros/tests/setup-env.ts'],
    fileParallelism: false,
    env: { TZ: 'UTC' },
  },
});
