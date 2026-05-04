import { test, expect } from '@playwright/test';

/**
 * HIGH-tier — mobile cart bottom-sheet (BUGS-IMPROVEMENTS-PLAN §C1.5.f).
 *
 * Mobile users (< 1024px, sidebar hidden) interact with the cart through
 * the FloatingCartButton on /menu, which now opens a bottom-sheet
 * containing the same controls as the desktop sidebar instead of routing
 * to the standalone /cart page. /cart still works as a fallback for deep
 * links (covered by menu-and-cart.e2e.ts) — this test is specifically the
 * sheet path.
 *
 * 430×932 is a representative mobile viewport (iPhone 14 Pro Max class)
 * that exercises both the < 1024px sidebar breakpoint and the < 768px
 * tablet rules. Viewport-only — we keep chromium so the test runs on
 * the same browser as every other public-tier e2e (project config) and
 * doesn't pull in a webkit binary the runner doesn't have.
 */

test.use({ viewport: { width: 430, height: 932 }, isMobile: true, hasTouch: true });

test('mobile FAB opens cart bottom-sheet with the same controls as the desktop sidebar', async ({ page }) => {
  // Pre-seed the cookie-consent store so the banner never appears — at
  // this viewport the banner is fixed at the bottom and overlaps the FAB,
  // intercepting our click. Key + shape mirror CookieConsentContext.tsx.
  await page.addInitScript(() => {
    localStorage.setItem(
      'rumi_cookie_consent',
      JSON.stringify({ necessary: true, preferences: true, analytics: true, marketing: true }),
    );
  });

  await page.goto('/menu');

  // The FAB only renders when the cart has items — add one first.
  const basketWritePromise = page.waitForResponse(
    (r) => r.url().includes('/api/Basket') && ['POST', 'PUT'].includes(r.request().method()),
    { timeout: 10_000 },
  );
  await page
    .getByRole('button', { name: /^Add( .+)? to order$/i })
    .first()
    .click();
  try {
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /^Add( .+)? to order$/i })
      .click({ timeout: 3_000 });
  } catch {
    /* no customization modal — direct add */
  }
  await basketWritePromise;

  // Sidebar is hidden at this viewport; the FAB is the cart entry point.
  await expect(page.getByRole('complementary', { name: /shopping basket/i })).toBeHidden();
  const fab = page.getByRole('button', { name: /view cart/i });
  await expect(fab).toBeVisible({ timeout: 5_000 });

  // Tapping it opens the sheet (a BaseModal-driven dialog whose
  // accessible name is the same "Shopping Basket" the sidebar uses).
  await fab.click();
  const sheet = page.getByRole('dialog', { name: /shopping basket/i });
  await expect(sheet).toBeVisible({ timeout: 5_000 });

  // Sheet contents mirror the sidebar: order-type toggle + at least
  // one cart item + Proceed to Checkout button.
  await expect(sheet.getByRole('group', { name: /order type/i })).toBeVisible();
  await expect(sheet.getByRole('button', { name: /increase quantity/i })).toBeVisible();
  await expect(sheet.getByRole('button', { name: /proceed to checkout/i })).toBeVisible();
});
