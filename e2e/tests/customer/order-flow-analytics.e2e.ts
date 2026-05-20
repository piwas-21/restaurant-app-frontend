import { test, expect } from '@playwright/test';
import { captureAnalytics } from '../../helpers/analytics';

/**
 * HIGH-tier — C1 item #15: Playwright happy-path coverage of the new
 * (post-C1.5 a-h) order flow + assertion that the analytics funnel events
 * re-instrumented in this MR fire on the expected actions.
 *
 * Strategy: docs/E2E-STRATEGY.md §HIGH ("Public ordering" + "Checkout").
 *
 * Why a new file instead of extending checkout-guest.e2e.ts:
 *   - Different scope: that test verifies the *backend round-trip*
 *     (POST /api/Orders OK, confirmation page lands). This file's job is
 *     the *funnel signal* — analytics fire once, with the right payload,
 *     on the right step. Mixing them blurs the failure surface when a
 *     run goes red (e.g. an analytics regression looking like a checkout
 *     bug).
 *   - The four personas (guest takeaway, guest dine-in, guest delivery,
 *     logged-in path) need a shared analytics-capture preamble. Putting
 *     them in their own file keeps the helper application uniform.
 *
 * Pre-C1.5, the funnel was tracked via Next.js page views on
 * /cart, /checkout/customer-info, /checkout/review, /checkout/confirmation.
 * C1.5.f + C1.5.h deleted the first two pages and the smart-skip router
 * makes the third a no-page-visit fast-path in many cases — page-view
 * funnels broke. BUGS-IMPROVEMENTS-PLAN §C1.9 explicitly calls out
 * re-instrumenting as `checkout_opened` + `checkout_completed`; we also
 * added `order_type_selected` (the funnel's first real step now that
 * the welcome modal is gone).
 *
 * Events under test, with the user action that fires each:
 *   - order_type_selected → sidebar toggle click (DineIn/Takeaway/Delivery)
 *   - checkout_opened      → "Proceed to Checkout" click in the sidebar/sheet
 *   - checkout_completed   → POST /api/Orders resolves OK on /checkout/review
 *
 * Each event must:
 *   1. Fire exactly once per action (no re-render duplication).
 *   2. Carry `orderType` matching the user's pick.
 *   3. Carry `loggedIn` matching auth state (false for guest tests here).
 */

