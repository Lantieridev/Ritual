import { test, expect } from '@playwright/test';

const STATES = [
  'guest',
  'guest-sin-show',
  'first-time',
  'past-only',
  'past-only-sin-efemeride',
  'morning-after',
  'normal',
  'show-today'
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
