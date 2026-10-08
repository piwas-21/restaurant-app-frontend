# RUMI Frontend — Playwright E2E

Authoritative strategy: [../docs/E2E-STRATEGY.md](../docs/E2E-STRATEGY.md). Read it first.

This directory is the test code. The runner config is [../playwright.config.ts](../playwright.config.ts).

## Quickstart

**First-run bootstrap** (once per checkout):

```bash
npm run test:e2e:install                        # installs the browser binary
export E2E_DATABASE_TARGET=disposable
export E2E_DATABASE_URL='postgres://<user>:<password>@localhost:5432/<e2e-database>'
```

Create a database reserved for E2E and point the local backend at that same
database. `E2E_DATABASE_TARGET=disposable` is an operator assertion that the DB
contains only disposable test data; it does not create or isolate a database.
The guard accepts IPv4 loopback addresses and the exact plain hostnames
`localhost` and `postgres`; it does not infer safety from a database name.
Disposable aliases with a trailing dot, bracketed IPv6 URL literals, and
comma-separated multi-host URLs are unsupported. Keep shared development and
staging databases out of this target. The URL has no committed default — export
it in your shell so gitleaks stays happy. Replace the placeholders with the
local database name and credentials.

The screenshot CI workflow generates a fresh disposable database password
for each job and passes it to its PostgreSQL service, backend and guarded seed.
It uses `localhost:5432/restaurantdb` and needs no database repository secret,
including for fork pull requests.

For a deliberate staging DB write, use `E2E_DATABASE_TARGET=staging`, set
`E2E_ALLOW_STAGING_DATABASE_WRITES=YES`, and set
`E2E_STAGING_DATABASE_HOST`, `E2E_STAGING_DATABASE_NAME`, and
`E2E_STAGING_DATABASE_PORT` to the expected hostname, database name, and port.
The guard requires an exact match with the parsed `E2E_DATABASE_URL`, including
the resolved port, including an inherited `PGPORT` when the URL omits its port.
A single staging DNS hostname with a trailing dot is supported when the
configured hostname includes that dot exactly. This opt-in covers direct E2E
DB fixtures and the SQL seed.
Remote API-only smoke commands such as `npm run test:e2e:checklist:staging` do
not use the DB helper or seed and need no DB target marker. Manual raw `psql`
commands bypass this guard; use `scripts/e2e-seed.mjs` for the shared seed.
`npm run test:e2e:collect` lists and imports the Playwright specs without
starting the web server, calling the API, or connecting to the database. The
guard and fixture modules remain importable by Playwright's CommonJS loader.
For a local check, set `E2E_REMOTE=1` and `E2E_BASE_URL` to a syntactically
valid URL before running the command; collection does not require the backend
or database to be reachable.
The shared SQL seed invokes `psql` only from the fixed executable locations
`/usr/bin/psql`, `/opt/homebrew/bin/psql`, and `/usr/local/bin/psql`; install the
PostgreSQL client in one of those supported CI or local Homebrew locations.

**Mailpit (SMTP catcher)** must be running for the auth tests, since
the verify-email flow drives a real /verify-email link from the email body.
`scripts/dev-e2e.sh` starts a one-off container if Mailpit isn't already up,
or use the dev compose: `docker compose -f ../backend/docker-compose-dev-all.yml up -d mailpit`.

The backend must be configured to send via Mailpit (env vars override
`app-secrets.json` since Program.cs adds `.AddEnvironmentVariables()` last):

```bash
export EmailSettings__SmtpHost=localhost
export EmailSettings__SmtpPort=1025
export EmailSettings__EnableSsl=false
export EmailSettings__UseAuthentication=false
# then restart the backend
```

**An admin account** is what the `e2e/tests/admin/` suites need, and `e2e/seed/seed.sql`
deliberately does not create one — `Users` is ASP.NET Identity, so a hand-written INSERT would have
to reproduce its PBKDF2 hash and normalised columns. Let the backend seed it instead, with the same
two variables CI uses (creation-only: an existing admin is never modified):

```bash
export SeedSettings__AdminEmail=e2e-admin@test.local
export SeedSettings__AdminPassword='<your own value — >=8 chars, upper, lower, digit, symbol>'
# then restart the backend against a database where that user does not exist yet
```

and give Playwright the same credential, either as `ADMIN='{email: …, password: …}'` in
`.env.local` or as a plain pair in the shell (`adminAuth.readCreds` reads the file first, the
environment second):

```bash
export ADMIN_EMAIL=e2e-admin@test.local
export ADMIN_PASSWORD='<the same value>'
```

