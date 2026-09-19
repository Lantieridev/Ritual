import { defineConfig, devices } from '@playwright/test'

/**
 * The service worker only registers in a production build, so the offline
 * tests run against `next build && next start`, not the dev server the main
 * config uses. Needs a dedicated test account:
 *   RITUAL_E2E_EMAIL / RITUAL_E2E_PASSWORD
 */
export default defineConfig({
  testDir: './e2e/pwa',
  timeout: 120_000,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:3100', trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build && npm run start -- -p 3100',
    url: 'http://localhost:3100',
    reuseExistingServer: true,
    timeout: 600_000,
  },
})
