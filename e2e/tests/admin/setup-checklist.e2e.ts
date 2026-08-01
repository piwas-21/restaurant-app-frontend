import { test, expect, type APIRequestContext } from '@playwright/test';
import { adminSession, credKeyForBaseUrl } from '../../helpers/adminAuth';
import { apiBaseUrl } from '../../helpers/config';
import { writeAuthStorageState } from '../../helpers/storageState';
import { expectNoA11yViolations } from '../../helpers/a11y';

/**
 * HIGH-tier — the O4 first-run setup checklist, against a REAL deployed tenant.
 *
 * This is the one part of O4 that unit and component tests structurally cannot reach. Jest mocks
 * the service; this asks the actual backend on the actual host what steps this actual tenant is
 * entitled to, then checks the admin UI renders exactly those. Two things only a deployed tenant
 * can prove:
 *
 *   1. **The module filter, against a tenant that really enforces.** `demo` is the only instance
 *      running `TENANT_MODULES_ENFORCE=true`, and it did not buy `printing`. Everywhere else —
 *      including every local stack — reports the whole vocabulary, so a filter that did nothing
 *      would pass. Here it cannot.
 *   2. **The derived steps, against real data.** `menu` and `staff` are observed, not claimed. A
 *      tenant with a real menu must read done; that is a live query returning a real answer, which
 *      no fixture reproduces.
 *
 * It runs against whichever host `E2E_BASE_URL` points at (demo = craft template,
 * staging.fooderist.com = classic), so the same spec covers both skins — the checklist ships its
 * own CSS module and the two templates redefine the tokens it uses.
 *
 * WHERE IT RUNS: deployed hosts only, gated on `E2E_REMOTE` —
 *   npm run test:e2e:checklist:demo      (craft, module enforcement ON)
 *   npm run test:e2e:checklist:staging   (classic, unrestricted)
 * Anywhere else it SKIPS with a stated reason. The gate is `E2E_REMOTE`, not "is a credential
 * configured": `.env.example` ships an empty `ADMIN=` and invites a developer to fill it in, and
 * a local stack has no seeded menu — `menu.isDone` would then fail for a reason that says nothing
 * about the code, after writing to the local database on the way.
 *
 * COST: exactly ONE login permit per run, per host. Deployed environments allow five logins per
 * fifteen minutes per IP, and the two hosts have separate buckets. `beforeAll` runs per WORKER,
 * so this is SERIAL — a parallel suite would spend a permit per worker.
 *
 * That permit buys a session the BROWSER can use, and that cannot be cached: the refresh token
 * rotates and `AuthContext.validateSession` spends it on bootstrap (see `adminAuth.ts`). One real
 * side effect follows that teardown cannot undo — logging in rotates the user's single stored
 * refresh-token slot, so anyone signed into this tenant's admin panel is logged out on their next
 * bootstrap. On a QA/demo tenant that is a shrug; do not point this at a tenant whose admin is a
 * paying customer mid-service.
 *
 * SHARED-ENVIRONMENT DISCIPLINE: every write this suite makes is undone in `afterAll`, including
 * on failure, and the restore is ASSERTED rather than assumed. A checklist left half-ticked on the
 * demo tenant is worse than no test — demo is the showcase, and the next person to open it would
 * be reading this suite's leftovers.
 */
test.describe.configure({ mode: 'serial' });

/** Only true once `beforeAll` has BOTH a session and a snapshot. Guards the tests and the teardown. */
let ready = false;
let skipReason = '';
let token: string | null = null;
let api = '';
let storageStatePath = '';

/**
 * Steps this suite intends to have written, registered BEFORE the request goes out.
 *
 * Registering after a successful response would miss the case that matters most: a regression that
 * makes a write succeed where it should have been refused. The assertion fails, the write landed,
 * and nothing knows to undo it.
 */
const touched = new Set<string>();
/** The checklist exactly as `beforeAll` found it, so "restore" means restore and not "guess". */
const originalDone = new Map<string, boolean>();

interface Step {
  key: string;
  moduleId: string | null;
  isDerived: boolean;
  isDone: boolean;
}
interface Checklist {
  isDismissed: boolean;
  doneCount: number;
  steps: Step[];
}

const CHECKLIST = '/api/admin/setup-checklist';

async function getChecklist(request: APIRequestContext): Promise<Checklist> {
  const res = await request.get(`${api}${CHECKLIST}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status(), 'GET setup-checklist').toBe(200);
  return ((await res.json()) as { data: Checklist }).data;
}

/** Register the intent, then write. Never the other way round — see `touched`. */
async function setStepDone(request: APIRequestContext, key: string, isDone: boolean) {
  touched.add(key);
  return request.put(`${api}${CHECKLIST}/steps/${key}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { isDone },
  });
}

