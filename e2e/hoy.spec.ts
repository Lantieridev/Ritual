import { test, expect } from '@playwright/test';

const STATES = [
  'guest',
  'guest-sin-show',
  'first-time',
  'past-only',
  'past-only-sin-efemeride',
  'morning-after',
  'normal',
  'show-today',
  // Sin sede/clima/"Lo último que viste" (#82) — misma pasada genérica de
  // overflow, targets ≥44px y clearance de footer, con la degradación honesta.
  'normal-sin-datos',
  'show-today-sin-datos',
  // Home ranking strip (#81) — personal con distancia, general (sin
  // personalizar) y personal sin coordenadas resueltas todavía.
  'strip-personal',
  'strip-general',
  'strip-sin-distancia',
  // First-time seed ladder (#81) — un estado por escalón de pickSeeds.
  'first-time-semillas-generos',
  'first-time-semillas-pais',
  'first-time-semillas-arranque'
];

const DESKTOP_VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 }
];

test.describe('Hoy States Visual Tests', () => {
  for (const state of STATES) {
    test(`Visual and Layout Checks for ${state}`, async ({ page }, testInfo) => {
      const isMobileEmulation = testInfo.project.name === 'Pixel 7' || testInfo.project.name === 'iPhone 14';
      const viewportsToTest = isMobileEmulation ? [page.viewportSize()!] : DESKTOP_VIEWPORTS;

      for (const viewport of viewportsToTest) {
        await page.setViewportSize(viewport);
        
        const response = await page.goto(`/dev/hoy/${state}`);
        expect(response?.status()).toBe(200);

        // networkidle never settles against `next dev` (HMR keeps a connection
        // open), so wait for the page and its fonts instead.
        await page.waitForLoadState('load');
        await page.evaluate(async () => {
          await document.fonts.ready;
        });

        // Read the family the browser actually applied to a visible element of
        // each role (e.g. `Anton, "Anton Fallback"`) and check only the primary
        // face: next/font's metric-adjusted fallback face is never downloaded
        // once the real one loads, so checking the whole list is always false.
        const fontChecks = await page.evaluate(() => {
          const roles: Array<[string, string]> = [
            ['Anton', '.font-display'],
            ['Bebas Neue', '.font-figure'],
            ['Space Mono', '.font-label'],
          ];
          return roles.map(([name, selector]) => {
            const element = Array.from(document.querySelectorAll(selector)).find(
              (node) => node.getBoundingClientRect().width > 0
            );
            if (!element) return { name, family: null, loaded: null };
            const family = getComputedStyle(element).fontFamily;
            const primary = family.split(',')[0].trim();
            return { name, family, loaded: document.fonts.check(`16px ${primary}`) };
          });
        });
        for (const check of fontChecks) {
          if (check.loaded === null) continue; // role not on screen in this state/viewport
          expect.soft(check.loaded, `Font ${check.name} not loaded in ${state} (${check.family})`).toBe(true);
        }

        const overflow = await page.evaluate(() => {
          return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });
        expect.soft(overflow, `Horizontal overflow in ${state} at ${viewport.width}x${viewport.height}`).toBe(false);

        const isMobile = viewport.width < 768;
        const mainNav = page.getByRole('navigation', { name: 'Navegación principal' });
        
        if (isMobile) {
          await expect.soft(mainNav, `Main nav not visible below 768px in ${state}`).toBeVisible();
          
          const headerHidden = await page.evaluate(() => {
            const header = document.querySelector('header');
            return header ? window.getComputedStyle(header).display === 'none' : true;
          });
          expect.soft(headerHidden, `Desktop header visible below 768px in ${state}`).toBe(true);

          // The action registers in a client effect after hydration, so poll
          // instead of reading it once right after load.
          await expect
            .poll(() => page.evaluate(() => document.documentElement.hasAttribute('data-mobile-action')), {
              message: `No data-mobile-action on html in ${state}`,
              timeout: 15_000,
            })
            .toBe(true);

          const smallInteractiveElements = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('a, button, input, select, textarea, [role="button"]'));
            return elements.filter(el => {
              const rect = el.getBoundingClientRect();
              const style = window.getComputedStyle(el);
              return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && rect.height > 0 && rect.height < 44;
            }).map(el => ({ tag: el.tagName, class: el.className, text: (el as HTMLElement).innerText?.trim() }));
          });
          expect.soft(smallInteractiveElements.length, `Elements smaller than 44px found: ${JSON.stringify(smallInteractiveElements)}`).toBe(0);

          const paddingOk = await page.evaluate(() => {
            const html = document.documentElement;
            const clearance = parseInt(getComputedStyle(html).getPropertyValue('--ritual-mobile-clearance') || '0', 10);
            const footer = document.querySelector('footer');
            if (!footer) return true;
            const pb = parseInt(getComputedStyle(footer).paddingBottom || '0', 10);
            return pb >= clearance;
          });
          expect.soft(paddingOk, `Footer padding below mobile clearance in ${state}`).toBe(true);

        } else {
          await expect.soft(mainNav, `Main nav visible at/above 768px in ${state}`).toBeHidden();
          
          const headerVisible = await page.evaluate(() => {
            const header = document.querySelector('header');
            return header ? window.getComputedStyle(header).display !== 'none' : false;
          });
          expect.soft(headerVisible, `Desktop header hidden at/above 768px in ${state}`).toBe(true);
        }

        const h1s = await page.locator('h1').all();
        for (const h1 of h1s) {
          if (await h1.isVisible()) {
            const h1Box = await h1.boundingBox();
            const sectionBox = await h1.locator('xpath=ancestor::section[1]').boundingBox();
            if (h1Box) {
              expect.soft(h1Box.x + h1Box.width, `h1 overflow viewport width in ${state}`).toBeLessThanOrEqual(viewport.width);
              if (sectionBox) {
                expect.soft(h1Box.x, `h1 outside section x in ${state}`).toBeGreaterThanOrEqual(sectionBox.x);
                expect.soft(h1Box.y, `h1 outside section y in ${state}`).toBeGreaterThanOrEqual(sectionBox.y);
                expect.soft(h1Box.x + h1Box.width, `h1 outside section width in ${state}`).toBeLessThanOrEqual(sectionBox.x + sectionBox.width);
                expect.soft(h1Box.y + h1Box.height, `h1 outside section height in ${state}`).toBeLessThanOrEqual(sectionBox.y + sectionBox.height);
              }
            }
          }
        }

        await page.screenshot({ path: `test-results/screenshots/${state}-${viewport.width}x${viewport.height}-${testInfo.project.name}.png`, fullPage: true });
      }
    });
  }
});

