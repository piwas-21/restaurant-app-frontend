import { test, expect } from '@playwright/test';

/**
 * HIGH-tier — first-time visitor sees the order-type welcome modal on
 * /menu, choice persists across reloads, returning visitor sees no
 * modal. C1.5.a acceptance criteria from BUGS-IMPROVEMENTS-PLAN.
 */

const STORAGE_KEY = 'rumi_order_type_state';

test('first-time visitor sees the order-type welcome modal and the choice persists', async ({ page }) => {
  // Fresh browser context — Playwright gives us this per-test by default,
  // so localStorage starts empty. No seeding needed for this test.
  await page.goto('/menu');

  // Modal opens after hydration. The dialog has aria-modal="true" and is
  // labelled by its title heading.
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await expect(dialog.getByRole('heading', { name: /how would you like to order/i })).toBeVisible();

  // Picking Takeaway dismisses the modal and persists to localStorage.
  // Button's accessible name is `<label> <description>` (e.g. "Takeaway Pick up
  // your order"), so anchor to the start of the string rather than expecting
  // an exact match.
  await dialog.getByRole('button', { name: /^Takeaway/i }).click();
  await expect(dialog).toBeHidden();

  const stored = await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY);
  expect(stored).toBeTruthy();
  const parsed = JSON.parse(stored as string) as { orderType: string };
  expect(parsed.orderType).toBe('Takeaway');

  // Reload — the modal must NOT come back (the choice is persistent).
  await page.reload();
  await expect(page.getByRole('button', { name: /^Add( .+)? to order$/i }).first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole('dialog')).toBeHidden();
});
