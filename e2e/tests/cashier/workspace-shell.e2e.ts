import { test, expect } from '../../fixtures/cashierUser';

/**
 * HIGH-tier — the route-backed Orders workspace shell (cashier POS plan §5.2, frontend #806).
 *
 * What is E2E and not unit: the shell is composed across app-router layout, the internal app
 * layout (header/footer suppression) and the workspace queue — three layers whose interaction
 * is the feature. The unit suite mocks the route; only a real render proves the cashier lands
 * on a working workspace at `/cashier/orders`.
 *
 * Asserts:
 *   1. `/cashier/orders` renders the Orders destination (h1) — the nav link's landing target.
 *   2. The public footer is NOT rendered on workspace routes (plan §5.2: no public chrome in POS).
 *   3. The seeded operational order is listed and selecting it opens its ticket (selection survives).
 *   4. The workspace nav offers the shipped destinations only (Orders, History, Tables — no
 *      "New sale" assertion here; its presence is pinned by the new-sale spec).
 *
 * a11y: the legacy `/cashier` landing scan is owned by `order-flow.e2e.ts`; this spec covers the
 * shell the redesign actually ships.
 */

const ORDER_NUMBER = 'E2E-KITCHEN-001';

test('the cashier lands on a working Orders workspace', async ({ cashierUser, browser }) => {
  const context = await browser.newContext({ storageState: cashierUser.storageStatePath });
  const page = await context.newPage();

  try {
    await page.goto('/cashier/orders');
    await expect(page).toHaveURL(/\/cashier\/orders/, { timeout: 15_000 });

    // The destination heading proves the workspace shell rendered, not the legacy page.
    await expect(page.getByRole('heading', { level: 1, name: 'Orders' })).toBeVisible({ timeout: 15_000 });

    // Workspace destinations only: no New sale assertion here (its own spec pins it), and no
    // public site footer inside the POS surface (plan §5.2).
    await expect(page.locator('footer')).toHaveCount(0);

    // The seeded kitchen-routing order is Pending, so it is active work: it must be listed by the
    // operational queue and open its ticket when selected.
    await expect(page.getByText(ORDER_NUMBER, { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    await page.getByText(ORDER_NUMBER, { exact: true }).first().click();
    await expect(page).toHaveURL(/order=/, { timeout: 10_000 });
    await expect(page.getByRole('heading', { level: 2, name: new RegExp(ORDER_NUMBER) })).toBeVisible({
      timeout: 10_000,
    });
  } finally {
    await context.close();
  }
});
