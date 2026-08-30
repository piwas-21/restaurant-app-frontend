import { test, expect, type APIRequestContext } from '@playwright/test';
import { expectNoA11yViolations } from '../../helpers/a11y';
import { adminSession, credKeyForBaseUrl, isLocalStack } from '../../helpers/adminAuth';
import { apiBaseUrl } from '../../helpers/config';
import { writeAuthStorageState } from '../../helpers/storageState';

/**
 * HIGH-tier — the ADMIN half of the suite, running on the EPHEMERAL CI stack (issue #585).
 *
 * This spec's first job is to exist. Before it, every admin suite in this repo ran only against a
 * DEPLOYED host behind `E2E_REMOTE`; on CI they all called `test.skip()` for want of a credential,
 * and a skipped test is a passing check — so `playwright (e2e)` reported green having never
 * attempted the admin journey at all. The workflow now seeds an admin through `UserSeeder` and
 * proves it can log in before the suite starts, `adminAuth.readCreds` reads that credential from
 * the environment, and this is the spec that consumes it. If this ever goes back to skipping on
 * CI, `adminAuth.assertCredentialConfigured` turns the skip into a red job instead.
 *
 * Its second job is real coverage: that a signed-in admin can open a product and get the editor —
 * §4's SEVEN named sections, in order, populated with that product's data. The component tests
 * (`ProductEditorSections.test.tsx`) pin the same list against a mocked hook; only this one proves
 * the route, the auth guard, the fetch and the shell agree on a live backend.
 *
 * LOCAL/CI STACK ONLY. It is read-only, but logging in ROTATES the tenant's single refresh-token
 * slot, so pointing it at demo or staging would sign out whoever is in that admin panel. The
 * ephemeral stack has no such user: its admin is created by the job and destroyed with it.
 *
 * SERIAL — `beforeAll` runs per worker, and one login per run is the budget.
 *
 * IT NOW RUNS THE a11y SCAN (#592). The exception that used to stand here — three blocking rules
 * on pre-existing debt — is gone because the debt is: `label` and `select-name` were closed by S7's
 * `htmlFor`/`fieldAria` work (#589) and re-measured absent, and #592 fixed the contrast pairings.
 * Re-measured on a live stack against `develop` immediately before the fix: `color-contrast` was
 * the ONLY violation, 5 nodes, all of them one of three colour pairs.
 *
 * The scan is the LAST thing the test does, deliberately. It asserts on the page the assertions
 * above have already proved is the right one — a scan of a page that never loaded is the vacuous
 * green this suite exists to end.
 */
test.describe.configure({ mode: 'serial' });

/** The product `e2e/seed/seed.sql` inserts. Fixed UUID, `type = 0` (MainItem) — so the editor
 *  builds the ITEM sections, not a bundle's two. */
const SEEDED_PRODUCT_ID = '00000000-0000-0000-0000-0000000000bb';
const SEEDED_PRODUCT_NAME = 'E2E Test Product';

/**
 * §4's seven sections, IN ORDER, as the DOM ids `EditorShell` renders.
 *
 * Deliberately literal rather than imported from `editorSectionTypes.ts`. These ids are a
 * user-visible contract — the section nav scrolls to them and a user's collapse preference is
 * stored under them — so a rename must fail an end-to-end test loudly, which importing the
 * constant would silently prevent.
 */
const SECTION_IDS = [
  'editor-section-basics',
  'editor-section-media',
  'editor-section-pricing',
  'editor-section-options',
  'editor-section-recipe',
  'editor-section-service',
  'editor-section-advanced',
] as const;

let storageStatePath = '';
let skipReason = '';

/**
 * One login, written to a storage-state file the browser can start from.
 *
 * ⚠️ THE RETURNED FILE IS A ONE-SHOT CREDENTIAL, and that is the whole reason this is a function
 * rather than a single `beforeAll` constant. `AuthContext.validateSession` bootstraps by calling
 * `refreshToken()`, and `RefreshTokenCommand` ROTATES — it replaces the stored hash on every use —
 * so the FIRST page load in the FIRST context SPENDS the refresh token in the file. A second
 * context started from the same file replays a spent token, gets an honest "Invalid token",
 * AuthContext clears all three keys and the admin route redirects to the tenant's PUBLIC home
 * page. `helpers/adminAuth.ts` documents exactly this and it is what CI measured on run
 * 33318536690: three attempts, `input[name="name"]` never found, the home page in every snapshot.
 *
 * So: one call per BROWSER CONTEXT, not one per file. The extra login is affordable here because
 * the spec runs on the local/CI stack only, where the Development profile allows 1000 logins per
 * window rather than a deployed host's 5.
 */
