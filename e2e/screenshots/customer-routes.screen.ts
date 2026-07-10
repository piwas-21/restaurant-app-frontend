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
  /** Route-specific readiness proof that seeded (not mock-fallback) data rendered. */
  assertReady?: (page: import('@playwright/test').Page) => Promise<void>;
}> = [
  { name: 'home', path: '/' },
  {
    name: 'menu',
    path: '/menu',
    // The app silently falls back to mockApiClient data when the backend is
    // unreachable (e.g. a CSP/CORS misconfig) — assert the SEEDED product is
    // on screen so that failure mode can never become a committed baseline.
    assertReady: async (page) => {
      await expect(page.getByRole('button', { name: /^Add E2E Test Product to order$/i })).toBeVisible({
        timeout: 15_000,
      });
    },
  },
  { name: 'cart-empty', path: '/cart' },
  { name: 'reservations', path: '/reservations' },
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
      // The driver runs at desktop width (sidebar ≥1024px); restore the
      // project's viewport before capturing.
      const viewport = testInfo.project.use.viewport ?? { width: 1280, height: 720 };
      await page.setViewportSize(viewport);
      await waitForStablePage(page, theme);
      await expect(page).toHaveScreenshot(`checkout-review-${theme}.png`, { fullPage: true });
    });
  });
}
