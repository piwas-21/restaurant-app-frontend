import { expect, type Locator, type Page } from '@playwright/test';

/**
 * The basket on `/menu`, and the one place that knows how to reach it.
 *
 * It was a permanently-pinned `<aside>` rail, and SIX suites each inlined
 * `getByRole('complementary', { name: /shopping basket/i })` to get at the order-type toggle and
 * Proceed to Checkout inside it. When the rail became a slide-over — /menu needed its width back
 * for the card grid the design draws — all six broke at once, which is the cost of having had no
 * helper. This is that helper, and it has already earned itself: the entry point moved a second
 * time (sticky-bar button → floating cart button) and only this file changed.
 *
 * Note for the next person: the panel is a MODAL. Anything behind it (a dish card, the category
 * tabs) is unreachable while it is open, so a flow that picks a channel and then adds an item has
 * to `closeMenuBasket` in between. That is a real change in what the page affords, not a test
 * detail — the rail let a guest do both at once.
 */

/** Whichever surface currently holds the cart: the slide-over on `/menu`. */
export function menuBasketPanel(page: Page): Locator {
  return page.getByRole('dialog', { name: /shopping basket/i });
}

/**
 * Open the basket and return its panel, ready to act on.
 *
 * Idempotent: opening an already-open basket is a no-op rather than a click on a button the
 * backdrop has swallowed.
 */
export async function openMenuBasket(page: Page): Promise<Locator> {
  const panel = menuBasketPanel(page);
  if (!(await panel.isVisible().catch(() => false))) {
    // The FLOATING cart button is /menu's only cart entry point. A second copy briefly lived in the
    // sticky category bar doing the same job from the other corner; it is gone, and the FAB now
    // renders at EVERY count including zero — which is what makes it a replacement for the rail
    // rather than only a convenience once something is in the basket.
    await page.getByRole('button', { name: /view cart/i }).click();
  }
  await expect(panel).toBeVisible({ timeout: 15_000 });
  return panel;
}

/** Close it again, so the grid behind it is clickable. */
export async function closeMenuBasket(page: Page): Promise<void> {
  const panel = menuBasketPanel(page);
  if (await panel.isVisible().catch(() => false)) {
    await panel.getByRole('button', { name: /close/i }).click();
    await expect(panel).toBeHidden({ timeout: 10_000 });
  }
}

/**
 * Pick an order type from the basket's toggle, leaving the basket OPEN.
 *
 * Every caller wants the follow-up modal that a pick raises (table / address / contact), so this
 * deliberately does not wait for it — the caller asserts on the one it expects.
 */
export async function pickOrderTypeInBasket(page: Page, label: RegExp): Promise<Locator> {
  const panel = await openMenuBasket(page);
  const toggle = panel.getByRole('group', { name: /order type/i });
  await toggle.getByRole('button', { name: label }).click();
  return toggle;
}