test.beforeAll(async ({ request, baseURL }) => {
  if (!process.env.E2E_REMOTE) {
    skipReason = 'deployed-host only — run `npm run test:e2e:checklist:demo` or `:staging` (they set E2E_REMOTE)';
    return;
  }
  api = apiBaseUrl();
  const credKey = credKeyForBaseUrl(baseURL ?? '');

  // ONE login. Its access token is the bearer for the API half and the browser's session for the
  // UI half — reaching for `adminToken`'s cache as well would only add a second permit on a cold
  // run, since the session cannot be cached anyway.
  const { session, reason } = await adminSession(request, api, credKey);
  if (!session) {
    skipReason = reason ?? 'no admin session';
    return;
  }
  token = session.accessToken;

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
    slug: 'setup-checklist',
  });

  // Snapshot before touching anything. `ready` is set LAST, so a suite that got a session but no
  // snapshot skips rather than "restoring" steps to a fabricated default.
  const before = await getChecklist(request);
  for (const s of before.steps) originalDone.set(s.key, s.isDone);
  ready = true;
});

test.afterAll(async ({ request }) => {
  if (!ready) return;

  // Attempt a restore for everything we touched. Response codes are NOT the check — a derived
  // step answers 400 here because the guard that refused the original write refuses this one too,
  // and nothing was ever persisted. Treating that as a failed restore is a false alarm; treating
  // every 400 as fine would hide a real one.
  for (const key of touched) {
    // A key absent from the snapshot was never observed, so there is no "original" to return it
    // to — writing one would be inventing state on a shared tenant.
    if (originalDone.has(key)) await setStepDone(request, key, originalDone.get(key)!);
  }
  touched.clear();

  // Then verify against what the server actually reports. Observed state, not status codes: this
  // is immune to the derived-step 400 above AND catches a restore that silently did not land.
  const after = await getChecklist(request);
  const drifted = after.steps
    .filter((s) => originalDone.has(s.key) && originalDone.get(s.key) !== s.isDone)
    .map((s) => `${s.key}: was ${originalDone.get(s.key)}, now ${s.isDone}`);

  expect(drifted, `steps left changed on a shared environment: ${drifted.join('; ')}`).toEqual([]);
});

test('the checklist offers only the steps this tenant’s modules entitle it to', async ({ request, baseURL }) => {
  test.skip(!ready, skipReason);

  const modulesRes = await request.get(`${api}/api/tenant/modules`);
  expect(modulesRes.status(), 'GET /api/tenant/modules').toBe(200);
  const modules = ((await modulesRes.json()) as { data: { modules: string[]; enforced: boolean } }).data;

  const checklist = await getChecklist(request);
  const keys = checklist.steps.map((s) => s.key);
  console.log(`  ${baseURL} — enforced=${modules.enforced} modules=[${modules.modules.join(',')}]`);
  console.log(`  steps: [${keys.join(', ')}]`);

  // Core steps are never module-gated: a Core-only tenant needs the guidance most.
  for (const core of ['restaurant-info', 'opening-hours', 'appearance', 'menu', 'tables-qr', 'staff']) {
    expect(keys, `core step ${core} must always be offered`).toContain(core);
  }

  // Every module-owned step present must be a module the tenant actually has. Vacuous where
  // everything is enabled; on `demo`, which enforces and did not buy `printing`, this is the whole
  // reason for running against a deployed tenant at all.
  for (const step of checklist.steps) {
    if (step.moduleId) {
      expect(modules.modules, `step '${step.key}' is offered but its module is not enabled`).toContain(step.moduleId);
    }
  }

  // And nothing the tenant paid for is silently missing — this half has teeth everywhere. Step
  // keys and module ids coincide for every gated step, which `SetupSteps.cs` fixes.
  for (const moduleId of ['kitchen-board', 'cashier', 'server', 'reservations', 'loyalty', 'printing']) {
    if (modules.modules.includes(moduleId)) {
      expect(keys, `module '${moduleId}' is enabled but its step is missing`).toContain(moduleId);
    }
  }
});

