# E2E Testing Strategy — RUMI Frontend

> **Purpose**: keep E2E coverage focused, maintainable, and DRY. If a new
> scenario doesn't fit this doc, the scenario — not the doc — is usually
> what's wrong.
>
> Authoritative for **browser E2E** (Playwright) in `frontend/`. The backend
> has its own integration-test layer (`backend/RestaurantSystem.IntegrationTests`)
> against a real Postgres via Testcontainers — that is the boundary *below*
> the browser tests described here. Phase plan + cumulative test count live in
> [TEST-COVERAGE-PLAN.md](TEST-COVERAGE-PLAN.md) §Phase 6.

## Scope: what E2E is for (and isn't)

**E2E tests verify user-observable behaviour across the full stack**: a real
Next.js server, a real .NET backend, real Postgres, the browser rendering
real HTML/CSS/JS, and real HTTP round-trips in between. They exist to catch
integration bugs the other layers can't see (JWT cookies/headers, CORS,
client-side hydration, App Router redirects, locale-aware form state across
navigations, RTL layout in `ar`).

E2E is **not**:

- A substitute for unit tests (services, hooks, utils, Zod schemas)
- A substitute for component tests (RTL on design-system primitives, RHF wiring)
- A substitute for backend integration tests (DTO contracts, EF Core queries,
  custom-mediator handlers — those live in `RestaurantSystem.IntegrationTests`)

If a bug can be caught cheaper at a lower layer, it belongs there.

### No mocks of our own code

The .NET API, our service layer (`src/services/**`), `src/lib/apiClient.ts`,
contexts (`AuthContext`, `CartContext`, …) — **never** mocked in E2E. If a
test wants a seeded user, products, or a table layout, it writes them via
the backend API or a seed helper before the test; it doesn't stub
`apiClient` or shim a context provider.

### Safe boundaries with external systems

We can't hit Stripe / Adyen / Gmail SMTP / the ESC/POS thermal printer from
CI. The pattern:

- **Our code runs in full**, including the service that would call out.
- The outbound call hits a **boundary-level mode** baked into the backend:
  - **SMTP** → routed at **Mailpit** (`docker compose ... up mailpit`, ports
    1025/8025) by setting `EmailSettings__SmtpHost=localhost`,
    `SmtpPort=1025`, `EnableSsl=false`, `UseAuthentication=false` on the
    backend. Tests fetch the captured email via the helper at
    `e2e/helpers/mailpit.ts` and drive the real /verify-email link.
  - **Payments** → `Payments:Mode=Test` (planned).
  - **Printer** → disabled in test env via `PrinterSettings:ApiKey=""`.
- For payment webhooks, tests POST a valid signed payload directly to our
  webhook route — that's the real integration surface.

This is the line: mock the **network edge**, never our own layers.

## Priority tiering — what to test

Every proposed scenario gets a priority. Only HIGH and some MED ship.

### 🔴 HIGH — must cover

Criteria: revenue-critical, security-critical, or a past production incident.

- **Public ordering**: home → menu browse → add product (with options) → view cart → place order as guest
- **Auth**: register → email verify → login → logout; failed login surfaces error
- **Checkout**: customer with address → choose order type (delivery/pickup/dine-in) → confirm → order appears in `/my-orders`
- **Cashier flow**: log in as cashier → see incoming order → update status → mark paid
- **Server flow**: open table layout → seat guests → take order → send to kitchen
- **Admin products**: create product → upload image → toggle availability → appears on public menu
- **Admin orders**: filter by status → open details → cancel/refund (boundary-mocked)
- **Reservations**: customer creates reservation → admin approves/rejects → status reflects on customer side
- **Locale + RTL**: switch to `ar` on a key page, confirm direction flips and primary CTA is reachable
- **Auth-guard**: unauthenticated user hitting `/admin` is redirected to login

### 🟡 MED — cover if cheap

Criteria: important but not revenue-blocking, or naturally exercised by a HIGH test.

