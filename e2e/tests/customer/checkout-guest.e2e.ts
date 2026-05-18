import { test, expect } from '@playwright/test';
import { deleteUserByEmail } from '../../helpers/db';
import { expectNoA11yViolations } from '../../helpers/a11y';

/**
 * HIGH-tier — guest places an order end-to-end.
 *
 * Strategy: docs/E2E-STRATEGY.md §HIGH:
 *   "Public ordering: home → menu browse → add product (with options) →
 *    view cart → place order as guest"
 *
 * Flow:
 *   1. Visit /menu in a fresh public context (no fixture, no auth).
 *   2. Add the first available product to the basket. If the click opens
 *      a customisation modal, confirm it; otherwise the click goes straight
 *      to the basket — handle both (the menu mixes plain products and
 *      products-with-options).
 *   3. Wait for the basket POST/PUT before continuing — Playwright otherwise
 *      races against React-Query's optimistic update and clicks Proceed
 *      before the cart hydrates.
 *   4. Sidebar Order-type group → Takeaway → fill TakeawayInfoModal
 *      (full name + email + phone) without ticking the inline-register
 *      checkbox. We're testing the pure-guest path (§C1.5.e) — the inline-
 *      register variant is already covered in customer/smart-skip-checkout.
 *   5. Sidebar Proceed routes straight to /checkout/review (smart-skip
 *      via CheckoutContext — guest flow).
 *   6. Confirm the order from /checkout/review and assert
 *      /checkout/confirmation lands.
 *   7. a11y scan on the landing /menu view.
 *
 * Cleanup: a guest order doesn't create a User row, so there's no
 * deleteUserByEmail equivalent. Orders accumulate in the test DB; the
 * E2E DB is reset between runs by scripts/dev-e2e.sh — no per-test
 * order cleanup here. If the inline-register checkbox were toggled
 * (it isn't in this test), we'd delete the resulting User in afterEach.
 */

test.describe('checkout-guest: public ordering as guest', () => {
  let createdEmail: string | undefined;

  test.afterEach(async () => {
    // Defensive cleanup — only fires if a future variant of this test
    // ends up creating a user (e.g. by ticking inline-register). Today's
    // pure-guest path leaves it undefined and this is a no-op.
    if (createdEmail) {
      try {
        await deleteUserByEmail(createdEmail);
      } catch (err) {
        console.warn(`[checkout-guest.e2e] cleanup failed for ${createdEmail}:`, err);
      } finally {
        createdEmail = undefined;
      }
    }
  });

  test('guest browses menu, adds product, places Takeaway order', async ({ page }, testInfo) => {
    const guestEmail = `e2e-guest-${testInfo.testId}-${Date.now()}@test.local`;
    // Track in createdEmail so the afterEach cleanup runs even if the
    // backend ends up creating a user record for this guest (e.g. a
    // future variant of the test ticks the inline-register checkbox,
    // or the order-create handler decides to materialise a guest
    // identity). Today the pure-guest path leaves no User row, so
    // deleteUserByEmail is idempotent and returns 0.
    createdEmail = guestEmail;

    await page.goto('/menu');

    // Landing-view a11y scan — catches missing labels, contrast issues,
    // heading order. Per E2E-STRATEGY §Accessibility, scope is the whole
    // landing view (no exclusions).
    await expectNoA11yViolations(page);

    const sidebar = page.getByRole('complementary', { name: /shopping basket/i });
    await expect(sidebar).toBeVisible({ timeout: 15_000 });

    // Add the first available product. Wait on the basket POST so we
    // don't race React-Query's optimistic update before clicking Proceed.
    const basketWritePromise = page.waitForResponse(
      (r) => r.url().includes('/api/Basket') && ['POST', 'PUT'].includes(r.request().method()),
      { timeout: 15_000 },
    );

    await page
      .getByRole('button', { name: /^Add( .+)? to order$/i })
      .first()
      .click();

    // Some products open a customisation modal; if so, confirm. If not,
    // the click already added the item — the try/catch keeps both paths
    // green. Same pattern as smart-skip-checkout.e2e.ts.
    try {
      await page
        .getByRole('dialog')
        .getByRole('button', { name: /^Add( .+)? to order$/i })
        .click({ timeout: 3_000 });
    } catch {
      /* no customisation modal */
    }

    await basketWritePromise;

    // Choose Takeaway → TakeawayInfoModal opens (guest hasn't filled
    // name/email/phone yet, so checkout-completeness check fails and
    // OrderFlowModals shows the takeaway modal).
    await sidebar
      .getByRole('group', { name: /order type/i })
      .getByRole('button', { name: /takeaway/i })
      .click();

    const modal = page.getByRole('dialog', { name: /almost there/i });
    await expect(modal).toBeVisible({ timeout: 10_000 });

    // Pure-guest path: leave inline-register checkbox unchecked.
    // We're not creating an account, just providing the contact details
    // the order needs.
    await modal.getByLabel(/full name \*/i).fill('Guest E2E');
    await modal.getByLabel(/^email \*/i).fill(guestEmail);
    await modal.getByLabel(/^phone \*/i).fill('+41791234567');
    await modal.getByRole('button', { name: /^confirm$/i }).click();
    await expect(modal).toBeHidden({ timeout: 10_000 });

    // Sidebar Proceed → /checkout/review (smart-skip routes straight
    // through because CheckoutContext now reports complete for the guest).
    await sidebar.getByRole('button', { name: /proceed to checkout/i }).click();
    await expect(page).toHaveURL(/\/checkout\/review$/, { timeout: 10_000 });

    // Place the order from /checkout/review. The submit button label can
    // shift between locales / progress states (e.g. "Placing…"); match a
    // permissive name regex so the test doesn't bounce on copy tweaks.
    const orderResponsePromise = page.waitForResponse(
      (r) => r.url().includes('/api/Orders') && r.request().method() === 'POST',
      { timeout: 30_000 },
    );
    await page
      .getByRole('button', { name: /^(place order|placing|confirm.*order|pay)/i })
      .first()
      .click();
    const orderResponse = await orderResponsePromise;
    expect(orderResponse.ok(), `place order: ${orderResponse.status()} ${await orderResponse.text()}`).toBeTruthy();

    // /checkout/review renders an OrderConfirmationModal on successful POST
    // — the user reviews the order number, then dismisses the modal which
    // is what navigates to /checkout/confirmation (see OrderConfirmationModal
    // wiring in src/app/checkout/review/page.tsx → handleCloseConfirmationModal).
    // Without an explicit dismiss the URL stays at /checkout/review, which
    // is what the early version of this test hit.
    //
    // NB: this modal is a hand-rolled <div> rather than the BaseModal wrapper
    // so it has no role="dialog" / aria-labelledby. Targeting the visible
    // h2 heading instead. Tracked for a11y migration in frontend #54.
    await expect(page.getByRole('heading', { level: 2, name: /order received/i })).toBeVisible({ timeout: 10_000 });
    // The overlay covers the viewport with the modal centered; clicking at
    // (0,0) reliably lands on the overlay (not the modal content) and fires
    // its onClick → handleCloseConfirmationModal → router.push(/confirmation).
    await page.mouse.click(0, 0);

    // Confirmation lands. The confirmation page reads ?orderId & orderNumber
    // from the query string and renders the receipt.
    await expect(page).toHaveURL(/\/checkout\/confirmation/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10_000 });
  });
});
