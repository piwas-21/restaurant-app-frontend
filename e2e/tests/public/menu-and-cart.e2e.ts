import { test, expect } from '@playwright/test';
import { expectNoA11yViolations } from '../../helpers/a11y';

/**
 * HIGH-tier — public ordering: browse the menu, add an item to cart,
 * land on the cart page, and update the quantity. No login required.
 *
 * Selectors are role-based (per E2E-STRATEGY §Selector strategy). Note
 * the accessible-name patterns differ:
 *   - menu card button: aria-label = "Add <item-name> to order" (i18n key
 *     `add_item_to_order` interpolating the localised item name)
 *   - customization modal confirm: visible text = "Add to Order", no
 *     aria-label, so accessible name = visible text
 * The regex `/^Add( .+)? to order$/i` matches both. When a product has
 * variations or ingredient options, the card click opens a dialog and the
 * user confirms from there; we handle both paths via the `dialog` lookup.
 *
 * Data dependency: at least one product flagged active + available + not
 * deleted must exist in the dev DB. The basket persists server-side keyed
 * to a per-session-id header that the frontend stamps on first load —
 * Playwright's per-test browser context isolates this naturally, so
 * cross-test cart pollution isn't possible.
 */
test('customer can browse the menu, add an item, and update its quantity in the cart', async ({ page }) => {
  await page.goto('/menu');

  // a11y baseline: scan after the menu has rendered (helper waits for it).
  // The first add-to-order button being visible is the load-completed signal.
  const firstAddButton = page.getByRole('button', { name: /^Add( .+)? to order$/i }).first();
  await expect(firstAddButton).toBeVisible({ timeout: 15_000 });
  await expectNoA11yViolations(page);

  // The basket POST may fire from the card click directly, or from the
  // customization modal's confirm button — set up the response wait
  // BEFORE either could happen. Matches POST/PUT to /api/Basket.
  const basketWritePromise = page.waitForResponse(
    (r) => r.url().includes('/api/Basket') && ['POST', 'PUT'].includes(r.request().method()),
    { timeout: 10_000 },
  );

  await firstAddButton.click();

  // If the product has variations / ingredient options, the page opens a
  // role="dialog" customization modal whose confirm button is also "Add to
  // Order". Click it if it appears; otherwise the card click already
  // triggered the basket POST.
  try {
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /^Add( .+)? to order$/i })
      .click({ timeout: 3_000 });
  } catch {
    // No customization modal — direct-add path. Continue.
  }

  await basketWritePromise;

  // Verify the cart UI reflects the addition.
  await page.goto('/cart');
  await expect(page.getByRole('heading', { name: /your cart/i })).toBeVisible();

  // At least one cart line item should be present. Cart items render an
  // <h2> with the product name; if zero, the page shows an empty-state
  // message instead of any item heading.
  const itemHeadings = page.getByRole('heading', { level: 2 });
  await expect(itemHeadings.first()).toBeVisible();

  // Increase quantity. The increment button has an i18n'd aria-label
  // matching /increase quantity/i. Assert against the response body
  // (rather than a re-render proxy) — strongest signal that the basket
  // actually went 1 → 2.
  const updatePromise = page.waitForResponse(
    (r) => r.url().includes('/api/Basket') && ['POST', 'PUT'].includes(r.request().method()),
    { timeout: 10_000 },
  );
  await page.getByRole('button', { name: /increase quantity/i }).first().click();
  const updateResponse = await updatePromise;
  const updatedBasket = (await updateResponse.json()) as {
    data?: { items?: Array<{ quantity: number }> };
  };
  const items = updatedBasket.data?.items ?? [];
  expect(items.length).toBeGreaterThan(0);
  expect(items.some((i) => i.quantity >= 2)).toBe(true);
});

/**
 * Sidebar happy-path: pick Takeaway in the sidebar toggle, add an item,
 * verify the sidebar reflects the cart, then click Proceed to Checkout
 * and assert the route. Locks in the sidebar's cart-half regression
 * surface that the order-type-followup tests don't cover (qty controls
 * + remove + checkout button).
 *
 * Sidebar is hidden under 1024px; Playwright's default 1280-wide
 * viewport is fine. Skip if a smaller viewport is ever set as default.
 */
