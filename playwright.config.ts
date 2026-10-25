import { defineConfig, devices } from '@playwright/test';

// Pruebas de humo en navegador sobre la web ya generada (npm run build).
// - "web": la build normal en out/.
// - "consentimiento": una build con NEXT_PUBLIC_GA_ID en out-ga/ (npm run test:e2e:ga lo prepara).
// En entornos sin el navegador de Playwright, CHROMIUM_PATH permite usar otro Chromium.
const executablePath = process.env.CHROMIUM_PATH;
const launchOptions = executablePath ? { executablePath } : undefined;
const hasGaBuild = !!process.env.E2E_GA;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: { trace: 'retain-on-failure', launchOptions },
  webServer: [
    { command: 'node scripts/qa/serve.mjs out 4400', url: 'http://localhost:4400/', reuseExistingServer: !process.env.CI },
    ...(hasGaBuild
      ? [{ command: 'node scripts/qa/serve.mjs out-ga 4401', url: 'http://localhost:4401/', reuseExistingServer: !process.env.CI }]
      : []),
  ],
  projects: [
    { name: 'escritorio', testIgnore: /consentimiento|movil/, use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4400' } },
    { name: 'movil', testMatch: /movil/, use: { ...devices['Pixel 7'], baseURL: 'http://localhost:4400' } },
    ...(hasGaBuild
      ? [{ name: 'consentimiento', testMatch: /consentimiento/, use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4401' } }]
      : []),
  ],
});
