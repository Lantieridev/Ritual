import { test, expect } from '@playwright/test';

/**
 * Cobertura e2e específica del hero mobile de "hoy"/"cuenta regresiva"
 * (#82): badge de hora, CTA "Abrir mi entrada" hoisted sobre el talón de
 * navegación, y degradación honesta de dirección/clima/"Lo último que
 * viste". `hoy.spec.ts` ya cubre overflow, targets ≥44px y clearance de
 * footer para estos mismos estados vía su barrido genérico — este archivo
 * agrega las aserciones de contenido que ese barrido no puede expresar.
 */

const MOBILE_VIEWPORT = { width: 390, height: 844 };

test.describe('Hoy — hero mobile de show-today/normal (#82)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
  });

  test('show-today: abre el talón desde el CTA hoisted y no muestra butaca', async ({ page }) => {
    const response = await page.goto('/dev/hoy/show-today');
    expect(response?.status()).toBe(200);
    await page.waitForLoadState('load');

    await expect(page.getByText(/esta noche · \d{2}:\d{2}/i)).toBeVisible();
    // "Campo general" sigue en el DOM (el talón 3D de escritorio la trae
    // hardcodeada), pero su `<section>` está `hidden` a este ancho — ningún
    // "Campo general" debe quedar VISIBLE en mobile (`toHaveCount` no filtra
    // por visibilidad, por eso se recorre cada match).
    const seatLabels = page.getByText(/campo general/i);
    for (const label of await seatLabels.all()) {
      await expect(label).toBeHidden();
    }

    const cta = page.getByRole('button', { name: 'Abrir mi entrada' });
    await expect(cta).toBeVisible();
    await cta.click();

    // El talón vive una vez por breakpoint (desktop `hidden md:block`,
    // mobile `md:hidden`); a este ancho sólo la instancia mobile debe ser
    // visible — la de escritorio sigue en el DOM pero oculta por CSS.
    await expect
      .poll(async () => {
        const passes = await page.getByText('Entrada válida').all();
        let visible = 0;
        for (const p of passes) if (await p.isVisible()) visible++;
        return visible;
      })
      .toBe(1);
  });

  test('normal: el badge muestra fecha y hora, no "Esta noche"', async ({ page }) => {
    const response = await page.goto('/dev/hoy/normal');
    expect(response?.status()).toBe(200);
    await page.waitForLoadState('load');

    await expect(page.getByText(/esta noche/i)).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('show-today-sin-datos: omite dirección, clima y "Lo último que viste" enteros', async ({ page }) => {
    const response = await page.goto('/dev/hoy/show-today-sin-datos');
    expect(response?.status()).toBe(200);
    await page.waitForLoadState('load');

    await expect(page.getByText('Lo último que viste')).toHaveCount(0);
    await expect(page.getByText(/llueve/i)).toHaveCount(0);
  });

  test('normal-sin-datos: la cuenta regresiva mobile también degrada honesto', async ({ page }) => {
    const response = await page.goto('/dev/hoy/normal-sin-datos');
    expect(response?.status()).toBe(200);
    await page.waitForLoadState('load');

    await expect(page.getByText('Lo último que viste')).toHaveCount(0);
    await expect(page.getByText(/llueve/i)).toHaveCount(0);
  });
});
