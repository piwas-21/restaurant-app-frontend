import { test, expect } from '@playwright/test';

/**
 * HIGH-tier — C1.5.b acceptance: the welcome modal triggers the right
 * follow-up modal based on the chosen type, all without leaving /menu.
 *
 * Scope: tests verify the modal-flow handoff (welcome → follow-up open
 * with correct title). The internal table-pick / address-fill flows
 * delegate to existing components (TableSelector + DeliveryAddressSection)
 * that have their own production usage outside this MR; testing their
 * internals belongs in component-level tests, not here.
 */

test('dine-in: welcome → pick DineIn → table-selection modal opens', async ({ page }) => {
  await page.goto('/menu');

  const welcome = page.getByRole('dialog', { name: /how would you like to order/i });
  await expect(welcome).toBeVisible({ timeout: 15_000 });

  await welcome.getByRole('button', { name: /^Dine In/i }).click();
  await expect(welcome).toBeHidden();

  // Welcome closed; the dine-in follow-up opens immediately.
  const tableModal = page.getByRole('dialog', { name: /select your table/i });
  await expect(tableModal).toBeVisible({ timeout: 15_000 });

  // Sticky header on /menu now shows DineIn (welcome modal's own click
  // handler called setOrderType before triggering the follow-up).
  const region = page.getByRole('region', { name: /order type/i });
  await expect(region.getByText(/Dine In/i)).toBeVisible();
});

test('delivery: welcome → pick Delivery → address modal opens', async ({ page }) => {
  await page.goto('/menu');

  const welcome = page.getByRole('dialog', { name: /how would you like to order/i });
  await expect(welcome).toBeVisible({ timeout: 15_000 });

  await welcome.getByRole('button', { name: /^Delivery/i }).click();
  await expect(welcome).toBeHidden();

  const addressModal = page.getByRole('dialog', { name: /where should we deliver/i });
  await expect(addressModal).toBeVisible({ timeout: 15_000 });

  const region = page.getByRole('region', { name: /order type/i });
  await expect(region.getByText(/Delivery/i)).toBeVisible();
});

test('takeaway: welcome → pick Takeaway → no follow-up modal opens', async ({ page }) => {
  await page.goto('/menu');

  const welcome = page.getByRole('dialog', { name: /how would you like to order/i });
  await expect(welcome).toBeVisible({ timeout: 15_000 });

  await welcome.getByRole('button', { name: /^Takeaway/i }).click();
  await expect(welcome).toBeHidden();

  // No dialog should be open. role="dialog" returns nothing visible.
  await expect(page.getByRole('dialog')).toBeHidden();

  // Sticky header shows Takeaway with no detail row.
  const region = page.getByRole('region', { name: /order type/i });
  await expect(region.getByText(/Takeaway/i)).toBeVisible();
});
