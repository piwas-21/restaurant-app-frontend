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
 * main content area). Then two a11y scans, both with the seeded order
 * on screen: one on the list, one with the order selected so
 * OrderDetails is covered too — the landing view alone never renders
 * it, and with "today only" left on it renders no orders at all.
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

/** The seed.sql mixed-kitchen fixture order — same row kitchen-ticket-routing.e2e.ts drives. */
const ORDER_NUMBER = 'E2E-KITCHEN-001';

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

    // The dashboard defaults to a "today only" window (useTodayOnlyDateRange starts true, and
    // nothing seeds `cashier:todayOnly` into the fixture's storage state), while the seeded order
    // is deliberately future-dated to pin it to the top of the OrderDate-descending page — see the
    // rationale in e2e/seed/seed.sql. So the landing list is EMPTY until this is switched off,
    // exactly as kitchen-ticket-routing.e2e.ts does it. Unchecking clears the cached rows and
    // refetches.
    await page.getByRole('checkbox', { name: /today/i }).uncheck();

    // Wait for the refetched row before scanning — otherwise both scans below race the fetch and
    // silently cover an empty list, which is the failure mode this whole test is guarding against.
    await expect(page.getByText(ORDER_NUMBER, { exact: true })).toBeVisible({ timeout: 15_000 });

    // a11y scan on the dashboard landing. Scans the WHOLE page — no exclusions.
    //
    // This runs with the kitchen-routing fixture's order on screen, so it covers the OrderList
    // order-status badge, whose fill/label pair used to fail WCAG AA (Pending was 1.66:1) and was
    // excluded here until the badge got its own AA-checked --badge-status-*-bg tokens.
    await expectNoA11yViolations(page);

    // Second scan, with an order SELECTED.
    //
    // The landing scan above cannot see OrderDetails: `selectedOrderId` starts null and nothing
    // auto-selects (src/hooks/cashier/useCashierDialogs.ts), so the right-hand pane renders the
    // "select an order" placeholder instead. That blind spot is exactly how the OrderDetails
    // status badge kept its own copy of the WCAG AA contrast failure after the OrderList badge
    // next to it was fixed — the two badges are separate components with separate stylesheets,
    // and only one of them was ever on screen during a scan.
    //
    // The seeded order is Pending, which was the worst of the six (white on #fbbf24 = 1.66:1
    // against a 4.5:1 requirement), so this covers the regression that mattered most.
    await page.getByText(ORDER_NUMBER, { exact: true }).click();

    // OrderDetails' header is an h2 carrying the order number — its presence is what proves the
    // pane swapped from the placeholder to the real component, and therefore that the badge is
    // in the scan below rather than silently absent again.
    await expect(page.getByRole('heading', { level: 2, name: new RegExp(ORDER_NUMBER) })).toBeVisible({
      timeout: 10_000,
    });

    await expectNoA11yViolations(page);
  } finally {
    await context.close();
  }
});