test('sidebar happy-path: pick Takeaway, add an item, proceed to checkout', async ({ page }) => {
  await page.goto('/menu');

  const sidebar = page.getByRole('complementary', { name: /shopping basket/i });
  await expect(sidebar).toBeVisible({ timeout: 15_000 });

  // Pick Takeaway. As a guest (§C1.5.e), the TakeawayInfoModal opens
  // asking for name + email + phone — dismiss it; this test only
  // exercises the sidebar surface itself, not the smart-skip path
  // (covered by smart-skip-checkout.e2e.ts).
  await sidebar.getByRole('group', { name: /order type/i }).getByRole('button', { name: /takeaway/i }).click();
  const takeawayModal = page.getByRole('dialog', { name: /almost there/i });
  await takeawayModal.getByRole('button', { name: /^cancel$/i }).click();
  await expect(takeawayModal).toBeHidden();

  // Add the first menu item to cart, wait for /api/Basket POST/PUT to
  // settle so the sidebar's items list re-renders deterministically.
  const basketWritePromise = page.waitForResponse(
    (r) => r.url().includes('/api/Basket') && ['POST', 'PUT'].includes(r.request().method()),
    { timeout: 10_000 },
  );
  await page.getByRole('button', { name: /^Add( .+)? to order$/i }).first().click();
  // If a customization dialog appears, confirm through it; otherwise the
  // card click already triggered the basket write.
  try {
    await page.getByRole('dialog').getByRole('button', { name: /^Add( .+)? to order$/i }).click({ timeout: 3_000 });
  } catch {
    /* no customization modal — direct add */
  }
  await basketWritePromise;

  // Sidebar shows the added item.
  await expect(sidebar.getByRole('button', { name: /increase quantity/i })).toBeVisible();
  await expect(sidebar.getByRole('button', { name: /remove item/i })).toBeVisible();

  // Proceed to Checkout is now enabled (cart non-empty + type chosen).
  // The takeaway info modal was cancelled, so CheckoutContext.customerInfo
  // is empty — smart-skip falls back to /menu (§C1.5.h: customer-info page
  // retired) so the modal can collect the missing inputs. The test stays
  // on /menu to lock in this fallback target.
  const proceed = sidebar.getByRole('button', { name: /proceed to checkout/i });
  await expect(proceed).toBeEnabled();
  await proceed.click();
  await expect(page).toHaveURL(/\/menu$/);
});

/**
 * Regression guard — "Details" must OPEN the item, never silently add it.
 *
 * The sheet has a fast path: a product with no customization options is added
 * straight to the cart on open. "Details" used to run that same opener, so on a
 * simple item (the e2e seed has no variations/ingredients) clicking Details
 * *added to the basket* instead of showing the modal — reported on demo AND prod.
 * The fix routes Details/title through `forceSheet`, which always opens the sheet.
 * This test would have failed before the fix (no dialog + a basket write).
 */
test('clicking Details opens the item modal and does NOT add it to the cart', async ({ page }) => {
  await page.goto('/menu');

  const detailsButton = page.getByRole('button', { name: /^details$/i }).first();
  await expect(detailsButton).toBeVisible({ timeout: 15_000 });

  // Capture any basket write the moment it's INITIATED (request event, not response), so a
  // quick-add is caught immediately without an artificial wait. Attached after the menu has
  // loaded, so it only counts writes caused by the Details click.
  let basketWrites = 0;
  page.on('request', (req) => {
    if (req.url().includes('/api/Basket') && ['POST', 'PUT'].includes(req.method())) basketWrites += 1;
  });

  await detailsButton.click();

  // The customization/details sheet opens — a BaseModal dialog whose footer confirm reads
  // "Add to Order • <price>" (non-anchored match — it ends with the live price, not "to order").
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 5_000 });
  await expect(dialog.getByRole('button', { name: /add to order/i })).toBeVisible();

  // The sheet opened — a quick-add would have skipped the dialog and POSTed instead — so the cart
  // must be untouched.
  expect(basketWrites).toBe(0);
});

/**
 * Regression guard — clicking a menu item's image opens the enlarge-on-click
 * lightbox (restored in #234 after f3f1269 deleted it and wired the image to
 * details). The lightbox is NOT the customization sheet: it shows the enlarged
 * image and carries no "Add to Order" button.
 */
test('clicking a menu item image opens the enlarged-image lightbox', async ({ page }) => {
  await page.goto('/menu');

  const thumbnail = page.getByTestId('menu-item-image').first();
  await expect(thumbnail).toBeVisible({ timeout: 15_000 });

  await thumbnail.click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 5_000 });
  // It's the image lightbox, not the customization sheet: an enlarged <img> photo is shown
  // (locator('img') targets the real image tag, not the close-button SVG that maps to role=img),
  // and there is NO "Add to Order" footer (the sheet's signature) inside the dialog.
  await expect(dialog.locator('img').first()).toBeVisible();
  await expect(dialog.getByRole('button', { name: /add to order/i })).toHaveCount(0);
});
