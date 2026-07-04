import { test, expect } from '@playwright/test';

/**
 * Cobertura e2e de la pantalla mobile unificada de /coleccion
 * (coleccion-mobile), a 390×844 (mismo viewport que buscar-mobile.spec.ts).
 * La base local de Supabase arranca sin seed data (no hay
 * `supabase/seed.sql` en el repo) y sin sesión iniciada, así que
 * `listMyEvents()` siempre devuelve `[]` acá: el único estado real y
 * reproducible sin datos sembrados es el vacío honesto. El estado poblado
 * (grilla/lista/toggle/omisión de puntaje y sede) ya está cubierto a nivel de
 * componente (CollectionDiaryGrid/List/Header.test.tsx) y a nivel de página
 * (app/coleccion/page.test.tsx) con datos mockeados — mismo criterio que
 * documenta buscar-mobile.spec.ts para su propio gap.
 */
const MOBILE_VIEWPORT = { width: 390, height: 844 };

test.describe('Colección — diario mobile (coleccion-mobile)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
  });

  test('sin shows cargados: muestra el vacío honesto y la acción de cargar un show', async ({ page }) => {
    const response = await page.goto('/coleccion');
    expect(response?.status()).toBe(200);
    await page.waitForLoadState('load');

    // El árbol de escritorio (hidden md:block) también está en el DOM —
    // oculto por CSS a este viewport, no removido — así que las
    // aserciones se acotan al testid del árbol mobile (mismo criterio que
    // buscar-mobile.spec.ts).
    const mobile = page.getByTestId('coleccion-mobile');
    await expect(mobile.getByText('Todavía no cargaste ningún show.')).toBeVisible();
    await expect(mobile.getByText('Los que ya viste también cuentan.')).toBeVisible();
    await expect(mobile.getByRole('link', { name: 'Cargar un show' }).first()).toBeVisible();
  });

  test('?vista=lista carga sin error, incluso sin shows cargados', async ({ page }) => {
    const response = await page.goto('/coleccion?vista=lista');
    expect(response?.status()).toBe(200);
    await page.waitForLoadState('load');

    const mobile = page.getByTestId('coleccion-mobile');
    await expect(mobile.getByText('Todavía no cargaste ningún show.')).toBeVisible();
  });
});