/**
 * Home ranking strip (#81) — list semantics, the mock's 228px mobile card
 * width, and that a reason line actually renders. The generic pass above
 * already covers overflow, 44px targets and font loading for these states.
 */
test.describe('Home Ranking Strip', () => {
  const STRIP_STATES = ['strip-personal', 'strip-general', 'strip-sin-distancia'];

  for (const state of STRIP_STATES) {
    test(`strip semantics and mobile card width for ${state}`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const response = await page.goto(`/dev/hoy/${state}`);
      expect(response?.status()).toBe(200);
      await page.waitForLoadState('load');

      const list = page.getByRole('list').last();
      await expect(list).toBeVisible();

      const cards = list.getByRole('listitem');
      await expect(cards.first()).toBeVisible();

      const firstCardBox = await cards.first().boundingBox();
      expect(firstCardBox?.width).toBe(228);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(overflow).toBe(false);

      const reasonText = await page.evaluate(() => document.querySelector('.text-ritual-red.italic')?.textContent);
      expect(reasonText).toBeTruthy();
    });
  }
});

/**
 * First-time seed ladder (#81) — one harness state per `pickSeeds` tier: the
 * chips resolve (Promise + `use()`, own Suspense) and the ladder's note is
 * exactly the one that tier produces, never a hardcoded placeholder.
 */
test.describe('First-time seed ladder', () => {
  const SEED_STATES: Array<{ state: string; note: string; firstChip: string }> = [
    { state: 'first-time-semillas-generos', note: 'De los géneros que elegiste', firstChip: 'Bandalos Chinos' },
    { state: 'first-time-semillas-pais', note: 'completá el registro para afinarlo', firstChip: 'Divididos' },
    { state: 'first-time-semillas-arranque', note: 'Para arrancar', firstChip: 'Divididos' },
  ];

  for (const { state, note, firstChip } of SEED_STATES) {
    test(`resolved seed chips and honest note for ${state}`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const response = await page.goto(`/dev/hoy/${state}`);
      expect(response?.status()).toBe(200);
      await page.waitForLoadState('load');

      const chip = page.getByRole('link', { name: firstChip });
      await expect(chip).toBeVisible();
      await expect(chip).toHaveAttribute('href', `/buscar?artist=${encodeURIComponent(firstChip)}`);

      await expect(page.getByText(note, { exact: false })).toBeVisible();
    });
  }
});
