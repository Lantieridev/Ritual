import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // The offline/PWA specs need a production build; they have their own config.
  testIgnore: '**/pwa/**',
  // Each test walks 7 viewports, and `next dev` compiles routes on demand.
  timeout: 300 * 1000,
  expect: {
    timeout: 10000
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Five browsers at once against a single `next dev` saturate it and turn
  // into navigation timeouts that say nothing about the page.
  workers: process.env.CI ? 1 : 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Pixel 7',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'iPhone 14',
      use: { ...devices['iPhone 14'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    // Sin esto, `banda.spec.ts` (issue #82) se saltea siempre: el token
    // tiene que llegar al `next dev` que arranca este webServer, no sólo al
    // proceso de Playwright — nunca se setea en producción.
    env: { RITUAL_E2E_BANDA_TOKEN: process.env.RITUAL_E2E_BANDA_TOKEN ?? '' },
  },
});