test('derived steps read from real data and refuse to be claimed', async ({ request }) => {
  test.skip(!ready, skipReason);

  const checklist = await getChecklist(request);
  const menu = checklist.steps.find((s) => s.key === 'menu');
  const staff = checklist.steps.find((s) => s.key === 'staff');
  expect(menu?.isDerived, 'menu must be derived').toBe(true);
  expect(staff?.isDerived, 'staff must be derived').toBe(true);

  // Both deployed tenants have a real menu — a product in a category. If this ever fails, the
  // derivation broke or the tenant's menu did; either is worth waking up for.
  expect(menu?.isDone, 'this tenant has a real menu, so the menu step must read done').toBe(true);

  // The load-bearing rule: a derived step cannot be asserted. `setStepDone` registers `menu` for
  // teardown BEFORE sending — a 400 writes nothing today, but this test exists precisely for the
  // regression where it stops being refused, and that is the run that must still clean up.
  const refused = await setStepDone(request, 'menu', true);
  expect(refused.status(), 'acknowledging a derived step must be refused').toBe(400);
});

test('an acknowledgement round-trips, and is idempotent', async ({ request }) => {
  test.skip(!ready, skipReason);

  const key = 'tables-qr';
  const was = originalDone.get(key) ?? false;
  const target = !was;

  expect((await setStepDone(request, key, target)).status()).toBe(200);
  expect((await getChecklist(request)).steps.find((s) => s.key === key)?.isDone).toBe(target);

  // The PUT carries the desired state, not a toggle, so a retry after a dropped connection lands
  // on the same answer instead of flipping back.
  expect((await setStepDone(request, key, target)).status()).toBe(200);
  expect((await getChecklist(request)).steps.find((s) => s.key === key)?.isDone).toBe(target);

  // Put it back HERE, not only in `afterAll`. The window matters on a shared tenant: a run killed
  // between tests would otherwise leave the step flipped, and the NEXT run snapshots that as the
  // original — baking the change in permanently. Restoring inside the test shrinks that window to
  // this block; `afterAll` stays as the net for the case where the assertions above throw first.
  expect((await setStepDone(request, key, was)).status()).toBe(200);
  expect((await getChecklist(request)).steps.find((s) => s.key === key)?.isDone).toBe(was);
});

test('the admin dashboard renders exactly the steps the API offers', async ({ browser, baseURL, request }) => {
  test.skip(!ready, skipReason);

  const checklist = await getChecklist(request);
  test.skip(checklist.isDismissed, 'checklist is dismissed on this tenant — nothing to render');

  const context = await browser.newContext({ storageState: storageStatePath });
  const page = await context.newPage();
  try {
    // `domcontentloaded`, not `networkidle`: a deployed host runs Sentry and other long-lived
    // connections, so networkidle may never settle — and with no `navigationTimeout` configured it
    // would eat the whole test budget before a single assertion ran. The web-first waits below
    // give the same guarantee without the hazard.
    await page.goto(`${baseURL}/admin/dashboard`, { waitUntil: 'domcontentloaded' });

    const panel = page.locator('section[aria-labelledby="setup-checklist-heading"]');
    await expect(panel, 'the checklist panel should render for a signed-in admin').toBeVisible({
      timeout: 20_000,
    });

    // Row count against the API's step count.
    //
    // Honest about what this catches: the UI filters the ALREADY-filtered list again, purely
    // subtractively, so this detects the UI being MORE restrictive than the API and is blind to it
    // being less. The other direction lives in the component test, where the module set can be
    // varied independently and the filter was mutation-checked.
    const rows = panel.locator('ol > li');
    await expect(rows, 'UI row count must match the API step count').toHaveCount(checklist.steps.length);

    // Derived steps get NO checkbox — they are observed, and a control would invite claiming one.
    const derived = checklist.steps.filter((s) => s.isDerived).length;
    await expect(panel.locator('input[type="checkbox"]')).toHaveCount(checklist.steps.length - derived);

    // Progress agrees with the data rather than being decorative.
    const bar = panel.locator('progress');
    await expect(bar).toHaveAttribute('max', String(checklist.steps.length));
    await expect(bar).toHaveAttribute('value', String(checklist.steps.filter((s) => s.isDone).length));

    // No raw i18n keys leaked into either template's rendering.
    const text = (await panel.innerText()).toLowerCase();
    expect(text, 'a raw i18n key means a missing translation').not.toMatch(/setup_step_|setup_checklist_/);

    // E2E-STRATEGY §a11y: every browser-driving spec scans. This one renders a brand-new CSS
    // module across two template skins, which is the case that rationale was written for.
    //
    // NO exclusions. This scan used to exclude `.nav-link.active` — the shared top-nav's
    // current-page pill — because it failed AA contrast. Fixed 2026-08-01: the pill now reads
    // --brand-primary-elevated, a token tuned against the pill's own washed background
    // (classic dark was 3.55:1 and is now 5.5:1, measured on a deployed tenant). The exclusion
    // is deleted rather than kept "just in case": it was scoped to one selector precisely so
    // that removing the bug removes the exclusion with it.
    await expectNoA11yViolations(page);
  } finally {
    await context.close();
  }
});
