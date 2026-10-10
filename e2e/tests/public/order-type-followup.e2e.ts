import { test, expect, type Page, type Locator } from '@playwright/test';
import { menuBasketPanel, openMenuBasket } from '../../helpers/menuBasket';

/** Channel selection yields the basket to details. Cancellation restores the same channel. */
async function expectCancelRestoresBasket(page: Page, details: Locator, channel: RegExp) {
  await expect(menuBasketPanel(page)).toBeHidden();
  await details.getByRole('button', { name: /^cancel$/i }).click();
  const basket = menuBasketPanel(page);
  await expect(basket).toBeVisible();
  await expect(basket.getByRole('button', { name: channel, pressed: true })).toBeVisible();
  await expect(page).toHaveURL(/\/en\/menu$/);
}

test('dine-in: sidebar toggle → DineIn → table-selection modal opens', async ({ page }) => {
  await page.goto('/en/menu');

  // No welcome modal; the sidebar's order-type toggle is the entry point.
  await expect(page.getByRole('dialog')).toBeHidden();

  const aside = await openMenuBasket(page);

  // The toggle exposes a role="group" with aria-label="Order type".
  const toggle = aside.getByRole('group', { name: /order type/i });
  await toggle.getByRole('button', { name: /dine in/i }).click();

  const tableModal = page.getByRole('dialog', { name: /select your table/i });
  await expect(tableModal).toBeVisible({ timeout: 15_000 });

  await expectCancelRestoresBasket(page, tableModal, /dine in/i);
});

test('delivery: sidebar toggle → Delivery → address modal opens', async ({ page }) => {
  await page.goto('/en/menu');

  const aside = await openMenuBasket(page);

  const toggle = aside.getByRole('group', { name: /order type/i });
  await toggle.getByRole('button', { name: /delivery/i }).click();

  const addressModal = page.getByRole('dialog', { name: /where should we deliver/i });
  await expect(addressModal).toBeVisible({ timeout: 15_000 });

  await expectCancelRestoresBasket(page, addressModal, /delivery/i);
});

test('takeaway: sidebar toggle → Takeaway → guest info modal opens', async ({ page }) => {
  await page.goto('/en/menu');

  const aside = await openMenuBasket(page);

  const toggle = aside.getByRole('group', { name: /order type/i });
  await toggle.getByRole('button', { name: /takeaway/i }).click();

  // Default Playwright context is unauthenticated — the §C1.5.e takeaway
  // info modal opens to collect name + email + phone before we let the
  // guest reach checkout. Logged-in-with-complete-profile users skip this
  // modal entirely; covered in customer/smart-skip-checkout.e2e.ts.
  const takeawayModal = page.getByRole('dialog', { name: /almost there/i });
  await expect(takeawayModal).toBeVisible({ timeout: 15_000 });
  await expectCancelRestoresBasket(page, takeawayModal, /takeaway/i);
});
