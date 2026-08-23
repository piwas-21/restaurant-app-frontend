import { test, expect } from '@playwright/test';
import { dismissToastsOverCartButton } from '../../helpers/menuBasket';

/**
 * HIGH-tier — mobile cart bottom-sheet (the C1.5 order-flow redesign, sub-task f).
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

  // There is no pinned rail at ANY viewport now — /menu dropped it so the card grid could have the
  // design's columns back. Asserting the old `complementary` is hidden would pass vacuously against
  // an element that no longer exists anywhere, so this asserts the thing that is actually true and
  // load-bearing here: the basket is CLOSED until something opens it, and the FAB is one of the two
  // things that can (the sticky bar's button being the other, and the only one that renders while
  // the basket is empty).
  await expect(page.getByRole('dialog', { name: /shopping basket/i })).toBeHidden();
  const fab = page.getByRole('button', { name: /view cart/i });
  await expect(fab).toBeVisible({ timeout: 5_000 });

  // The add above raises a toast, and a bottom-trailing one lands ON this button — the same
  // interception that flakes `checkout-guest` (#541). Clear it here too, rather than only inside
  // `openMenuBasket`, because this test deliberately clicks the FAB itself to prove it is the
  // sheet's own entry point.
  await dismissToastsOverCartButton(page);

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
