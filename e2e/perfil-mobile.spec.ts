import { test, expect } from '@playwright/test';

/**
 * Cobertura e2e de /profile (perfil-mobile) a 390×844. La base local de
 * Supabase arranca sin sesión iniciada y sin ningún fixture de login (no
 * hay `supabase/seed.sql` ni un usuario de prueba precargado en el repo),
 * así que el único escenario reproducible acá es el guard de auth: un
 * visitante sin sesión SIEMPRE es redirigido a /login antes de que se
 * renderice ningún árbol (mobile o desktop) — Requirement: Auth-Gated
 * Behavior. El hub "Vos" poblado (header, avatar/monograma, sheet "Tu
 * cuenta", grid de 4 celdas) ya está cubierto a nivel de componente
 * (ProfileHubHeader.test.tsx, ProfileHubGrid.test.tsx) y de página
 * (app/profile/page.test.tsx) con datos mockeados — mismo criterio que
 * documentan buscar-mobile.spec.ts y coleccion-mobile.spec.ts para su
 * propio gap de sesión.
 */
const MOBILE_VIEWPORT = { width: 390, height: 844 };

test.describe('Perfil — hub mobile "Vos" (perfil-mobile)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
  });

  test('sin sesión: /profile redirige a /login sin renderizar ningún hub', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('load');

    await expect(page).toHaveURL(/\/login(\?|$)/);
    await expect(page.getByTestId('perfil-mobile')).toHaveCount(0);
    await expect(page.getByTestId('perfil-desktop')).toHaveCount(0);
  });
});
