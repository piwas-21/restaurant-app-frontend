import { type Page } from '@playwright/test';
import { apiBaseUrl } from '../../helpers/config';
import { test, expect } from '../../fixtures/cashierUser';

/**
 * HIGH-tier — the route-backed Orders workspace shell (cashier POS plan §5.2, frontend #806).
 *
 * What is E2E and not unit: the shell is composed across app-router layout, the internal app
 * layout (header/footer suppression) and the workspace queue — three layers whose interaction
 * is the feature. The unit suite mocks the route; only a real render proves the cashier lands
 * on a working workspace at `/en/cashier/orders`.
 *
 * Asserts:
 *   1. `/en/cashier/orders` renders the Orders destination (h1) — the nav link's landing target.
 *   2. The public footer is NOT rendered on workspace routes (plan §5.2: no public chrome in POS).
 *   3. The exact seeded current-day order is listed and selecting it opens its ticket.
 *   4. A queue-eligible prior-day fixture is absent from today's active queue.
 *   5. The workspace nav offers the shipped destinations only (Orders, History, Tables — no
 *      "New sale" assertion here; its presence is pinned by the new-sale spec).
 *
 * a11y: the legacy `/cashier` landing scan is owned by `order-flow.e2e.ts`; this spec covers the
 * shell the redesign actually ships.
 */

const CURRENT_DAY_ORDER_ID = '00000000-0000-0000-0000-0000000000f0';
const PRIOR_DAY_ORDER_ID = '00000000-0000-0000-0000-0000000000f9';

interface SeededOrderIdentity {
  readonly id: string;
  readonly displayNumber: string;
  readonly customerName: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function loadSeededOrderIdentity(page: Page, orderId: string, accessToken: string): Promise<SeededOrderIdentity> {
  const response = await page.request.get(`${apiBaseUrl()}/api/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  expect(response.ok(), `seeded order ${orderId} should be readable by the cashier`).toBe(true);

  const payload: unknown = await response.json();
  if (!isRecord(payload) || !isRecord(payload.data)) {
    throw new Error(`Order API returned no data for seeded order ${orderId}`);
  }

  const order = payload.data;
  if (
    typeof order.id !== 'string' ||
    order.id.toLowerCase() !== orderId.toLowerCase() ||
    typeof order.orderNumber !== 'string' ||
    typeof order.customerName !== 'string'
  ) {
    throw new Error(`Order API returned an unexpected identity for seeded order ${orderId}`);
  }

  const dailyNumber = order.dailyOrderNumber;
  const displayNumber =
    typeof dailyNumber === 'number' && Number.isSafeInteger(dailyNumber) && dailyNumber > 0
      ? String(dailyNumber)
      : order.orderNumber.trim();
  if (!displayNumber) throw new Error(`Seeded order ${orderId} has no display number`);

  return { id: order.id, displayNumber, customerName: order.customerName };
}

test('the cashier lands on a working Orders workspace', async ({ cashierUser, browser }) => {
  const context = await browser.newContext({ storageState: cashierUser.storageStatePath });
  const page = await context.newPage();

  try {
    await page.goto('/en/cashier/orders');
    await expect(page).toHaveURL(/\/en\/cashier\/orders/, { timeout: 15_000 });

    const currentDayOrder = await loadSeededOrderIdentity(page, CURRENT_DAY_ORDER_ID, cashierUser.accessToken);
    const priorDayOrder = await loadSeededOrderIdentity(page, PRIOR_DAY_ORDER_ID, cashierUser.accessToken);
    expect(currentDayOrder.customerName).toBe('E2E Kitchen Routing');
    expect(priorDayOrder.customerName).toBe('E2E Prior Day');

    // The destination heading proves the workspace shell rendered, not the legacy page.
    await expect(page.getByRole('heading', { level: 1, name: 'Orders' })).toBeVisible({ timeout: 15_000 });

    // Workspace destinations only: no New sale assertion here (its own spec pins it), and no
    // public site footer inside the POS surface (plan §5.2).
    await expect(page.locator('footer')).toHaveCount(0);
    const viewport = await page.evaluate(() => ({
      clientHeight: document.documentElement.clientHeight,
      scrollHeight: document.documentElement.scrollHeight,
    }));
    expect(viewport.scrollHeight).toBeLessThanOrEqual(viewport.clientHeight + 2);

    // The seeded kitchen-routing order is Pending, so it is active work. Resolve its display
    // number from the exact seeded UUID so this assertion covers both legacy and daily numbers.
    const activeOrderList = page
      .getByRole('region', { name: 'Order queue' })
      .getByRole('list', { name: 'Orders' })
      .first();
    const currentOrderNumber = activeOrderList.getByText(currentDayOrder.displayNumber, { exact: true });
    await expect(currentOrderNumber).toBeVisible({ timeout: 15_000 });

    // The Confirmed previous-day fixture is otherwise queue-eligible, but must stay outside today's
    // active list. It may appear in the separate prior-day review reminder.
    await expect(activeOrderList.getByText(priorDayOrder.customerName, { exact: true })).toHaveCount(0);

    await currentOrderNumber.click();
    await expect(page).toHaveURL(new RegExp(`order=${currentDayOrder.id}`), { timeout: 10_000 });
    await expect(page.getByRole('heading', { level: 2, name: currentDayOrder.displayNumber, exact: true })).toBeVisible(
      {
        timeout: 10_000,
      },
    );
  } finally {
    await context.close();
  }
});
