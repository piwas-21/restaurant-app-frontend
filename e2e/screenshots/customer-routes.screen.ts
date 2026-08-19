import { test, expect } from '@playwright/test';
import { THEMES, prepareForScreenshots, gotoStable, waitForStablePage, driveGuestCheckoutToReview } from './helpers';

/**
 * Screenshot baseline — customer-facing routes only (staff/admin is NOT
 * templated in v1). This is the T2 gate input for the tenant-templates plan:
 * extracting the current RUMI look into the `classic` template must produce
 * ZERO visual diff against these captures.
 *
 * Matrix: 7 routes × 2 themes (this file) × 2 viewports (projects in
 * playwright.screenshots.config.ts) = 28 full-page PNGs, committed under
 * e2e/screenshots/__screenshots__/. Linux-generated only — regenerate via
 * `npm run test:screenshots:docker:update` (see e2e/README.md).
 *
 * Requires the same seeded backend stack as the functional e2e suite
 * (backend on :5221 + e2e/seed/seed.sql applied).
 */

const STATIC_ROUTES: ReadonlyArray<{
  name: string;
  path: string;
  /** Route-specific readiness proof that the seeded backend data actually rendered. */
  assertReady?: (page: import('@playwright/test').Page) => Promise<void>;
}> = [
  { name: 'home', path: '/' },
  {
    name: 'menu',
    path: '/menu',
    // An unreachable backend (e.g. a CSP/CORS misconfig) now renders the
    // menu's error state rather than data — assert the SEEDED product is on
    // screen so that page can never become a committed baseline.
    //
    // Scoped to a CARD, not to the grid — the hero is a cell OF the grid now. The seeded product
    // is also the featured special, and the hero's add control carries the same item-specific
    // accessible name the card's does, so anything wider resolves to two elements.
    assertReady: async (page) => {
      await expect(
        page.getByTestId('menu-card').getByRole('button', { name: /^Add E2E Test Product to order$/i }),
      ).toBeVisible({ timeout: 15_000 });
    },
  },
  { name: 'cart-empty', path: '/cart' },
  {
    name: 'reservations',
    path: '/reservations',
    // The date strip renders nothing until the day the RESTAURANT is on has been established
    // (#517), so an unstubbed or failing `/api/tenant/today` would commit a baseline with no dates
    // in it — the same argument as `menu` above. 14 days, the fortnight the form offers.
    assertReady: async (page) => {
      await expect(page.locator('[class*="dateButton"]')).toHaveCount(14, { timeout: 15_000 });
    },
  },
  { name: 'login', path: '/auth/login' },
  { name: 'register', path: '/auth/register' },
];

for (const theme of THEMES) {
  test.describe(`${theme} theme`, () => {
    for (const route of STATIC_ROUTES) {
      test(`${route.name} page matches the ${theme} baseline`, async ({ page }) => {
        await prepareForScreenshots(page, theme);
        await gotoStable(page, route.path, theme);
        await route.assertReady?.(page);
        await expect(page).toHaveScreenshot(`${route.name}-${theme}.png`, { fullPage: true });
      });
    }

    test(`checkout review page matches the ${theme} baseline`, async ({ page }, testInfo) => {
      await prepareForScreenshots(page, theme);
      await driveGuestCheckoutToReview(page);
      // Park the pointer off-canvas before capturing. The driver's last click leaves the mouse
      // wherever that control was, and on /checkout/review that landed on the tip amount's
      // `<input type="number">` — whose Chromium stepper arrows only paint on hover. It would have
      // been baked into the craft baseline as a 2.2% pixel diff with no product change behind it,
      // and re-broken the moment any future driver clicked somewhere else.
      await page.mouse.move(0, 0);
      // The driver runs at desktop width; restore the project's viewport before capturing.
      const viewport = testInfo.project.use.viewport ?? { width: 1280, height: 720 };
      await page.setViewportSize(viewport);
      await waitForStablePage(page, theme);
      await expect(page).toHaveScreenshot(`checkout-review-${theme}.png`, { fullPage: true });
    });
  });
}
