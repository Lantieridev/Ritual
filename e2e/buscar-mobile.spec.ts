import { test, expect } from '@playwright/test';

/**
 * Cobertura e2e de la pantalla mobile unificada de /buscar (buscar-mobile),
 * a 390×844 (mismo viewport que hoy-tonight.spec.ts). La base local de
 * Supabase arranca sin seed data (no hay `supabase/seed.sql` en el repo),
 * así que el escenario de "tipear y ver resultados" se cubre contra ese
 * estado real: confirma que el round-trip del form GET funciona y que la
 * pantalla degrada honesto a "Sin resultados", en vez de fabricar una fila
 * inexistente. Ver el reporte de aplicación (buscar-mobile) para el gap
 * documentado: probar una fila real necesita datos sembrados o un fixture
 * `/dev/buscar` — ninguno existe hoy y crearlo está fuera del alcance de
 * esta unidad de trabajo.
 */
const MOBILE_VIEWPORT = { width: 390, height: 844 };

test.describe('Buscar — pantalla mobile de chips (buscar-mobile)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
  });

  test('tipear y confirmar navega con la query y muestra el estado de resultados (honesto, sin datos sembrados)', async ({ page }) => {
    const response = await page.goto('/buscar');
    expect(response?.status()).toBe(200);
    await page.waitForLoadState('load');

    const field = page.getByPlaceholder('artista, sede, festival');
    await field.fill('zzz-no-existe-zzz');
    await field.press('Enter');

    await page.waitForURL(/q=zzz-no-existe-zzz/);
    // El árbol de escritorio (hidden md:block) también matchea el mismo
    // texto — está oculto por CSS a este viewport, pero sigue en el DOM, así
    // que se acota al testid del árbol mobile (mismo criterio que
    // page.test.tsx con `within`).
    const mobile = page.getByTestId('buscar-mobile');
    await expect(mobile.getByText(/Sin resultados para/)).toBeVisible();
  });

  test('tocar un chip filtra y el header de resultados muestra el nombre del chip', async ({ page }) => {
    const response = await page.goto('/buscar?q=obras');
    expect(response?.status()).toBe(200);
    await page.waitForLoadState('load');

    const mobile = page.getByTestId('buscar-mobile');
    const chip = mobile.getByRole('link', { name: 'Artistas' });
    await chip.click();

    await page.waitForURL(/filtro=artistas/);
    await expect(mobile.getByRole('link', { name: 'Artistas' })).toHaveAttribute('aria-current', 'true');
    // El header de resultados es un <p>, distinto del chip <a> — ambos
    // dicen "Artistas", así que se acota por tag para no ambigüar.
    await expect(mobile.locator('p').filter({ hasText: /^Artistas$/ })).toBeVisible();
  });

  test('Cerca sin sesión: muestra el aviso honesto y nunca "a N km"', async ({ page }) => {
    const response = await page.goto('/buscar?filtro=cerca');
    expect(response?.status()).toBe(200);
    await page.waitForLoadState('load');

    await expect(page.getByText('«Cerca» necesita tu sesión')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible();
    await expect(page.getByText(/\bkm\b/i)).toHaveCount(0);
  });

  test('el link de cartelera lleva a ?tab=cartelera y no es un sexto chip', async ({ page }) => {
    const response = await page.goto('/buscar');
    expect(response?.status()).toBe(200);
    await page.waitForLoadState('load');

    const chips = page.getByRole('link', { name: /^(Todo|Artistas|Sedes|Festivales|Cerca)$/ });
    await expect(chips).toHaveCount(5);

    const carteleraLink = page.getByRole('link', { name: /Buscá en cartelera/ });
    await expect(carteleraLink).toBeVisible();
    await carteleraLink.click();

    await page.waitForURL(/tab=cartelera/);
  });
});
