import { expect, type Page } from '@playwright/test';
import { openMenuBasket } from '../helpers/menuBasket';

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

  // The reservation date strip is built from the day the RESTAURANT is on, which the browser asks
  // the backend for (#517) — and that backend's clock is the real one, not this frozen page clock,
  // so without this stub `/reservations` would capture today's real dates and the baseline would
  // rot every midnight. Pinned to the same instant the page clock is frozen at, so the strip reads
  // exactly as it did when the day came from `new Date()`.
  await page.route('**/api/tenant/today', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { date: FIXED_TIME.toISOString().slice(0, 10), timeZone: 'Europe/Zurich' },
      }),
    }),
  );

  // Online-payment availability, pinned for the same reason as `/api/tenant/today`.
  //
  // `useOnlinePaymentAvailability` starts at `false` and flips to `true` only when
  // `GET /api/payments/availability` resolves, so whether the checkout page shows the
  // "Online Payment" tile is a RACE against the capture. The two committed baselines already
  // recorded opposite answers for the same page and theme — desktop with the tile (6 tiles),
  // mobile without it (5) — which is the proof that this was never deterministic and that a
  // green run only meant the race had been won that time.
  //
  // Stubbed `true`, not `false`: it renders MORE UI, and a baseline that omits a payment tile
  // can never regress on it. It is also the state a tenant that bought the payments module is
  // actually in.
  await page.route('**/api/payments/availability', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { available: true } }),
    }),
  );

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
 * wait), web fonts loaded, and every RENDERED <img> decoded. The per-image
 * wait is bounded: a permanently stuck image then shows up as a visible diff
 * instead of a test timeout. Images with no client rect are skipped — see the
 * filter below for why that is a 10s-per-mobile-case saving and not a
 * relaxation.
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
        // Only images that actually OCCUPY A BOX can contribute a pixel to the capture. An image
        // with no client rect is `display: none` (or in a `display: none` ancestor) — Chromium
        // never even starts its `loading="lazy"` fetch, so `complete` stays false and neither
        // `load` nor `error` ever fires. Measured on the mobile project: the header's
        // LanguageSwitcher flag lives in the closed mobile drawer (`.navLinksContainer` is
        // `display: none` below 768px), so EVERY mobile case burned the full 10s fallback below
        // — ~11.2s per case vs ~2s for the identical desktop case. Excluding boxless images
        // removes that dead wait without relaxing anything: a boxless image is not rendered, so
        // it cannot change a single pixel of the PNG.
        .filter((img) => !img.complete && img.getClientRects().length > 0)
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

  // Scoped to a CARD, not to the grid: the hero is a cell OF the grid now, so `menu-grid` contains
  // both. The seeded product is also the featured special, and the hero's add control carries the
  // same item-specific accessible name the card's does — deliberately, so a screen reader hears
  // which dish each button adds (it said a generic "Add to Order" before). Unscoped, and scoped to
  // the grid, this is a strict-mode violation resolving to two elements.
  const seededAddButton = page
    .getByTestId('menu-card')
    .getByRole('button', { name: /^Add E2E Test Product to order$/i });
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

  // Open the slide-over from the FLOATING cart button — /menu's only cart entry point. The
  // sticky-bar copy that briefly did the same job is gone; `e2e/helpers/menuBasket.ts` is the one
  // place that knows this, and this driver predates it.
  const basket = await openMenuBasket(page);

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
