import { test, expect, type APIRequestContext } from '@playwright/test';
import { adminSession, credKeyForBaseUrl } from '../../helpers/adminAuth';
import { apiBaseUrl } from '../../helpers/config';
import { writeAuthStorageState } from '../../helpers/storageState';

/**
 * HIGH-tier — the admin item editor REFUSES a save it cannot make, and says where the problem is
 * (MENU-ITEM-EDITOR-REDESIGN-PLAN decision D13, slice S7; handover §5 asks for this spec by name).
 *
 * What only a browser can prove here: react-hook-form's `onTouched` mode, the submit that is
 * cancelled before it reaches the network, and the focus landing on a control that may be a full
 * viewport above the save bar. A jest test asserts the same logic against jsdom, where "scrolled
 * into view" and "the caret is in the field the user must fix" are not really observable.
 *
 * **It writes NOTHING, by construction.** The whole subject is a save that must not happen, so the
 * only mutation it could make is the one it exists to prove impossible — and it verifies that
 * directly by re-reading the product afterwards. That is why it is safe on any environment,
 * including a shared deployed tenant, and why it needs no `afterAll` restore.
 *
 * WHERE IT RUNS: anywhere an admin credential is available. Today that is a developer's
 * `.env.local` and a deployed host; **in CI it SKIPS**, because `ci.yml`'s Playwright job seeds no
 * admin user and sets no credential — filed as
 * [#585](https://github.com/piwas-21/restaurant-app-frontend/issues/585), in flight. When that
 * lands this suite starts running on every PR with no change here.
 *
 * SERIAL: `beforeAll` runs once per WORKER, and a deployed environment allows five logins per
 * fifteen minutes per IP. One worker, one login.
 */
test.describe.configure({ mode: 'serial' });

let ready = false;
let skipReason = '';
let api = '';
let storageStatePath = '';
let token = '';
let productId = '';
let originalName = '';

interface Product {
  id: string;
  name: string;
}

/**
 * Read the item through the ADMIN list, with the bearer. The public catalog hides anything
 * inactive or unavailable, so an unauthenticated read could pick a different row on one call and
 * none on the next — and the final assertion compares the two reads.
 */
async function firstItem(request: APIRequestContext): Promise<Product | undefined> {
  const res = await request.get(`${api}/api/Products?page=1&pageSize=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status() !== 200) return undefined;
  const body = (await res.json()) as { data?: { items?: Product[] } };
  return body.data?.items?.[0];
}

test.beforeAll(async ({ request, baseURL }) => {
  api = apiBaseUrl();
  const { session, reason } = await adminSession(request, api, credKeyForBaseUrl(baseURL ?? ''));
  if (!session) {
    skipReason = reason ?? 'no admin session';
    return;
  }

  token = session.accessToken;

  const product = await firstItem(request);
  if (!product) {
    // Not a failure: an empty menu is a legitimate state of a fresh environment, and this suite
    // needs an existing item only because it is about EDITING one.
    skipReason = 'no menu item on this environment to open the editor for';
    return;
  }
  productId = product.id;
  originalName = product.name;

  storageStatePath = await writeAuthStorageState({
    frontendOrigin: baseURL ?? '',
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    user: {
      firstName: session.firstName,
      lastName: session.lastName,
      email: session.email,
      role: session.role,
      accessToken: session.accessToken,
    },
    role: 'admin',
    slug: 'editor-save-with-errors',
  });

  // Set LAST: a run that got a session but no product must skip, not half-run.
  ready = true;
});

test('an invalid item cannot be saved, and the editor says which field and where', async ({
  browser,
  baseURL,
  request,
}) => {
  test.skip(!ready, skipReason);

  const context = await browser.newContext({ storageState: storageStatePath });
  const page = await context.newPage();
  try {
    // `domcontentloaded`, not `networkidle`: a deployed host keeps long-lived connections open, so
    // networkidle may never settle and would eat the whole budget before an assertion ran.
    await page.goto(`${baseURL}/admin/menu-management/${productId}`, { waitUntil: 'domcontentloaded' });

    const name = page.locator('input[name="name"]');
    await expect(name, 'the editor should render the item it was asked for').toBeVisible({ timeout: 20_000 });

    // 1. onTouched: silent while the field is being edited, and speaking once it is left.
    await name.fill('');
    await expect(name, 'nothing is invalid until the field is left').not.toHaveAttribute('aria-invalid', 'true');
    await name.blur();
    await expect(name).toHaveAttribute('aria-invalid', 'true');

    // 2. The message is REACHABLE from the input, not merely drawn beside it.
    const describedBy = await name.getAttribute('aria-describedby');
    expect(describedBy, 'an invalid input must point at its own message').toBeTruthy();
    await expect(page.locator(`#${CSS.escape(describedBy as string)}`)).toBeVisible();

    // 3. The summary counts it and the nav marks the section holding it.
    const summary = page.getByTestId('editor-error-summary');
    await expect(summary).toBeVisible();
    await expect(page.getByRole('navigation').getByRole('button').first()).toContainText('!');

    // 4. Save is refused. The strongest available assertion is the SERVER's: no PUT can have
    //    landed, so the stored name is untouched. A status-code check would only prove that no
    //    request the browser made failed — not that none was made.
    await page.getByTestId('editor-save').click();
    await expect(name, 'focus must land on the field that blocks the save').toBeFocused();

    // 5. The jump works from the bar too, from wherever the admin happens to be.
    await page.locator('input[name="preparationTimeMinutes"]').scrollIntoViewIfNeeded();
    await summary.click();
    await expect(name).toBeFocused();
  } finally {
    await context.close();
  }

  const after = await firstItem(request);
  expect(after?.name, 'a refused save must not have written anything').toBe(originalName);
});
