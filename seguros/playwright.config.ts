import { defineConfig } from '@playwright/test';

// Interfaz del gestor de seguros dentro del panel (/admin/seguros) contra la pila local, SOLO con datos
// sintéticos: base del portal migrada, personal ficticio (seguros/README.md) y `npm run seguros:demo`.
const executablePath = process.env.CHROMIUM_PATH;
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:3100', trace: 'retain-on-failure', launchOptions: executablePath ? { executablePath } : undefined, locale: 'es-ES', timezoneId: 'Europe/Madrid' },
  webServer: { command: 'npx next start -p 3100', cwd: '..', url: 'http://localhost:3100/entrar/', reuseExistingServer: true, timeout: 60_000 },
});
