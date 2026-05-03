import { test as authedTest, expect } from '../../fixtures/customerUser';
import { test as publicTest } from '@playwright/test';
import { request } from '@playwright/test';
import { apiBaseUrl } from '../../helpers/config';
import { deleteUserByEmail } from '../../helpers/db';

/**
 * HIGH-tier — smart-skip checkout (BUGS-IMPROVEMENTS-PLAN §C1.5.d + §C1.5.e).
 *
 * Three paths land on /checkout/review without ever visiting
 * /checkout/customer-info:
 *   1. logged-in user with all profile fields on file (§C1.5.d) — Takeaway
 *      commits silently, sidebar Proceed routes straight through.
 *   2. logged-in user with a missing field (§C1.5.e) — TakeawayInfoModal
 *      opens, user fills phone, modal closes, sidebar Proceed routes
 *      straight through.
 *   3. guest user (§C1.5.e) — TakeawayInfoModal opens with name + email +
 *      phone + the register CTA, user fills, modal closes, sidebar
 *      Proceed routes straight through (guest is "complete" via
 *      CheckoutContext, no API auth needed).
 *
 * Logged-in tests share the customerUser fixture (register + verify +
 * login = ~3-4s); the guest test uses a clean Playwright browser
 * context with no auth.
 */

authedTest('logged-in user with phone skips customer-info on Takeaway', async ({ customerUser, browser }) => {
  // Register-fixture creates a user with firstName + lastName + email but
  // no phoneNumber. Add the phone via the API so Takeaway becomes
  // "complete" per profileCompleteness rules — no modal opens.
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

    await sidebar
      .getByRole('group', { name: /order type/i })
      .getByRole('button', { name: /takeaway/i })
      .click();
    // No takeaway info modal — profile is complete.
    await expect(page.getByRole('dialog', { name: /almost there/i })).toBeHidden();

    await sidebar.getByRole('button', { name: /proceed to checkout/i }).click();
    await expect(page).toHaveURL(/\/checkout\/review$/, { timeout: 10_000 });
  } finally {
    await context.close();
  }
});

authedTest(
  'logged-in user without phone fills Takeaway modal then skips customer-info',
  async ({ customerUser, browser }) => {
    // Default fixture: no phoneNumber. Takeaway should open the info modal
    // with only the phone field (name + email come from profile).
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
        /* no modal */
      }
      await basketWritePromise;

      await sidebar
        .getByRole('group', { name: /order type/i })
        .getByRole('button', { name: /takeaway/i })
        .click();

      // Modal opens. Logged-in users see only the missing field — phone.
      const modal = page.getByRole('dialog', { name: /almost there/i });
      await expect(modal).toBeVisible({ timeout: 10_000 });
      // Name/email shouldn't be re-prompted.
      await expect(modal.getByLabel(/full name \*/i)).toBeHidden();
      await expect(modal.getByLabel(/^email \*/i)).toBeHidden();

      await modal.getByLabel(/^phone \*/i).fill('+41791234567');
      await modal.getByRole('button', { name: /^confirm$/i }).click();
      await expect(modal).toBeHidden({ timeout: 5_000 });

      await sidebar.getByRole('button', { name: /proceed to checkout/i }).click();
      await expect(page).toHaveURL(/\/checkout\/review$/, { timeout: 10_000 });
    } finally {
      await context.close();
    }
  },
);

publicTest('guest fills Takeaway modal and skips customer-info', async ({ browser }) => {
  // Clean context — no auth_token. Picking Takeaway should open the
  // modal with all three fields + the register CTA.
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto('/menu');

    const sidebar = page.getByRole('complementary', { name: /shopping basket/i });
    await expect(sidebar).toBeVisible({ timeout: 15_000 });

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
      /* no modal */
    }
    await basketWritePromise;

    await sidebar
      .getByRole('group', { name: /order type/i })
      .getByRole('button', { name: /takeaway/i })
      .click();

    const modal = page.getByRole('dialog', { name: /almost there/i });
    await expect(modal).toBeVisible({ timeout: 10_000 });

    // Benefits block is visible only for guests (§C1.5.g).
    await expect(modal.getByRole('checkbox', { name: /create my account/i })).toBeVisible();

    await modal.getByLabel(/full name \*/i).fill('Guest E2E');
    await modal.getByLabel(/^email \*/i).fill(`e2e-guest-${Date.now()}@test.local`);
    await modal.getByLabel(/^phone \*/i).fill('+41791234567');
    await modal.getByRole('button', { name: /^confirm$/i }).click();
    await expect(modal).toBeHidden({ timeout: 5_000 });

    await sidebar.getByRole('button', { name: /proceed to checkout/i }).click();
    await expect(page).toHaveURL(/\/checkout\/review$/, { timeout: 10_000 });
  } finally {
    await context.close();
  }
});

publicTest('guest opts in to inline registration via Takeaway modal (§C1.5.g)', async ({ browser }, testInfo) => {
  // The hook fires POST /api/User/register/customer and proceeds as
  // guest regardless (option A). We verify the modal closes + checkout
  // routes through, and clean up the created account in afterEach.
  const email = `e2e-inline-${testInfo.testId}-${Date.now()}@test.local`;
  let createdEmail: string | undefined = email;

  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto('/menu');

    const sidebar = page.getByRole('complementary', { name: /shopping basket/i });
    await expect(sidebar).toBeVisible({ timeout: 15_000 });

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
      /* no modal */
    }
    await basketWritePromise;

    await sidebar
      .getByRole('group', { name: /order type/i })
      .getByRole('button', { name: /takeaway/i })
      .click();

    const modal = page.getByRole('dialog', { name: /almost there/i });
    await expect(modal).toBeVisible({ timeout: 10_000 });

    await modal.getByLabel(/full name \*/i).fill('Inline Reg');
    await modal.getByLabel(/^email \*/i).fill(email);
    await modal.getByLabel(/^phone \*/i).fill('+41791234567');

    // Tick the inline-registration checkbox; password fields appear.
    const wantsRegister = modal.getByRole('checkbox', { name: /create my account/i });
    await wantsRegister.check();

    await modal.getByLabel(/^password \*/i).fill('Test123!');
    await modal.getByLabel(/confirm password \*/i).fill('Test123!');

    // Wait for the register-customer call to fire before submitting.
    const registerCallPromise = page.waitForResponse(
      (r) => r.url().includes('/api/User/register/customer') && r.request().method() === 'POST',
      { timeout: 15_000 },
    );
    await modal.getByRole('button', { name: /^(confirm|saving)/i }).click();
    const registerResponse = await registerCallPromise;
    expect(
      registerResponse.ok(),
      `register: ${registerResponse.status()} ${await registerResponse.text()}`,
    ).toBeTruthy();

    await expect(modal).toBeHidden({ timeout: 10_000 });

    await sidebar.getByRole('button', { name: /proceed to checkout/i }).click();
    await expect(page).toHaveURL(/\/checkout\/review$/, { timeout: 10_000 });
  } finally {
    await context.close();
    if (createdEmail) {
      try {
        await deleteUserByEmail(createdEmail);
      } catch (err) {
        console.warn(`[smart-skip-checkout] cleanup failed for ${createdEmail}:`, err);
      } finally {
        createdEmail = undefined;
      }
    }
  }
});