- Theme toggle persists across navigation
- Language switch persists across navigation
- Working-hours / closed-day banner appears on menu
- Fidelity points balance updates after a paid order
- QR scan landing (`/scan`) opens the right table session

### ⚪ LOW — do not add

- Cosmetic states (empty / loading / error banners) — component test
- Every locale variant for the same flow — pick `en` + `ar` (RTL); skip the rest
- Keyboard focus order for every input (a11y scan covers the common case)
- Every admin read-only table sort
- Responsive viewports beyond one mobile check
- Re-running the same flow at every breakpoint

If you're tempted, write a component test instead.

## Accessibility

Every test runs `@axe-core/playwright` against the landing view via the
shared `expectNoA11yViolations(page)` helper. This catches missing labels,
bad contrast, heading order, and ARIA misuse automatically.

- **Default severity threshold**: critical + serious. Moderate violations
  are logged but don't fail the test.
- **Don't disable the scan** in a test without documenting why. Scope it —
  exclude a specific selector, not the whole page.
- For `ar` (RTL), run the scan after the locale switch — it catches
  mirrored-layout regressions that the `en` pass misses.

## Directory layout

```
e2e/
  tests/                      # Test files, grouped by surface
    public/                   # Unauthenticated flows (menu, /scan, reservations)
    auth/                     # Register / login / verify / logout
    customer/                 # Cart, checkout, /my-orders, /my-reservations, /account
    cashier/                  # Cashier-role flows
    server/                   # Server / table-layout flows
    kitchen/                  # Kitchen-staff flows
    admin/                    # Admin-role flows
  pages/                      # Page Object Model — one class per screen
  fixtures/                   # Playwright fixtures (auth roles, seeding)
  helpers/                    # Shared assertion + interaction helpers (incl. a11y)
  seed/                       # Backend-API-based test data builders
  README.md                   # Quickstart (how to run, debug)
```

- **One test file per flow**, not per page. A flow can span pages.
- **Page objects are dumb**: selectors + action methods. No assertions.
  Assertions go in tests where context matters.
- **Helpers are pure-ish**: receive a `Page`, do a thing, return data. They
  don't own state.

## Selector strategy

**In order of preference:**

1. `page.getByRole("button", { name: "Save" })` — role + accessible name
2. `page.getByLabel("Email")` — for inputs with labels
3. `page.getByText("...")` for unambiguous copy in a context
4. `data-testid="..."` — **only** when 1–3 are impractical (e.g., purely
   graphical elements, repeating rows without unique copy, drag-and-drop
   targets in the table layout).

Never use CSS classes (`.module.css` hashes change), CSS-Module class names,
or deep descendant selectors — they break on harmless style refactors.

### i18n note on selectors

Accessible names come from translated copy (`t('save')`). Tests must run in
a deterministic locale. Default the test run to `en` via the same mechanism
the app uses (`i18nextLng` localStorage / cookie). Tests that exercise
locale switching must `await` the change before asserting.

## Data isolation

Every test creates its own data with unique IDs. No shared fixtures beyond
the empty-DB baseline. Parallel workers must not step on each other.

- User emails: `e2e-${test.info().testId}-${Date.now()}@test.local`
- Product names: `e2e-${cuid()}-${name}`
- Reservation customer names: same pattern
- Table numbers: reserved range `>= 9000` is the e2e sandbox; the seed
  helper allocates from that range

Teardown happens in an `afterEach` or `afterAll` that deletes by the prefix
filter (`e2e-%@test.local` for users, `e2e-%` for product / reservation
names). Never rely on a transactional outer wrapper or DB reset between
tests — that blocks parallelism.

## Auth

Playwright's `storageState` is used for authenticated flows. Per-role
fixtures bake the JWT into a saved state file:

- `customerUser` — verified customer
- `cashierUser` — staff with `Cashier` role
- `serverUser` — staff with `Server` role
- `kitchenUser` — staff with `KitchenStaff` role
- `adminUser` — admin

