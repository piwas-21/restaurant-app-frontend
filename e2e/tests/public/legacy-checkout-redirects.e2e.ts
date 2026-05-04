import { test, expect } from '@playwright/test';

/**
 * Back-compat: bookmarks / external links / older cart-checkout-button
 * versions still hit `/checkout/order-type` and `/checkout/customer-info`.
 * With §C1.5.c the order-type pick lives in the /menu sidebar; with
 * §C1.5.e/g the customer-info inputs live inside the order-type modals
 * on /menu. Both legacy URLs are retained for one release as redirects.
 */

test('legacy /checkout/order-type redirects to /menu when no order type is set', async ({ page }) => {
  await page.goto('/checkout/order-type');
  await expect(page).toHaveURL(/\/menu$/);
});

test('legacy /checkout/order-type redirects to /menu when an order type is chosen', async ({ page }) => {
  // §C1.5.h: now that /checkout/customer-info is also retired,
  // /checkout/order-type always lands on /menu.
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'rumi_order_type_state',
      JSON.stringify({ orderType: 'Takeaway', table: '', deliveryAddress: null }),
    );
  });
  await page.goto('/checkout/order-type');
  await expect(page).toHaveURL(/\/menu$/);
});

test('legacy /checkout/customer-info redirects to /menu when cart is empty', async ({ page }) => {
  // Default Playwright context starts with an empty cart, so the redirect
  // hits the cart-empty branch immediately. The remaining branches
  // ("no order type chosen" and "customerInfo already present →
  // /checkout/review") require seeding a real server-side basket and are
  // covered indirectly by the smart-skip suite, which exercises the same
  // smart-skip routing rules from the /menu sidebar's Proceed-to-Checkout.
  await page.goto('/checkout/customer-info');
  await expect(page).toHaveURL(/\/menu$/);
});
