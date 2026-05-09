import { test, expect } from '../../fixtures/cashierUser';
import { expectNoA11yViolations } from '../../helpers/a11y';

/**
 * HIGH-tier — cashier dashboard end-to-end.
 *
 * Strategy: docs/E2E-STRATEGY.md §HIGH:
 *   "Cashier flow: log in as cashier → see incoming order → update
 *    status → mark paid"
 *
 * Scope of this PR: assert the cashier can authenticate and reach
 * /cashier with the dashboard rendered (header, order-type nav,
 * main content area). a11y scan on the landing view.
 *
 * Out of scope (deferred to a follow-up PR):
 *   - Seeding an in-flight order via the public ordering flow OR a
 *     direct API call, then asserting the cashier sees it appear via
 *     the SSE event stream (/api/events/kitchen). The seed step needs
 *     either (a) a guest-order seeding helper in e2e/seed/ or
 *     (b) a fixture that opens a public browser context first to drive
 *     the guest-checkout flow. Both are larger than this PR.
 *   - Status transitions (Pending → Preparing → Ready → Completed)
 *     and Mark Paid — those exercise the cashier action dialogs and
 *     need the seeded-order pre-condition.
 *
 * Cleanup: cashierUser fixture's afterEach deletes the staff user.
 */

test('cashier logs in and reaches the cashier dashboard', async ({ cashierUser, browser }) => {
  const context = await browser.newContext({
    storageState: cashierUser.storageStatePath,
  });
  const page = await context.newPage();
  try {
    await page.goto('/cashier');

    // /cashier is RequireRole=Cashier (CashierLayout). If auth fails the
    // page would redirect to /auth/login; assert we stay on /cashier.
    await expect(page).toHaveURL(/\/cashier(?:\/|$)/, { timeout: 15_000 });

    // Dashboard skeleton should render — the main content area has its
    // own role landmark via CashierMainContent's <main> wrapper.
    // Header carries an h1 with the cashier-page title.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({
      timeout: 15_000,
    });

    // Order-type nav (CashierOrderTypeNav) is the dashboard's primary
    // filter and is always present even when there are no orders. Use a
    // permissive role match — the nav uses tabs/buttons depending on
    // breakpoint.
    await expect(page.getByRole('navigation').or(page.getByRole('tablist')).first()).toBeVisible({ timeout: 10_000 });

    // a11y scan on the dashboard landing.
    await expectNoA11yViolations(page);
  } finally {
    await context.close();
  }
});
