import { test, expect } from '../../fixtures/customerUser';
import { request } from '@playwright/test';
import { apiBaseUrl } from '../../helpers/config';

/**
 * HIGH-tier — smart-skip checkout (BUGS-IMPROVEMENTS-PLAN §C1.5.d).
 *
 * Goal: a logged-in customer whose profile already has the data the
 * chosen order type needs (Takeaway: name + phone) skips the
 * /checkout/customer-info page and lands directly on /checkout/review.
 * The fallback (incomplete profile) keeps the existing flow.
 *
 * Both paths are exercised in one file because they share the same
 * fixture setup cost (register + verify + login = ~3-4s).
 */

test('logged-in user with phone skips customer-info on Takeaway', async ({ customerUser, browser }) => {
  // Register-fixture creates a user with firstName + lastName + email but
  // no phoneNumber. Add the phone via the API so Takeaway becomes
  // "complete" per profileCompleteness rules.
  const ctx = await request.newContext({
    baseURL: apiBaseUrl(),
    extraHTTPHeaders: { Authorization: `Bearer ${customerUser.accessToken}` },
  });
  try {
    const update = await ctx.put('/api/User/profile', {
      data: { firstName: customerUser.firstName, lastName: customerUser.lastName, phoneNumber: '+41791234567' },
    });
    expect(update.ok(), `update profile: ${update.status()} ${await update.text()}`).toBeTruthy();
  } finally {
    await ctx.dispose();
  }

  const context = await browser.newContext({ storageState: customerUser.storageStatePath });
  const page = await context.newPage();
  try {
    await page.goto('/menu');

    const sidebar = page.getByRole('complementary', { name: /shopping basket/i });
    await expect(sidebar).toBeVisible({ timeout: 15_000 });

    // Add an item — sidebar Proceed-to-Checkout requires non-empty cart.
    const basketWritePromise = page.waitForResponse(
      (r) => r.url().includes('/api/Basket') && ['POST', 'PUT'].includes(r.request().method()),
      { timeout: 10_000 },
    );
    await page.getByRole('button', { name: /^Add( .+)? to order$/i }).first().click();
    try {
      await page.getByRole('dialog').getByRole('button', { name: /^Add( .+)? to order$/i }).click({ timeout: 3_000 });
    } catch {
      /* no customization modal — direct add */
    }
    await basketWritePromise;

    // Pick Takeaway in the sidebar — no follow-up modal for this type.
    await sidebar.getByRole('group', { name: /order type/i }).getByRole('button', { name: /takeaway/i }).click();

    // Proceed-to-Checkout — expect smart-skip to /checkout/review.
    await sidebar.getByRole('button', { name: /proceed to checkout/i }).click();
    await expect(page).toHaveURL(/\/checkout\/review$/, { timeout: 10_000 });
  } finally {
    await context.close();
  }
});

test('logged-in user without phone falls through to customer-info on Takeaway', async ({
  customerUser,
  browser,
}) => {
  // Default fixture: no phoneNumber. Takeaway should NOT skip.
  const context = await browser.newContext({ storageState: customerUser.storageStatePath });
  const page = await context.newPage();
  try {
    await page.goto('/menu');

    const sidebar = page.getByRole('complementary', { name: /shopping basket/i });
    await expect(sidebar).toBeVisible({ timeout: 15_000 });

    const basketWritePromise = page.waitForResponse(
      (r) => r.url().includes('/api/Basket') && ['POST', 'PUT'].includes(r.request().method()),
      { timeout: 10_000 },
    );
    await page.getByRole('button', { name: /^Add( .+)? to order$/i }).first().click();
    try {
      await page.getByRole('dialog').getByRole('button', { name: /^Add( .+)? to order$/i }).click({ timeout: 3_000 });
    } catch {
      /* no modal */
    }
    await basketWritePromise;

    await sidebar.getByRole('group', { name: /order type/i }).getByRole('button', { name: /takeaway/i }).click();
    await sidebar.getByRole('button', { name: /proceed to checkout/i }).click();

    // Incomplete profile → existing customer-info flow.
    await expect(page).toHaveURL(/\/checkout\/customer-info$/, { timeout: 10_000 });
  } finally {
    await context.close();
  }
});
