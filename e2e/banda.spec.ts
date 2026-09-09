import { test, expect } from '@playwright/test';

/**
 * Banda de "Tu entrada de hoy" en el layout raíz (issue #82). Sin una sesión
 * real ni un show cargado, se fuerza vía el cookie de dev (R1-001): sólo
 * habilita fuera de producción y con `RITUAL_E2E_BANDA_TOKEN` seteado — sin
 * el token, esta suite entera se saltea en vez de fallar.
 */
const token = process.env.RITUAL_E2E_BANDA_TOKEN;

// La banda vive en MobileTabBar, `md:hidden` — sin un viewport mobile queda
// display:none y ningún locator por rol la encuentra (mismo ancho que usa
// hoy-tonight.spec.ts).
const MOBILE_VIEWPORT = { width: 390, height: 844 };

test.describe('Banda de "Tu entrada de hoy" (#82)', () => {
  test.skip(!token, 'RITUAL_E2E_BANDA_TOKEN no está seteado — banda.spec.ts se saltea (ver CONTRIBUTING.md).');

  test.beforeEach(async ({ context, page, baseURL }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await context.addCookies([
      { name: 'ritual-dev-banda', value: token!, url: baseURL },
    ]);
  });

  test('se muestra en /buscar', async ({ page }) => {
    const response = await page.goto('/buscar');
    expect(response?.status()).toBe(200);
    await page.waitForLoadState('load');

    await expect(page.getByRole('link', { name: /Tu entrada de hoy/i })).toBeVisible();
  });

  test('se muestra en /coleccion', async ({ page }) => {
    const response = await page.goto('/coleccion');
    expect(response?.status()).toBe(200);
    await page.waitForLoadState('load');

    await expect(page.getByRole('link', { name: /Tu entrada de hoy/i })).toBeVisible();
  });

  test('no se muestra en Home — ahí la acción principal la decide la página', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
    await page.waitForLoadState('load');

    await expect(page.getByRole('link', { name: /Tu entrada de hoy/i })).toHaveCount(0);
  });
});
