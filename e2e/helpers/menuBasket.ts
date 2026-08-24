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
    await dismissCookieBanner(page);
    // The banner is not the only thing that parks over this button — see below.
    await dismissToastsOverCartButton(page);
    // The FLOATING cart button is /menu's only cart entry point. A second copy briefly lived in the
    // sticky category bar doing the same job from the other corner; it is gone, and the FAB now
    // renders at EVERY count including zero — which is what makes it a replacement for the rail
    // rather than only a convenience once something is in the basket.
    await page.getByRole('button', { name: /view cart/i }).click();
  }
  await expect(panel).toBeVisible({ timeout: 15_000 });
  return panel;
}

/**
 * Answer the cookie banner, because on `/menu` it sits ON the button this helper has to click.
 *
 * Both are `position: fixed` at the bottom of the viewport, and the banner wins — Playwright's
 * call log is unambiguous about it: *"`<div class="CookieConsentBanner…">` intercepts pointer
 * events"*, 114 retries, then the test times out. Thirteen tests across six suites failed this way
 * at once.
 *
 * **It is not a test-only problem, and the fix here does not pretend otherwise.** A first-time
 * guest on `/menu` also has the banner over their only route to the basket. It stopped being
 * theoretical for two independent reasons on this branch: the sticky-bar basket button was removed
 * (it sat at the TOP, which the banner never covered), and the FAB started rendering at zero items
 * (so it is now under the banner from first paint rather than only after an add).
 * `mobile-cart-sheet.e2e.ts` hit the same wall earlier and solved it privately with an
 * `addInitScript`; that note is still there and is now one of several. Logged for the owner as a
 * real UX question rather than silently absorbed.
 *
 * Clicking Accept rather than pre-seeding storage, deliberately: `addInitScript` has to run before
 * `page.goto`, and this helper is called long after navigation — so a seed here would be a no-op
 * that looked like a fix. Clicking is also what a guest does.
 *
 * **Whether to wait is decided by localStorage, not by looking.** The first cut asked
 * `accept.isVisible({ timeout: 2_000 })` — and `isVisible()` does NOT auto-wait. It answers about
 * the current instant and ignores the `timeout` option entirely, so on any run where the banner had
 * not hydrated yet it returned `false`, the dismiss was skipped, and the click was intercepted a
 * moment later. That is a RACE, and it read as a fix because it genuinely repaired the four tests
 * whose timing happened to land the other way: 13 failures became 9, which looks like progress and
 * is actually the same bug.
 *
 * The consent key is the deterministic answer to "will a banner appear?", so it decides whether to
 * wait for one. Present ⇒ no banner is coming, return immediately and cost nothing. Absent ⇒ one IS
 * coming, so wait for it properly.
 */
export async function dismissCookieBanner(page: Page): Promise<void> {
  const consented = await page
    .evaluate(() => Boolean(window.localStorage.getItem('rumi_cookie_consent')))
    // Not yet on a real origin (localStorage throws on about:blank). Nothing has rendered, so
    // there is no banner either.
    .catch(() => true);
  if (consented) return;

  const accept = page.getByRole('button', { name: /^accept$/i });
  await accept.waitFor({ state: 'visible', timeout: 15_000 });
  await accept.click();
  await expect(accept).toBeHidden({ timeout: 5_000 });
}

/**
 * Clear anything parked over the floating cart button before clicking it.
 *
 * The button is `position: fixed` in the bottom-trailing corner (`FloatingCartButton.module.css`),
 * and so is notistack's bottom-right container — which this app renames
 * `.notistack-anchor-bottom-trailing` (`client-providers.tsx`). 64 of the 89 `enqueueSnackbar` call
 * sites land there by inheriting the provider default, including `useCartFeedback`'s add-FAILURE
 * toast; only the add-SUCCESS one is top-center. A toast in that corner sits ON `/menu`'s only
 * route to the cart for its 4-second life, and Playwright's call log names it exactly:
 * *"`<div id="notistack-snackbar">` … subtree intercepts pointer events"*, retried until the test
 * times out. It failed a docs-only PR, which is how it was finally pinned as environmental rather
 * than caused by a change (frontend #541).
 *
 * Dismissed rather than waited out: a second toast can enqueue while the first is expiring, so
 * "wait 4s" is a race with the app, and every snack carries the provider's own close action, which
 * makes dismissal deterministic. The wait afterwards is the honest assertion — if a toast is still
 * there, the click genuinely cannot land.
 *
 * **This is a real UX overlap, not only a test problem** — a guest whose add just failed gets the
 * explanation printed over the button they would use to fix it. Left as-is deliberately (moving a
 * shared toast anchor is a design decision, not a test fix) and recorded on #541.
 */
export async function dismissToastsOverCartButton(page: Page): Promise<void> {
  const container = page.locator('.notistack-anchor-bottom-trailing');
  const snacks = container.locator('#notistack-snackbar');

  // maxSnack is 3; a couple of extra passes cover one enqueued while we dismiss.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if ((await snacks.count()) === 0) return;
    await container
      .getByRole('button')
      .first()
      .click({ timeout: 2_000 })
      .catch(() => {
        /* it auto-hid between the count and the click — the next pass re-checks. */
      });
  }

  await expect(snacks, 'a toast is still covering the floating cart button').toHaveCount(0, { timeout: 10_000 });
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