Each fixture:

1. Calls the backend (`POST /api/auth/register` + verify, or seeds a staff
   user via the test-only seed endpoint) to create a fresh principal.
2. Performs a real `POST /api/auth/login` to capture the JWT exactly as the
   browser would.
3. Writes the auth state (cookie + localStorage tokens) to a temp file
   under `e2e/.auth/`.
4. Returns the user record + state path to the test.
5. Cleans up the user on teardown.

Tests that need auth declare the fixture and get a signed-in `page`. The
`auth.e2e.ts` flow (covering register/login/logout itself) is the only
test that drives the login UI.

## Reliability

- **Web-first assertions only**: `await expect(locator).toBeVisible()` over
  `await locator.isVisible()`. Built-in retry is the whole point.
- **No `waitForTimeout`** unless there is truly no observable signal
  (almost never — prefer `expect(...).toHaveURL(...)`,
  `toHaveText(...)`, or wait on a network response).
- **Retries**: `0` locally (fail fast), `2` in CI (only for genuine infra
  blips).
- **Traces + video**: captured on first retry and on failure; uploaded as
  CI artifacts (best-effort), never committed.
- **Deterministic env**: `TZ=UTC`, `LANG=en_US.UTF-8`, `NEXT_PUBLIC_*`
  injected from the test profile so the app points at the test backend.

## CI

- Runs on every MR and every push to `develop` and `main`.
- The backend test profile (real Postgres, in-memory queues, no real SMTP /
  payment / printer) is brought up by the existing backend
  `docker-compose-dev-all.yml`-style script before Playwright runs.
- Playwright browsers cached by version.
- Artifact upload (`playwright-report/`, `test-results/`) is **best-effort,
  non-blocking** — a storage hiccup doesn't fail the MR.
- Target total E2E runtime: **under 5 min** on the default matrix. If a new
  test pushes over, scope is wrong.

GitLab job (sketch — to be added in `.gitlab-ci.yml` Phase 6):

```yaml
e2e:
  stage: test
  image: mcr.microsoft.com/playwright:v1.56.1-jammy
  services:
    - name: postgres:16
      alias: postgres
  variables:
    TZ: UTC
    LANG: en_US.UTF-8
  script:
    - npm ci
    - npx playwright test
  artifacts:
    when: always
    paths:
      - frontend/playwright-report/
      - frontend/test-results/
    expire_in: 1 week
  allow_failure: false
```

## Gitignored outputs

```
e2e/.auth/
playwright-report/
test-results/
```

These are local-only. **Do not gitignore the whole `e2e/` directory** —
tests must be committed. (This was the bug in the original config.)

Never commit a snapshot, screenshot, or trace — **with one deliberate
exception**: the golden baselines of the screenshot suite under
`e2e/screenshots/__screenshots__/` are committed by design (linux-generated
inside the pinned Playwright image; the tenant-templates T2 zero-diff gate).
They are regenerated only via `npm run test:screenshots:docker:update`,
never hand-edited. See `e2e/README.md` §Screenshot baseline.

## Adding a new scenario — the checklist

Before opening an MR with a new E2E test:

- [ ] Does the scenario appear under HIGH or MED above? If LOW, close the MR.
- [ ] Is there a cheaper test (Jest unit, RTL component, backend integration
      test) that would catch the same regression?
- [ ] Does it use a Page Object? Role-based selectors first, `data-testid`
      only where justified?
- [ ] Does it create + clean its own data (no shared fixtures, prefix-based
      teardown)?
- [ ] Is there an accessibility check via `expectNoA11yViolations`?
- [ ] Does it pass the "run it 10× in parallel" test locally
      (`npx playwright test --repeat-each=10 --workers=4`)?
- [ ] Is the test name a full sentence describing the observed behaviour
      (e.g. `"customer can place a guest order from the public menu"`)?
- [ ] Does it touch only one role per fixture? (No mixing customer + admin
      state in the same `page`.)
