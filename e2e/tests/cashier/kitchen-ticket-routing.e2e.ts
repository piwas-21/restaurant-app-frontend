import type { Page } from '@playwright/test';
import { test, expect } from '../../fixtures/cashierUser';

/**
 * HIGH-tier — kitchen-ticket routing over the ROOT-ONLY order contract (backend #237 / issue #234).
 *
 * Why this is E2E and not a component test: the bug was invisible at every layer in isolation. No
 * DTO field changed, so types still compiled and JSON still parsed; only the MEANING of
 * `OrderDto.items` changed — bundle components moved out of the top level and into their parent's
 * `sideItems`. The failure only appears when a REAL backend response meets the real routing code:
 * a FrontKitchen combo containing BackKitchen fries produced no back-kitchen ticket at all, and
 * printed the fries on the front one instead. The seeded fixture
 * (`e2e/seed/seed.sql` §7, order `E2E-KITCHEN-001`) is exactly that shape.
 *
 * What this asserts, end to end:
 *   1. Both kitchen print buttons appear even though NO top-level item is BackKitchen.
 *   2. The back-kitchen ticket contains the fries and nothing belonging to the front kitchen.
 *   3. The front-kitchen ticket contains the combo + burger and NOT the fries.
 *
 * The ticket is real print HTML: `printHtmlContent` writes it into a hidden iframe, which the spec
 * reads back rather than mocking the template. The one thing stubbed is `window.print`, the OS
 * boundary — per docs/E2E-STRATEGY.md §"Safe boundaries with external systems".
 *
 * a11y: the cashier landing-view scan is owned by `order-flow.e2e.ts`; repeating it here would just
 * re-scan the same shell.
 */

const ORDER_NUMBER = 'E2E-KITCHEN-001';
const COMBO = 'E2E Kitchen Combo';
const FRONT_ITEM = 'E2E Front Burger';
const BACK_ITEM = 'E2E Back Fries';

/**
 * Click a print button and return the HTML that was handed to the printer.
 *
 * `printHtmlContent` appends a fresh hidden iframe and `document.write`s the ticket into it, so the
 * new iframe is identified by index — counted before the click, read after. Polled because the
 * write happens in a React event handler, not synchronously with Playwright's click.
 */
async function capturePrintedTicket(page: Page, buttonName: RegExp): Promise<string> {
  const before = await page.locator('iframe').count();

  await page.getByRole('button', { name: buttonName }).click();

  await expect
    .poll(async () => (await page.locator('iframe').count()) > before, {
      message: 'print iframe was never appended',
    })
    .toBe(true);

  const html = await page.evaluate((index) => {
    const iframe = document.querySelectorAll('iframe')[index] as HTMLIFrameElement | undefined;
    return iframe?.contentDocument?.documentElement?.outerHTML ?? '';
  }, before);

  expect(html, 'printed ticket was empty').not.toBe('');
  return html;
}

test('a bundle spanning two kitchens prints one correct ticket per kitchen', async ({ cashierUser, browser }) => {
  const context = await browser.newContext({ storageState: cashierUser.storageStatePath });
  const page = await context.newPage();

  // Headless Chromium already no-ops window.print(), but a --headed debugging run would block on
  // the OS print dialog forever. Stub it in every frame, including the print iframe.
  await page.addInitScript(() => {
    window.print = () => {};
  });

  try {
    await page.goto('/cashier');
    await expect(page).toHaveURL(/\/cashier(?:\/|$)/, { timeout: 15_000 });

    // The dashboard defaults to a "today only" window computed in the BROWSER's local timezone,
    // which the seeded fixture cannot reason about. Turn it off: the fixture is future-dated, so
    // with no window it sits at the top of the OrderDate-descending page whatever else the suite
    // has created. Unchecking clears the cached rows and refetches.
    await page.getByRole('checkbox', { name: /today/i }).uncheck();

    // Open the seeded mixed-kitchen order. The card is keyed by its order number.
    await page.getByText(ORDER_NUMBER, { exact: true }).click();
    await expect(page.getByRole('heading', { name: /Print Actions/i })).toBeVisible({ timeout: 15_000 });

    // (1) Both buttons. Before the fix the back-kitchen one was absent: no TOP-LEVEL item is
    // BackKitchen, so the old `order.items.some(...)` check returned false.
    const frontButton = page.getByRole('button', { name: /Front Kitchen/i });
    const backButton = page.getByRole('button', { name: /Back Kitchen/i });
    await expect(frontButton).toBeVisible();
    await expect(backButton).toBeVisible();

    // (2) The back kitchen's ticket: its own item, hoisted out of a parent it does not own.
    const backTicket = await capturePrintedTicket(page, /Back Kitchen/i);
    expect(backTicket).toContain('Back Kitchen');
    expect(backTicket).toContain(BACK_ITEM);
    expect(backTicket).not.toContain(COMBO);
    expect(backTicket).not.toContain(FRONT_ITEM);

    // (3) The front kitchen's ticket: the combo with only the component it owns. The fries used to
    // print here, nested under the combo, while the back kitchen got nothing.
    const frontTicket = await capturePrintedTicket(page, /Front Kitchen/i);
    expect(frontTicket).toContain('Front Kitchen');
    expect(frontTicket).toContain(COMBO);
    expect(frontTicket).toContain(FRONT_ITEM);
    expect(frontTicket).not.toContain(BACK_ITEM);

    // Each component appears exactly once on the ticket that owns it — the root-only contract means
    // a child must be nested under its parent, never also listed as a top-level line.
    expect(frontTicket.split(FRONT_ITEM).length - 1).toBe(1);
  } finally {
    await context.close();
  }
});