async function mintAdminStorageState(
  request: APIRequestContext,
  baseURL: string,
  slug: string,
): Promise<{ path: string; reason?: string }> {
  // Throws rather than returns a reason when CI has no credential — that is the #585 guard.
  const { session, reason } = await adminSession(request, apiBaseUrl(), credKeyForBaseUrl(baseURL));
  if (!session) return { path: '', reason: reason ?? 'no admin session' };

  const file = await writeAuthStorageState({
    frontendOrigin: baseURL,
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
    slug,
  });
  return { path: file };
}

test.beforeAll(async ({ request, baseURL }) => {
  if (process.env.E2E_REMOTE || !isLocalStack(baseURL ?? '')) {
    skipReason = 'local/CI stack only — a login on a deployed tenant rotates its admin refresh token';
    return;
  }

  const { path: file, reason } = await mintAdminStorageState(request, baseURL ?? '', 'menu-item-editor');
  if (!file) {
    skipReason = reason ?? 'no admin session';
    return;
  }
  storageStatePath = file;
});

test('a signed-in admin opens a product and gets all seven editor sections', async ({
  browser,
  request,
  baseURL,
}) => {
  test.skip(!storageStatePath, skipReason);

  // A generous budget, spent only ONCE and only on CI. `webServer` is `next dev`, which compiles a
  // route on its FIRST request — and this route pulls the whole editor, so the cold compile is the
  // slowest thing in the run. Measured on CI run 33139713880: the first attempt spent 30s waiting
  // for an input that had not been rendered yet and failed, and the retry passed the same
  // assertion in 3.2s against the now-warm server. Retries hid it; a flake that only passes on
  // retry is still a broken test, so the budget is raised rather than left to `retries: 2`.
  test.setTimeout(180_000);

  // A FRESH session for THIS context, for the same reason the sticky test below mints one — with
  // one extra: in `serial` mode a failure retries the WHOLE group, and the file the `beforeAll`
  // wrote was already SPENT by the first attempt (and overwritten again by the sibling test's
  // login, since `LoginCommand.cs:77` keeps ONE refresh-token hash per user). That is what CI run
  // 33319573832 measured: this test passed on attempt 1 and then failed on both retries, signed
  // out on the public home page with `input[name="name"]` never found. `beforeAll` stays as the
  // #585 credential preflight; it is no longer the source of a session any browser uses.
  const { path: sectionsStatePath } = await mintAdminStorageState(request, baseURL ?? '', 'menu-item-editor-sections');
  expect(sectionsStatePath, 'this test needs its own unspent admin session').not.toBe('');

  const context = await browser.newContext({ storageState: sectionsStatePath });
  const page = await context.newPage();
  try {
    // `domcontentloaded` rather than `networkidle`: the web-first waits below give the same
    // guarantee, and networkidle can outlive the test budget on a page with a live connection.
    await page.goto(`${baseURL}/admin/menu-management/${SEEDED_PRODUCT_ID}`, { waitUntil: 'domcontentloaded' });

    // The FIRST assertion is the loaded product, not the shell. `AdminAuthGuard` renders the
    // anonymous redirect a beat after first paint, and the editor renders its own frame while the
    // fetch is still out — so asserting a section id first could pass on an empty form belonging to
    // a signed-out user. A field carrying the seeded product's name can only be the real thing.
    const nameInput = page.locator('input[name="name"]');
    await expect(nameInput, 'the editor must load the seeded product for a signed-in admin').toHaveValue(
      SEEDED_PRODUCT_NAME,
      // Covers the cold `next dev` compile of this route; ~3s once warm.
      { timeout: 120_000 },
    );

    // All seven, and no eighth.
    const sections = page.locator('section[id^="editor-section-"]');
    await expect(sections, 'the item editor renders exactly §4 seven sections').toHaveCount(SECTION_IDS.length);

    // In order, and each with a heading a human can read. `Advanced` ships collapsed by default, so
    // the SECTION is visible while its body is hidden — assert the section, never its fields.
    for (const [index, id] of SECTION_IDS.entries()) {
      const section = page.locator(`section#${id}`);
      await expect(section, `${id} must render`).toBeVisible();
      await expect(sections.nth(index), `${id} must be section ${index + 1} of seven`).toHaveAttribute('id', id);
      await expect(section.locator('h2').first(), `${id} needs a heading`).not.toBeEmpty();
    }

    // A raw i18n key here means a missing translation, and every section label is a t() call.
    const text = await page.locator('form').first().innerText();
    expect(text, 'a raw i18n key means a missing translation').not.toMatch(/editor_section_/);

    /*
     * #592 — the scan, and no exclusions.
     *
     * `expectNoA11yViolations` fails on critical + serious. It runs LAST so that everything it
     * scans has already been proved to be the loaded editor for a signed-in admin; run first, it
     * would have happily reported a clean bill of health for a redirect page.
     *
     * One honest limit, stated because it will decide where the next finding comes from: axe scans
     * the page AS RENDERED, so it sees light mode and it sees `Advanced` COLLAPSED. A dark-mode
     * pairing is invisible to it — #592 found one that way, a neutral badge at 2.58:1 that this
     * scan could not have reported — and so is any control inside a collapsed section.
     */
    await expectNoA11yViolations(page);
  } finally {
    await context.close();
  }
});