test.describe('order-flow analytics: events fire on the new C1.5 funnel', () => {
  test('takeaway guest: order_type_selected → checkout_opened → checkout_completed', async ({ page }, testInfo) => {
    const guestEmail = `e2e-analytics-${testInfo.testId}-${Date.now()}@test.local`;

    await page.goto('/menu');
    const analytics = await captureAnalytics(page);

    const sidebar = page.getByRole('complementary', { name: /shopping basket/i });
    await expect(sidebar).toBeVisible({ timeout: 15_000 });

    // ── Step 1: add a product (no analytics event tied to this — by design,
    //           cart-adds are noisy and weren't in the legacy funnel either).
    const basketWritePromise = page.waitForResponse(
      (r) => r.url().includes('/api/Basket') && ['POST', 'PUT'].includes(r.request().method()),
      { timeout: 15_000 },
    );
    await page
      .getByRole('button', { name: /^Add( .+)? to order$/i })
      .first()
      .click();
    // Some products open a customisation modal — handle both branches.
    try {
      await page
        .getByRole('dialog')
        .getByRole('button', { name: /^Add( .+)? to order$/i })
        .click({ timeout: 3_000 });
    } catch {
      /* plain add — no modal */
    }
    await basketWritePromise;

    // ── Step 2: pick Takeaway. Fires order_type_selected and opens the
    //           takeaway info modal (guest needs to provide contact info).
    await sidebar
      .getByRole('group', { name: /order type/i })
      .getByRole('button', { name: /takeaway/i })
      .click();

    const modal = page.getByRole('dialog', { name: /almost there/i });
    await expect(modal).toBeVisible({ timeout: 10_000 });

    // Snapshot after the type pick: exactly one event, of the right shape.
    const afterTypePick = await analytics.snapshot();
    const typeEvents = afterTypePick.filter((e) => e.event === 'order_type_selected');
    expect(typeEvents, 'order_type_selected fires once on toggle click').toHaveLength(1);
    expect(typeEvents[0]).toMatchObject({
      event: 'order_type_selected',
      orderType: 'Takeaway',
      source: 'sidebar',
      loggedIn: false,
    });

    // Fill the guest fields and confirm.
    await modal.getByLabel(/full name \*/i).fill('Analytics Guest');
    await modal.getByLabel(/^email \*/i).fill(guestEmail);
    await modal.getByLabel(/^phone \*/i).fill('+41791234567');
    await modal.getByRole('button', { name: /^confirm$/i }).click();
    await expect(modal).toBeHidden({ timeout: 10_000 });

    // ── Step 3: Proceed to checkout. Fires checkout_opened.
    await sidebar.getByRole('button', { name: /proceed to checkout/i }).click();
    await expect(page).toHaveURL(/\/checkout\/review$/, { timeout: 10_000 });

    const afterProceed = await analytics.snapshot();
    const openedEvents = afterProceed.filter((e) => e.event === 'checkout_opened');
    expect(openedEvents, 'checkout_opened fires once on Proceed click').toHaveLength(1);
    expect(openedEvents[0]).toMatchObject({
      event: 'checkout_opened',
      orderType: 'Takeaway',
      loggedIn: false,
    });

    // ── Step 4: place the order. Fires checkout_completed on backend OK.
    const orderResponsePromise = page.waitForResponse(
      (r) => r.url().includes('/api/Orders') && r.request().method() === 'POST',
      { timeout: 30_000 },
    );
    await page
      .getByRole('button', { name: /^(place order|placing|confirm.*order|pay)/i })
      .first()
      .click();
    const orderResponse = await orderResponsePromise;
    expect(orderResponse.ok(), `place order: ${orderResponse.status()}`).toBeTruthy();

    // Confirmation modal renders inside /checkout/review on a successful
    // POST — wait for it before snapshotting so the dispatched event has
    // landed in the capture array. We pick the modal heading rather than a
    // network/timeout signal because the network response above is the
    // signal trackEvent runs synchronously off.
    await expect(page.getByRole('heading', { level: 2, name: /order received/i })).toBeVisible({ timeout: 10_000 });

    const afterPlaced = await analytics.snapshot();
    const completedEvents = afterPlaced.filter((e) => e.event === 'checkout_completed');
    expect(completedEvents, 'checkout_completed fires once on order success').toHaveLength(1);
    expect(completedEvents[0]).toMatchObject({
      event: 'checkout_completed',
      orderType: 'Takeaway',
      loggedIn: false,
    });
    // Order id/number must be carried in the payload (used by GA enhanced
    // ecommerce / GTM downstream).
    expect(completedEvents[0].orderId, 'orderId present on checkout_completed').toBeTruthy();
    expect(completedEvents[0].orderNumber, 'orderNumber present on checkout_completed').toBeTruthy();

    // Funnel ordering — each anchor strictly precedes the next.
    const indexOf = (name: string) => afterPlaced.findIndex((e) => e.event === name);
    expect(indexOf('order_type_selected')).toBeGreaterThanOrEqual(0);
    expect(indexOf('checkout_opened')).toBeGreaterThan(indexOf('order_type_selected'));
    expect(indexOf('checkout_completed')).toBeGreaterThan(indexOf('checkout_opened'));
  });

  test('dine-in guest: order_type_selected fires with DineIn payload + opens table modal', async ({ page }) => {
    // Lighter-weight check — DineIn's full happy path needs a table-pick UI
    // exercise that's already in order-type-followup.e2e.ts. Here we just
    // assert the analytics fire on the first funnel step for this persona.
    await page.goto('/menu');
    const analytics = await captureAnalytics(page);

    const sidebar = page.getByRole('complementary', { name: /shopping basket/i });
    await expect(sidebar).toBeVisible({ timeout: 15_000 });

    await sidebar
      .getByRole('group', { name: /order type/i })
      .getByRole('button', { name: /dine in/i })
      .click();

    const tableModal = page.getByRole('dialog', { name: /select your table/i });
    await expect(tableModal).toBeVisible({ timeout: 10_000 });

    const snapshot = await analytics.snapshot();
    const dineInEvents = snapshot.filter((e) => e.event === 'order_type_selected');
    expect(dineInEvents).toHaveLength(1);
    expect(dineInEvents[0]).toMatchObject({
      event: 'order_type_selected',
      orderType: 'DineIn',
      source: 'sidebar',
      loggedIn: false,
    });
  });

  test('delivery guest: order_type_selected fires with Delivery payload + opens address modal', async ({ page }) => {
    await page.goto('/menu');
    const analytics = await captureAnalytics(page);

    const sidebar = page.getByRole('complementary', { name: /shopping basket/i });
    await expect(sidebar).toBeVisible({ timeout: 15_000 });

    await sidebar
      .getByRole('group', { name: /order type/i })
      .getByRole('button', { name: /delivery/i })
      .click();

    const addressModal = page.getByRole('dialog', { name: /where should we deliver/i });
    await expect(addressModal).toBeVisible({ timeout: 10_000 });

    const snapshot = await analytics.snapshot();
    const deliveryEvents = snapshot.filter((e) => e.event === 'order_type_selected');
    expect(deliveryEvents).toHaveLength(1);
    expect(deliveryEvents[0]).toMatchObject({
      event: 'order_type_selected',
      orderType: 'Delivery',
      source: 'sidebar',
      loggedIn: false,
    });
  });

  test('switching order type fires order_type_selected once per switch (no debounce loss)', async ({ page }) => {
    // Regression guard: a previous draft hooked the event in a useEffect
    // watching orderType — re-renders fired duplicates. Confirm one click =
    // one event by toggling through all three types.
    await page.goto('/menu');
    const analytics = await captureAnalytics(page);

    const sidebar = page.getByRole('complementary', { name: /shopping basket/i });
    await expect(sidebar).toBeVisible({ timeout: 15_000 });
    const toggle = sidebar.getByRole('group', { name: /order type/i });

    await toggle.getByRole('button', { name: /dine in/i }).click();
    // Close the table modal so the next click isn't intercepted.
    await page
      .getByRole('dialog', { name: /select your table/i })
      .getByRole('button', { name: /close/i })
      .click();
    await expect(page.getByRole('dialog', { name: /select your table/i })).toBeHidden({ timeout: 5_000 });

    await toggle.getByRole('button', { name: /delivery/i }).click();
    await page
      .getByRole('dialog', { name: /where should we deliver/i })
      .getByRole('button', { name: /close/i })
      .click();
    await expect(page.getByRole('dialog', { name: /where should we deliver/i })).toBeHidden({ timeout: 5_000 });

    await toggle.getByRole('button', { name: /takeaway/i }).click();
    // Takeaway opens the info modal for guests — leave it open, we only
    // care about the analytics tail here.

    const snapshot = await analytics.snapshot();
    const typeEvents = snapshot.filter((e) => e.event === 'order_type_selected');
    expect(typeEvents, 'three clicks = three events, no duplicates').toHaveLength(3);
    expect(typeEvents.map((e) => e.orderType)).toEqual(['DineIn', 'Delivery', 'Takeaway']);
  });
});