Without it the admin suites SKIP with a stated reason. On CI they do not: a missing credential
there is a broken gate, not an environmental fact, so `adminAuth` throws and the job goes red
(issue #585 — every admin spec used to skip on every CI run, and a skipped test is a passing check).

**The seed keeps the restaurant open around the clock, and it takes TWO writes to do it.**
`IsOpenNowAsync` decides from the day's `working_hours_shifts` rows and falls back to the legacy
`working_hours.open_time/close_time` pair only when a day has none, so §6 of the seed writes the
pair and §6b replaces the shift rows — both, or the shop shuts at 23:00 on the tenant clock
(Europe/Zurich by default) and `GetEnabledOrderTypesAsync` strips `DineIn`. The tell when this
breaks is not obviously a clock problem: `order-flow-analytics` times out waiting for a **Dine In**
button that never renders, and the `/menu` baseline comes back ~50px SHORT because the
"Takeaway and Delivery only" availability notice has nothing left to warn about. If you see either,
read the seed's hours log lines before you touch a test or a baseline.

Then:

```bash
# Backend already running:
bash scripts/dev-e2e.sh

# Boot backend stack first (compose up + EF migrations + dotnet run):
bash scripts/dev-e2e.sh --start-backend

# Forward args to Playwright with `--`:
bash scripts/dev-e2e.sh -- --ui                                  # UI mode
bash scripts/dev-e2e.sh -- --headed                              # show browser
bash scripts/dev-e2e.sh -- e2e/tests/auth                        # one path
bash scripts/dev-e2e.sh -- -g "customer can place a guest order" # by name
```

Or, if you've exported `E2E_API_BASE_URL` / `E2E_DATABASE_URL` yourself, the
plain npm scripts still work:

```bash
npm run test:e2e              # headless
npm run test:e2e:ui           # Playwright UI mode
npm run test:e2e:headed       # show the real browser
npm run test:e2e:report       # open the last HTML report
```

Parallel-safety smoke (run a flow 10× across 4 workers):

```bash
npx playwright test --repeat-each=10 --workers=4 \
  e2e/tests/customer/checkout.e2e.ts
```

## Layout

| Path                           | Contains                                                                                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/<surface>/*.e2e.ts`     | One file per **flow** (not per page). Surfaces map to RUMI roles (public, auth, customer, cashier, server, kitchen, admin).                                   |
| `screenshots/*.screen.ts`      | **Screenshot-baseline suite** — separate config ([../playwright.screenshots.config.ts](../playwright.screenshots.config.ts)); see §Screenshot baseline below. |
| `screenshots/__screenshots__/` | **Committed** golden baselines (linux-generated PNGs). Never hand-edit; regenerate only via `npm run test:screenshots:docker:update`.                         |
| `pages/*.ts`                   | Page Objects — selectors + action methods. **No assertions.**                                                                                                 |
| `fixtures/*.ts`                | Playwright fixtures. The per-role auth fixtures (`customerUser`, `cashierUser`, `serverUser`, `kitchenUser`, `adminUser`) own `storageState`.                 |
| `helpers/*.ts`                 | Shared utilities — `expectNoA11yViolations`, network waiters, locale switchers. Pure-ish: take a `Page`, do a thing, return data.                             |
| `seed/*.ts`                    | Test-data builders that hit the real backend API to create fresh users / products / reservations. Prefix every name with `e2e-` for prefix-based teardown.    |
| `.auth/`                       | **gitignored** — saved `storageState` JSON written by auth fixtures.                                                                                          |

## Rules of thumb

1. Every test creates its own data, with a unique prefix, and cleans up in `afterEach`/`afterAll`. No shared DB state.
2. Selectors: `getByRole` → `getByLabel` → `getByText` → `data-testid` (last resort).
3. Web-first assertions only (`await expect(locator).toBe...`). Never `waitForTimeout`.
4. Run `expectNoA11yViolations(page)` once per test on the landing view.
5. Don't mock our own code. Mock only the network edge (SMTP, payments, printer) via the backend's test profile.
6. Tests are committed — only outputs (`.auth/`, `playwright-report/`, `test-results/`) are gitignored.

Full ruleset and the HIGH/MED/LOW scenario list: [../docs/E2E-STRATEGY.md](../docs/E2E-STRATEGY.md).

## Running against a DEPLOYED environment

Most suites assume the local dev server + a seeded local backend. Set `E2E_REMOTE=1` to skip booting
`npm run dev` and point the run at a deployed host instead — without it, Playwright still starts a
dev server and waits two minutes on `localhost:3000` before running anything.

```bash
E2E_REMOTE=1 \
E2E_BASE_URL=https://staging.fooderist.com \
E2E_API_BASE_URL=https://staging.fooderist.com \
npx playwright test order-type-availability
```

Only suites that **discover their fixture from the API** can do this — `order-type-availability`
is the reference: it asks which channels the restaurant has enabled and which rows are actually
restricted, then `test.skip()`s, with a stated reason, whatever the environment cannot demonstrate.
A suite that hardcodes product names is a single-environment script.

Two constraints worth knowing before you reach for this:

- **You cannot mix a local UI with a deployed API.** Running `npm run dev` against
  `E2E_API_BASE_URL=https://staging.fooderist.com` fails every browser test: staging's backend sends
  no `Access-Control-Allow-Origin` for `http://localhost:3000`, so the browser blocks the calls and
  the grid never populates (the API-only tests still pass, which makes the failure look stranger
  than it is). That CORS restriction is deliberate — don't widen it for a test run.
- **The deployed environments differ, on purpose.** `staging.fooderist.com` serves **classic** with
  all three channels enabled; `demo.sofrapiwas.com` serves **craft**. Whatever a host's
  `OrderTypeConfiguration/enabled` list says is what its run can prove — if only one channel is
  enabled there is never a "switch to X" target, and those scenarios skip rather than fail.

## Screenshot baseline (visual regression — S15 T1 close-out)

`screenshots/customer-routes.screen.ts` captures the customer-facing surface
(staff/admin is NOT templated in v1) as **committed** `toHaveScreenshot()`
baselines. This is the tenant-templates **T2 gate**: extracting the current
RUMI look into the `classic` template must produce zero diff against them.

**Matrix** — 7 routes (`/`, `/menu`, `/cart` empty, `/checkout/review` via the
guest smart-skip driver, `/reservations`, `/auth/login`, `/auth/register`)
× 2 themes (`html[data-theme]` light/dark, pre-seeded via `rumiTheme` in
localStorage) × 2 viewports (desktop 1280×720, mobile 375×812), full-page →
**28 PNGs per template** in `screenshots/__screenshots__/<template>/<project>/`.

**Per-template baselines (S15 T3 DoD).** `SCREENSHOT_TEMPLATE` (default
`classic`) is baked into the build via `NEXT_PUBLIC_TEMPLATE` and segments the
snapshot path, so each UI template keeps its own baseline set. CI runs one matrix
leg per template (`classic`, `craft`). Regenerate one template's baselines with
`SCREENSHOT_TEMPLATE=craft npm run test:screenshots:docker:update` (then commit
`__screenshots__/craft/`).

**Determinism** (`screenshots/helpers.ts`): frozen clock
(`page.clock.setFixedTime`), `locale en-US` + `TZ UTC`, reduced motion +
animation-kill stylesheet (`screenshots/screenshot.css`), fonts + images +
network-idle waits, cookie-consent pre-accepted, Google Maps/GSI endpoints
neutralised. Data comes from the same seeded backend the functional suite
uses. Tolerance is `maxDiffPixelRatio: 0.001` — do not raise it to hide
flake; fix the determinism instead.

**Platform rule — baselines are LINUX-only.** Font rasterisation differs on
macOS, so captures are taken inside the pinned Playwright image
(`mcr.microsoft.com/playwright:v<@playwright/test version>-noble`); the CI
job runs the comparison inside the same image. The snapshot path template
deliberately omits `{platform}`.

```bash
# One-time stack (same as functional e2e): backend on :5221 + guarded seed
node scripts/e2e-seed.mjs

npm run test:screenshots:docker           # compare against committed baselines
npm run test:screenshots:docker:update    # regenerate baselines (then commit)
```

The suite builds and serves a **production** Next.js bundle on `:3100`
(`webServer` in the config — overwrites your local `.next` when run outside
docker; on macOS the docker script shadows `.next`/`node_modules` with named
volumes). The backend must allow CORS origin `http://localhost:3100`
(the CI workflow sets `CorsSettings__AllowedOrigins__0` accordingly).

`npm run test:screenshots` (host-native, no docker) is for quick iteration on
the _tests themselves_ only — comparisons against committed baselines will
fail on macOS; never `--update-snapshots` from a mac.

**CI**: [.github/workflows/screenshots.yml](../.github/workflows/screenshots.yml)
— a required PR check for `main` and `develop`. Its aggregate status passes only
when both the Classic and Craft template comparisons pass. Failures upload
`*-actual`/`*-diff` PNGs as artifacts. Dispatch with `update_snapshots=true` to
regenerate baselines in CI; inspect and commit the uploaded template baseline
artifact on a branch afterwards.

## P11 isolated table-account journey

Run `bash scripts/dev-e2e-p11.sh` only when an isolated local browser run is intended. It creates a
unique PostgreSQL 16 database and Compose project, a private Compose volume, and distinct high
loopback ports for PostgreSQL, Redis, API, and UI. API settings and the guarded E2E seed helper are
derived from that same database identity; the P11 target guard refuses a shared or remote endpoint.
The mode-0600 run environment contains a fresh 32-byte JWT signing key, with issuer, audience, and
tenant slug bound to that run ID. The run enables only its local feature switches and disables email,
online-provider, and Sentry settings.
The runner resolves `node` from `PATH` by default and requires major version 22; set `NODE22_BIN` to
select a specific Node 22 executable.

The browser journey marks the seeded table ready through the Server UI, opens and closes an empty visit,
verifies the unavailable guest-account state and old code refusal, marks the table ready again through the
Server UI, and starts a second visit. A guest joins with the current code, adds a seeded product through
the real menu and guest-round review, and Server adds four rounds through the real order workspace.
Server then commits one line removal through the amendment review; the test checks its typed Kitchen
delta through the authenticated printer-feed API. Cashier completes a full-balance cash-account
collection and checks the CHF 60.00 exact charge, due, and received amount, zero change, and zero account
outstanding in the rendered UI. Server closes that paid visit, the guest account becomes unavailable,
and Server marks the table ready and opens a distinct third visit. A new guest tab proves the second
visit code is stale, joins using the third visit code, and sees a separate empty CHF account with zero
remaining and no rounds.

The cash receipt is a **synthetic local test record**: the browser enters the isolated cashier's
manual-collection confirmation, but no physical cash changes hands. The run does not start online
checkout, call a payment provider, connect to a printer, or claim a physical print/acknowledgement.
After the browser test starts, its result, private logs, and database dump are kept under
`/tmp/table-account-p11-evidence/<run-id>/`; the dump is made before the runner tears down only its
run-owned Compose volume. If any failure occurs before the database snapshot completes, the runner
keeps that exact volume and private run state for inspection. Treat browser traces and dumps as private
because they include run-issued credentials and table-visit tokens.

The separate connected-payment acceptance uses Stripe test mode and requires a mode-0600 test profile,
an isolated Stripe CLI executable, a clean pinned backend worktree, and Node 22. To run it without
Docker, select the native PostgreSQL 18 path explicitly and provide the installed PostgreSQL and Redis
binary paths:

```bash
export NODE22_BIN="/path/to/node-22/bin/node"
export PATH="$(dirname "$NODE22_BIN"):$PATH"
TMPDIR=/private/tmp "$NODE22_BIN" scripts/dev-e2e-p11-stripe.mjs \
  "$P11_STRIPE_PROFILE" "$P11_BACKEND_DIR" "$P11_STRIPE_CLI" "$P11_BACKEND_SHA" \
  native-pg18 "$P11_POSTGRES18_BIN_DIR" "$P11_REDIS_SERVER"
```

The independent mixed-tender case is a separate run and evidence oracle; it leaves the default
four-phone case unchanged. Append `mixed-tender` as the final argument to select it:

```bash
TMPDIR=/private/tmp "$NODE22_BIN" scripts/dev-e2e-p11-stripe.mjs \
  "$P11_STRIPE_PROFILE" "$P11_BACKEND_DIR" "$P11_STRIPE_CLI" "$P11_BACKEND_SHA" \
  native-pg18 "$P11_POSTGRES18_BIN_DIR" "$P11_REDIS_SERVER" mixed-tender
```

That scenario allocates one CHF 15.00 source unit as CHF 5.01 online and CHF 9.99 exact cash.
The cashier records CHF 10.00 received, including a CHF 0.01 cash-rounding adjustment. A full
void must produce one capture-linked CHF 5.01 Stripe refund and a separately evidenced CHF 10.00
cash return for the CHF 9.99 exact cash allocation, with the CHF 0.01 adjustment and zero net
unsettled balance. Its verifier checks the exact source unit, attempt allocations, collection
receipt-to-refund-intent identity, refund legs, allocation reversals, and fresh connected-account
Stripe reads. The till return is a **synthetic staff attestation in the isolated test database**;
it does not prove physical cash was handed back. This scenario does not change the four-phone
oracle or claim physical cash acceptance.

The runner verifies the test-connected account before creating its run-specific database, then starts
only loopback PostgreSQL/Redis services and the exact pinned local API. It keeps private logs and a
verified operational database dump under `<private-run-state>/stripe-evidence/<run-id>/`, records whether
the run used Compose or native services, and stops only its own API/listener/database/Redis processes.
The run state retains generated credentials and should be treated as private. This runner can create
and fully refund Stripe **test-mode** charges; it does not make live payments.

For coordinated acceptance that needs the same local API after the browser journey, run
`P11_KEEP_RUN=1 bash scripts/dev-e2e-p11.sh`. On success, the runner prints the loopback API address
and a mode-0600 environment profile path, then keeps the API and run-owned Compose services active.
Press Ctrl-C after the connected consumer finishes; the runner stops its API and removes only that
run's Compose project. The profile contains database and test signing credentials: pass its path only
to authorized local acceptance tooling and never print or copy its contents.
