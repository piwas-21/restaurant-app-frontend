# RUMI Frontend — Playwright E2E

Authoritative strategy: [../docs/E2E-STRATEGY.md](../docs/E2E-STRATEGY.md). Read it first.

This directory is the test code. The runner config is [../playwright.config.ts](../playwright.config.ts).

## Quickstart

**First-run bootstrap** (once per checkout):

```bash
npm run test:e2e:install                        # installs the browser binary
export E2E_DATABASE_URL=postgres://postgres:postgres123@localhost:5432/restaurantdb  # pragma: allowlist secret
```

The DB URL has no committed default — set it in your shell or `.env.local` so
gitleaks stays happy. The example above uses the dev-compose Postgres password
purely as a placeholder; replace with your local creds.

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
# One-time stack (same as functional e2e): backend on :5221 + seed applied
psql "$E2E_DATABASE_URL" -v ON_ERROR_STOP=1 -f e2e/seed/seed.sql

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
— separate, non-required workflow (non-blocking while it beds in) on PRs +
`workflow_dispatch`. Failures upload `*-actual`/`*-diff` PNGs as artifacts.
Dispatch with `update_snapshots=true` to regenerate baselines in CI and
download them as an artifact (commit them on a branch afterwards).
