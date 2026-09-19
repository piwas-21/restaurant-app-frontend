import { test, expect } from '../../fixtures/cashierUser';

/**
 * HIGH-tier — the S8 walk-up counter sale end to end (cashier POS plan §5.3, frontend #807):
 * tap a simple seeded product, review, create once, land on the focused collection route.
 *
 * Why E2E: the slice's promise is the ORDER of operations across three server conversations —
 * resolve channel (tenant-enabled), QUOTE so the server price is the authority, CREATE exactly
 * once under a client operation id — plus the handoff to `/cashier/collection?order=`. Unit
 * suites pin each piece with mocked services; only a real backend response chain proves the
 * payload shape the staff-order validator accepts and that the created order is actually
 * collectible.
 *
 * Seed: `E2E Test Product` (€/CHF 15.00, no variations/ingredient rules → tap adds directly,
 * no customization sheet). Currency formatting is tenant-built, so amounts assert on the
 * digits, not the symbol.
 */

const PRODUCT = 'E2E Test Product';

test('a walk-up counter sale creates one collectible order', async ({ cashierUser, browser }) => {
  const context = await browser.newContext({ storageState: cashierUser.storageStatePath });
  const page = await context.newPage();

  try {
    await page.goto('/cashier/new');
    await expect(page.getByRole('heading', { level: 1, name: 'New sale' })).toBeVisible({ timeout: 15_000 });

    // The channel bar is a single-choice group with exactly one default selected (tenant default).
    const checked = page.getByRole('radio', { checked: true });
    await expect(checked).toHaveCount(1);

    // Tap the simple seeded product: it lands on the ticket without opening the sheet.
    await page
      .getByRole('button', { name: new RegExp(PRODUCT) })
      .first()
      .click();
    const ticket = page.getByRole('region', { name: 'Current ticket' });
    await expect(ticket.getByText(PRODUCT)).toBeVisible({ timeout: 10_000 });
    // The amount shows twice (line price and total row): the first match is enough here.
    await expect(ticket.getByText(/15[.,]00/).first()).toBeVisible();

    // Order notes ride the draft into the created order.
    await page.getByLabel('Order notes').fill('E2E counter order');

    // Review & collect: quote -> create-once -> collection route for the created order.
    await page.getByRole('button', { name: 'Review & collect' }).click();
    await expect(page).toHaveURL(/\/cashier\/collection\?order=/, { timeout: 20_000 });
    await expect(page.getByText(/15[.,]00/).first()).toBeVisible({ timeout: 15_000 });

    // The draft was consumed by the commit: a fresh New sale starts empty.
    await page.goto('/cashier/new');
    await expect(page.getByText('The ticket is empty. Tap a product to add it.')).toBeVisible({
      timeout: 10_000,
    });
  } finally {
    await context.close();
  }
});