/**
 * The FIX for frontend admin layout: the editor's section nav and the admin sidebar must stay on
 * screen while the long form scrolls.
 *
 * This is an E2E and not a component test on purpose: `position: sticky` is decided by LAYOUT, and
 * jsdom has none. The defect it guards was invisible to every other gate in this repo — the nav
 * already said `position: sticky`, and it still scrolled away, because `.adminContainer` carried
 * `overflow-x: hidden`, which per CSS Overflow 3 makes an element a SCROLL CONTAINER on both axes.
 * A sticky descendant is positioned against its nearest scroll container, and that one never
 * scrolls, so the offsets had nothing to travel over. Only a real engine can report that.
 *
 * The `scrollY` assertion is the CONTROL, not decoration: if the page did not move, "the nav is
 * still near the top" is true of a broken build too.
 */
test('the section nav and the admin sidebar stay pinned while the editor scrolls', async ({
  browser,
  request,
  baseURL,
}) => {
  test.skip(!storageStatePath, skipReason);
  test.setTimeout(180_000);

  // A SECOND context needs a SECOND session — see `mintAdminStorageState`. The test above has
  // already loaded a page with `storageStatePath`, which SPENT the refresh token in it, so
  // reusing that file here signs this context OUT and lands it on the public home page.
  const { path: stickyStatePath } = await mintAdminStorageState(request, baseURL ?? '', 'menu-item-editor-sticky');
  expect(stickyStatePath, 'the sticky test needs its own unspent admin session').not.toBe('');

  // Desktop width: below 820px the nav is a chip strip by design (D10) and is not sticky at all.
  const context = await browser.newContext({ storageState: stickyStatePath, viewport: { width: 1440, height: 800 } });
  const page = await context.newPage();
  try {
    await page.goto(`${baseURL}/admin/menu-management/${SEEDED_PRODUCT_ID}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('input[name="name"]'), 'the editor must load the seeded product').toHaveValue(
      SEEDED_PRODUCT_NAME,
      { timeout: 120_000 },
    );

    // A stable hook, not a class and not a translated name: the editor renders TWO navs that both
    // mark their current entry with `aria-current` (the section nav and the translation locale
    // rail), so filtering on `aria-current` alone is a strict-mode violation, and matching the
    // accessible name would tie the test to the English bundle.
    const sectionNav = page.getByTestId('editor-section-nav');
    const sidebarLink = page.locator('aside a[href="/admin/dashboard"]');
    await expect(sectionNav).toBeVisible();
    await expect(sidebarLink).toBeVisible();

    const navBefore = await sectionNav.boundingBox();
    const sidebarBefore = await sidebarLink.boundingBox();
    expect(navBefore, 'the section nav must have a box before scrolling').not.toBeNull();
    expect(sidebarBefore, 'the sidebar link must have a box before scrolling').not.toBeNull();

    await page.evaluate(() => window.scrollTo(0, 1200));
    // The control. A page that did not scroll makes every assertion below vacuously true.
    await expect
      .poll(() => page.evaluate(() => window.scrollY), { message: 'the editor page must actually scroll' })
      .toBeGreaterThan(600);

    const navAfter = await sectionNav.boundingBox();
    const sidebarAfter = await sidebarLink.boundingBox();

    // Still on screen, and still BELOW the 80px sticky app header rather than under it.
    expect(navAfter!.y, 'the section nav must stay pinned below the app header').toBeGreaterThanOrEqual(79);
    expect(navAfter!.y, 'the section nav must not be pushed down the viewport').toBeLessThan(400);
    // It moved with the viewport, not with the document: without the fix it would be ~1200px up.
    expect(navAfter!.y, 'the section nav must not scroll away with the form').toBeGreaterThan(navBefore!.y - 200);

    expect(sidebarAfter!.y, 'the admin sidebar must stay on screen').toBeGreaterThanOrEqual(0);
    expect(sidebarAfter!.y, 'the admin sidebar must not scroll away').toBeGreaterThan(sidebarBefore!.y - 200);
  } finally {
    await context.close();
  }
});
