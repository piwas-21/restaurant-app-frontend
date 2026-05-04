import { test, expect } from '@playwright/test';

/**
 * HIGH-tier — C1.5.c acceptance: the user picks order type via the
 * sidebar toggle on /menu (no welcome modal anymore). DineIn opens the
 * table modal, Delivery opens the address modal, Takeaway commits with
 * no follow-up. All without leaving /menu.
 *
 * Tests verify the toggle-click → right follow-up handoff. They do NOT
 * exercise the inner table-pick / address-fill flows — those belong in
 * component-level tests for TableSelector + DeliveryAddressSection.
 *
 * Sidebar is desktop-only (hidden under 1024px). Playwright's default
 * viewport is 1280×720 so the sidebar renders by default.
 */

test('dine-in: sidebar toggle → DineIn → table-selection modal opens', async ({ page }) => {
  await page.goto('/menu');

  // No welcome modal; the sidebar's order-type toggle is the entry point.
  await expect(page.getByRole('dialog')).toBeHidden();

  const aside = page.getByRole('complementary', { name: /shopping basket/i });
  await expect(aside).toBeVisible({ timeout: 15_000 });

  // The toggle exposes a role="group" with aria-label="Order type".
  const toggle = aside.getByRole('group', { name: /order type/i });
  await toggle.getByRole('button', { name: /dine in/i }).click();

  const tableModal = page.getByRole('dialog', { name: /select your table/i });
  await expect(tableModal).toBeVisible({ timeout: 15_000 });

  // Toggle's active state reflects the chosen type.
  await expect(toggle.getByRole('button', { name: /dine in/i, pressed: true })).toBeVisible();
});

test('delivery: sidebar toggle → Delivery → address modal opens', async ({ page }) => {
  await page.goto('/menu');

  const aside = page.getByRole('complementary', { name: /shopping basket/i });
  await expect(aside).toBeVisible({ timeout: 15_000 });

  const toggle = aside.getByRole('group', { name: /order type/i });
  await toggle.getByRole('button', { name: /delivery/i }).click();

  const addressModal = page.getByRole('dialog', { name: /where should we deliver/i });
  await expect(addressModal).toBeVisible({ timeout: 15_000 });

  await expect(toggle.getByRole('button', { name: /delivery/i, pressed: true })).toBeVisible();
});

test('takeaway: sidebar toggle → Takeaway → guest info modal opens', async ({ page }) => {
  await page.goto('/menu');

  const aside = page.getByRole('complementary', { name: /shopping basket/i });
  await expect(aside).toBeVisible({ timeout: 15_000 });

  const toggle = aside.getByRole('group', { name: /order type/i });
  await toggle.getByRole('button', { name: /takeaway/i }).click();

  // Default Playwright context is unauthenticated — the §C1.5.e takeaway
  // info modal opens to collect name + email + phone before we let the
  // guest reach checkout. Logged-in-with-complete-profile users skip this
  // modal entirely; covered in customer/smart-skip-checkout.e2e.ts.
  const takeawayModal = page.getByRole('dialog', { name: /almost there/i });
  await expect(takeawayModal).toBeVisible({ timeout: 15_000 });
  await expect(toggle.getByRole('button', { name: /takeaway/i, pressed: true })).toBeVisible();
});
