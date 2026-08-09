import { expect, type Page } from '@playwright/test';

/**
 * Determinism helpers for the screenshot-baseline suite (S15 T1 close-out).
 * Everything time-, locale- or network-variable is pinned here so that two
 * back-to-back runs produce byte-identical captures.
 */

export type Theme = 'light' | 'dark';
export const THEMES: readonly Theme[] = ['light', 'dark'] as const;

/**
 * Frozen wall clock for every page: a fixed future Wednesday, mid-day UTC.
 * Pins the footer copyright year, the reservations default date and any
 * client-side "past time slot" filtering. Future-dated so reservation
 * date validation never trips as real time advances.
 */
export const FIXED_TIME = new Date('2026-08-12T10:00:00.000Z');

/**
 * Must run BEFORE the first page.goto():
 * - freezes Date/Date.now (timers keep running — setFixedTime, not install)
 * - pre-seeds localStorage: theme (ThemeContext reads `rumiTheme` and stamps
 *   html[data-theme]), i18n language, accepted cookie consent (banner off)
 * - neutralises external Google endpoints (Maps embed iframe, GSI login
 *   button script) — they are network-nondeterministic and not ours to test.
 */
export async function prepareForScreenshots(page: Page, theme: Theme): Promise<void> {
  await page.clock.setFixedTime(FIXED_TIME);

  await page.addInitScript((selectedTheme) => {
    localStorage.setItem('rumiTheme', selectedTheme);
    localStorage.setItem('i18nextLng', 'en');
    localStorage.setItem('rumi_cookie_consent', JSON.stringify({ preferences: true }));
  }, theme);

  // Google Maps embed (home page): answer with an empty document so the
  // iframe region renders as a consistent blank instead of live map tiles.
  await page.route('**://www.google.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }),
  );
  // Google Identity Services (login/register social button) + static assets:
  // abort so the GoogleLogin container stays deterministically empty.
  for (const pattern of ['**://accounts.google.com/**', '**://*.gstatic.com/**', '**://*.googleapis.com/**']) {
    await page.route(pattern, (route) => route.abort());
  }
}

/**
 * Wait until the page is visually settled: theme attribute stamped by
 * ThemeContext (a post-hydration effect), network idle, a scroll-through to
 * force every `loading="lazy"` image to actually load (fullPage captures
 * don't scroll, so an unforced lazy image would stay a permanent blank —
 * and on narrow viewports the load event never fires, hanging an unbounded
 * wait), web fonts loaded, and every <img> decoded. The per-image wait is
 * bounded: a permanently stuck image then shows up as a visible diff
 * instead of a test timeout.
 */
export async function waitForStablePage(page: Page, theme: Theme): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await page.waitForLoadState('networkidle');
  // Scroll through the document in viewport steps, then back to the top.
  // globals.css makes `html, body { height: 100% }`, so depending on the
  // page the effective scroller can be the window OR the body element —
  // drive both so `loading="lazy"` content actually enters the scrollport.
  await page.evaluate(async () => {
    const scrollers = [document.scrollingElement, document.body].filter(
      (el): el is Element => el !== null && el !== undefined,
    );
    const total = Math.max(...scrollers.map((el) => el.scrollHeight));
    const step = window.innerHeight;
    for (let y = 0; y <= total; y += step) {
      window.scrollTo(0, y);
      for (const el of scrollers) el.scrollTop = y;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    window.scrollTo(0, 0);
    for (const el of scrollers) el.scrollTop = 0;
  });
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() =>
    Promise.all(
      Array.from(document.images)
        .filter((img) => !img.complete)
        .map(
          (img) =>
            new Promise((resolve) => {
              img.addEventListener('load', resolve, { once: true });
              img.addEventListener('error', resolve, { once: true });
              setTimeout(resolve, 10_000);
            }),
        ),
    ),
  );
  await page.evaluate(() => window.scrollTo(0, 0));
}

export async function gotoStable(page: Page, path: string, theme: Theme): Promise<void> {
  await page.goto(path);
  await waitForStablePage(page, theme);
}

/**
 * Drive the guest smart-skip flow to a populated /checkout/review — the
 * checkout entry surface. /checkout/order-type is a legacy redirect and
 * /checkout/review redirects away unless cart + orderType + customerInfo
 * exist, so the state is built through the UI exactly like
 * e2e/tests/customer/smart-skip-checkout.e2e.ts (guest path). All inputs are
 * fixed values; the cart holds 1× the seeded "E2E Test Product".
 *
 * Driven at desktop size because that is the width the baselines are cut at for the desktop
 * project; the caller restores the project viewport before capturing.
 *
 * The basket is a SLIDE-OVER now, not a permanently-pinned `<aside>` rail — /menu dropped the rail
 * so the card grid could have the design's three columns back. So this opens it from the basket
 * button in the sticky category bar and drives the same `CartContents` inside it: the order-type
 * toggle and Proceed to Checkout are the very same controls, one click further in.
 */
export async function driveGuestCheckoutToReview(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/menu');

  // Scoped to the GRID. The seeded product is also the featured special, and the hero's add control
  // now carries the same item-specific accessible name the card's does — deliberately, so a screen
  // reader hears which dish each button adds. Unscoped, this is a strict-mode violation resolving
  // to two elements (it was: the hero used to say a generic "Add to Order"). The same warning is
  // already written on `data-testid="menu-grid"` in MenuContent.tsx.
  const grid = page.getByTestId('menu-grid');
  const seededAddButton = grid.getByRole('button', { name: /^Add E2E Test Product to order$/i });
  await expect(seededAddButton).toBeVisible({ timeout: 15_000 });

  const basketWritePromise = page.waitForResponse(
    (r) => r.url().includes('/api/Basket') && ['POST', 'PUT'].includes(r.request().method()),
    { timeout: 10_000 },
  );
  await seededAddButton.click();
  try {
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /^Add( .+)? to order$/i })
      .click({ timeout: 3_000 });
  } catch {
    /* no customization modal — direct add */
  }
  await basketWritePromise;

  // Open the slide-over. It renders at every count, including zero, which is what makes it a
  // replacement for the rail rather than for the floating cart button.
  await page.getByRole('button', { name: /open basket/i }).click();
  const basket = page.getByRole('dialog', { name: /shopping basket/i });
  await expect(basket).toBeVisible({ timeout: 10_000 });

  await basket
    .getByRole('group', { name: /order type/i })
    .getByRole('button', { name: /takeaway/i })
    .click();

  const modal = page.getByRole('dialog', { name: /almost there/i });
  await expect(modal).toBeVisible({ timeout: 10_000 });
  await modal.getByLabel(/full name \*/i).fill('Screenshot Baseline');
  await modal.getByLabel(/^email \*/i).fill('e2e-screenshot-baseline@test.local');
  await modal.getByLabel(/^phone \*/i).fill('+41791234567');
  await modal.getByRole('button', { name: /^confirm$/i }).click();
  await expect(modal).toBeHidden({ timeout: 5_000 });

  await basket.getByRole('button', { name: /proceed to checkout/i }).click();
  await expect(page).toHaveURL(/\/checkout\/review$/, { timeout: 10_000 });
}
