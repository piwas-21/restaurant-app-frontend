import { test, expect } from '@playwright/test';
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
 * NO a11y SCAN, and that is a stated exception to E2E-STRATEGY §Accessibility rather than an
 * omission. `expectNoA11yViolations` was run against this exact page while writing the spec and
 * reports THREE blocking rules on code this PR does not touch: `label` (critical — the editor's
 * fields use a bare `<label>` with no `htmlFor` and no wrapping, e.g. ProductBasicsFields.tsx:40),
 * `select-name` (critical) and `color-contrast` (serious). Adding the scan here would make a CI
 * gate that exists to prove the admin suite RUNS fail for an unrelated reason on its first day, and
 * would land that failure on whoever is editing the editor. The findings are filed instead; the
 * scan belongs in this spec the day they are fixed.
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

test.beforeAll(async ({ request, baseURL }) => {
  if (process.env.E2E_REMOTE || !isLocalStack(baseURL ?? '')) {
    skipReason = 'local/CI stack only — a login on a deployed tenant rotates its admin refresh token';
    return;
  }

  // Throws rather than returns a reason when CI has no credential — that is the #585 guard.
  const { session, reason } = await adminSession(request, apiBaseUrl(), credKeyForBaseUrl(baseURL ?? ''));
  if (!session) {
    skipReason = reason ?? 'no admin session';
    return;
  }

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
    slug: 'menu-item-editor',
  });
});

test('a signed-in admin opens a product and gets all seven editor sections', async ({ browser, baseURL }) => {
  test.skip(!storageStatePath, skipReason);

  // A generous budget, spent only ONCE and only on CI. `webServer` is `next dev`, which compiles a
  // route on its FIRST request — and this route pulls the whole editor, so the cold compile is the
  // slowest thing in the run. Measured on CI run 33139713880: the first attempt spent 30s waiting
  // for an input that had not been rendered yet and failed, and the retry passed the same
  // assertion in 3.2s against the now-warm server. Retries hid it; a flake that only passes on
  // retry is still a broken test, so the budget is raised rather than left to `retries: 2`.
  test.setTimeout(180_000);

  const context = await browser.newContext({ storageState: storageStatePath });
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
  } finally {
    await context.close();
  }
});
