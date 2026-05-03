import { test, expect } from '@playwright/test';

/**
 * Back-compat: bookmarks / cart-checkout-button still hit
 * /checkout/order-type. With C1.5.c the order-type pick lives in the
 * /menu sidebar instead, so the legacy URL must redirect cleanly.
 *
 * Originally part of `order-type-welcome.e2e.ts` (C1.5.a). Renamed here
 * after the welcome-modal pattern was retired; the two redirect cases
 * remain valuable invariants regardless of how type-picking is shaped.
 */

test('legacy /checkout/order-type page redirects to /menu when no order type is set', async ({ page }) => {
  await page.goto('/checkout/order-type');
  await expect(page).toHaveURL(/\/menu$/);
});

test('legacy /checkout/order-type page redirects to /checkout/customer-info when chosen', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'rumi_order_type_state',
      JSON.stringify({ orderType: 'Takeaway', table: '', deliveryAddress: null }),
    );
  });
  await page.goto('/checkout/order-type');
  await expect(page).toHaveURL(/\/checkout\/customer-info$/);
});
