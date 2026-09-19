import { test, expect } from '@playwright/test'

const email = process.env.RITUAL_E2E_EMAIL
const password = process.env.RITUAL_E2E_PASSWORD

test.skip(!email || !password, 'Set RITUAL_E2E_EMAIL and RITUAL_E2E_PASSWORD (a dedicated test account)')

test('an expense created offline syncs exactly once when signal returns', async ({ page, context }) => {
  // 1. Sign in online.
  await page.goto('/login')
  await page.locator('#email').fill(email!)
  await page.locator('#password').fill(password!)
  await page.locator('button[type=submit]').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))

  // 2. Let the service worker take control and cache the expense form.
  await page.goto('/expenses/nuevo')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true)
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.scope)
  expect(scope).toBe('http://localhost:3100/')
  // Give the cache warm-up (OutboxSync) a moment to finish its fetches.
  await page.waitForLoadState('networkidle')

  // 3. Go offline and cold-reload: the form must still open.
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByLabel(/Monto/)).toBeVisible()

  // 4. Add an expense offline.
  const note = `e2e-offline-${Date.now()}`
  await page.getByLabel(/Monto/).fill('123')
  await page.getByLabel(/Categoría/).selectOption('Entrada')
  await page.getByLabel('Nota').fill(note)
  await page.getByRole('button', { name: 'Agregar gasto' }).click()
  await expect(page.getByText(/Guardado en tu dispositivo/)).toBeVisible()
  await expect(page.getByText('Pendiente de sincronizar')).toBeVisible()

  // 5. Back online: it syncs, and the create request is sent exactly once.
  const creates: string[] = []
  page.on('request', (req) => {
    const body = req.postData() ?? ''
    if (req.url().endsWith('/api/graphql') && body.includes('createExpense')) creates.push(body)
  })
  await context.setOffline(false)
  await expect(page.getByText('Pendiente de sincronizar')).toHaveCount(0, { timeout: 15_000 })
  expect(creates).toHaveLength(1)

  // 6. It really landed on the server.
  await page.goto('/expenses')
  await expect(page.getByText(note)).toHaveCount(1)
})
