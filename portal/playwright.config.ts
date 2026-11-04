import { defineConfig } from '@playwright/test';

// Pruebas de extremo a extremo contra la pila local REAL (Postgres + Supabase Storage + SMTP local),
// con identidades y documentos ficticios. Arranca antes: scripts/dev-stack.sh reset && npm run db:seed && npm run build.
const executablePath = process.env.CHROMIUM_PATH;
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:3100', trace: 'retain-on-failure', launchOptions: executablePath ? { executablePath } : undefined, locale: 'es-ES', timezoneId: 'Europe/Madrid' },
  webServer: { command: 'npx next start -p 3100', url: 'http://localhost:3100/entrar/', reuseExistingServer: true, timeout: 60_000 },
});
