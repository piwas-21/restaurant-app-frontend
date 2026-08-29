# RUMI Frontend — Agent Rules

> Auto-loaded by Claude Code on every session in this repository. These rules apply to ALL code changes in `frontend/`.
> First read on a cold session: this file → [docs/SPRINT-PLAN.md](docs/SPRINT-PLAN.md) (refactor track) + the issue/sprint task you're picking up.

---

## §1 — Identity

- **Stack**: Next.js 15.5 (App Router) · React 19 · TypeScript · CSS Modules · i18next (10 locales)
- **Test**: Jest + React Testing Library (unit) · Playwright (E2E)
- **Hosted on**: GitHub — https://github.com/piwas-21/restaurant-app-frontend
- **Production**: auto-deployed from `main` (merge → `build-image.yml` publishes `:latest` → `deploy.yml` rolls the prod box; per-container Docker healthcheck only — rollback is a manual `workflow_dispatch` to a prior tag). Staging tracks `develop` (`:staging` image). Cutover done 2026-06-30.
- **Backend dependency**: this app talks to the [backend repo](https://github.com/piwas-21/restaurant-app-backend) via `NEXT_PUBLIC_API_URL`. DTO contracts mirror backend `Features/**/Dtos/`.
- **In-flight workspace**: this repo is one of three under [/Users/mahmutkaya/workspace/rumi-workspace/](../). The workspace meta-repo holds cross-repo plans and the master roadmap. When this repo is cloned standalone, only this `CLAUDE.md` is in scope.

## §1.5 — Tooling

- A `PostToolUse` hook ([scripts/check-single-file.mjs](scripts/check-single-file.mjs)) warns on file-length / convention violations right after each edit — act on it.
- Shared skills (`pr-workflow`, `security-review`) + scripts come from the **rumi-agent-kit** plugin — load them on demand (e.g. the `pr-workflow` skill when opening a PR). Infra/deploy work → the `operating-rumi-infra` skill.

## §2 — Critical files to read

| When                                                                                                    | Read                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Any task                                                                                                | This file                                                                                                                                        |
| Refactoring sprint task                                                                                 | [docs/SPRINT-PLAN.md](docs/SPRINT-PLAN.md) — find the task ID, read its acceptance criteria                                                      |
| Design / component patterns                                                                             | [docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md)                                                                                                   |
| Tenant UI template work (`src/templates/`, `@active-template`)                                          | [docs/TEMPLATES.md](docs/TEMPLATES.md) + [ADR-006](docs/adr/ADR-006-tenant-ui-templates.md)                                                      |
| Adding or changing home-page / SEO copy, or any string a tenant might want to differ on                 | [docs/TENANT-COPY.md](docs/TENANT-COPY.md) — the platform bundle is tenant-NEUTRAL; a tenant's own words are a copy pack                         |
| Floor plan — guest map or admin editor (`lib/floorPlan/`, `components/floor-plan/`, `hooks/floorPlan/`) | [docs/FLOOR-PLAN.md](docs/FLOOR-PLAN.md) (the _why_ lives in the workspace [FLOOR-PLAN-REVAMP-PLAN.md](../docs/plans/FLOOR-PLAN-REVAMP-PLAN.md)) |
| Coding conventions                                                                                      | [docs/DEVELOPMENT-GUIDELINES.md](docs/DEVELOPMENT-GUIDELINES.md)                                                                                 |
| Test work                                                                                               | [docs/TEST-COVERAGE-PLAN.md](docs/TEST-COVERAGE-PLAN.md)                                                                                         |
| Adding/changing a Playwright E2E                                                                        | [docs/E2E-STRATEGY.md](docs/E2E-STRATEGY.md) — scope, HIGH/MED/LOW tiers, selector + auth + reliability rules                                    |
| Quality / security gate work                                                                            | §7 below (live gate list + what is planned-but-unbuilt) + workspace [DEV-PHASES-PLAN.md](../docs/plans/DEV-PHASES-PLAN.md) §2                    |
| Security review / threat model                                                                          | [docs/SECURITY-AUDIT.md](docs/SECURITY-AUDIT.md)                                                                                                 |
| Architectural decisions                                                                                 | [docs/adr/README.md](docs/adr/README.md) — index of ADRs                                                                                         |
| Bug or UX item                                                                                          | **this repo's GitHub issues.** The workspace bugs/improvements plan (tracks A–F) was retired by deletion 2026-08-23 — every track verified against this code first, residuals filed as issues. Order types: workspace [ORDER-TYPE-AVAILABILITY-PLAN](../docs/plans/ORDER-TYPE-AVAILABILITY-PLAN.md); `/menu` layout: [MENU-DESIGN-CONFORMANCE-PLAN](../docs/plans/MENU-DESIGN-CONFORMANCE-PLAN.md) |
| Starting a session                                                                                      | Run `npm run lint && npm run build` to establish baseline                                                                                        |

---

## §3 — Architecture

### App Router structure

```
src/
├── app/                          # Next.js App Router routes
│   ├── (route-groups)/
│   ├── api/                      # API route handlers (proxy to backend)
│   ├── layout.tsx                # Root layout — imports @active-template tokens/fonts/Shell
│   └── globals.css               # legacy var aliases + global classes (tokens come via the template)
├── templates/                    # tenant UI templates (ADR-006, docs/TEMPLATES.md)
│   ├── types.ts                  # TemplateDefinition contract
│   └── classic/                  # current RUMI look; selected via NEXT_PUBLIC_TEMPLATE → @active-template alias
├── design-system/
│   └── tokens/                   # semantic design tokens — single source for color values
├── components/                   # Shared UI components
│   ├── design-system/            # BaseModal, FormField, StatusBadge, etc.
│   ├── menu/                     # Feature-area folders
│   ├── cashier/
│   └── ...
├── contexts/                     # React Context providers (Auth, Cart, Theme, etc.)
├── hooks/                        # Custom hooks (page-level logic lives here)
├── lib/                          # apiClient, config, formatters
├── locales/                      # i18next JSON files (10 locales)
├── services/                     # Backend API service files (one per resource)
├── styles/                       # Shared CSS Modules + globals
├── types/                        # TypeScript types/interfaces
└── utils/                        # Pure utility functions
```

### State management — Context API

Active contexts: `AuthContext`, `SessionContext`, `CartContext`, `TableContext`, `CheckoutContext`, `ThemeContext`. See [ADR-001](docs/adr/ADR-001-app-router-context-api.md).

Pages are **thin orchestrators** (≤ 200 LOC). Logic lives in custom hooks (`src/hooks/use*.ts`).

### Styling — CSS Modules + design tokens

- Every component has `<Component>.module.css` colocated.
- Colours come from the **semantic token layer** in `src/design-system/tokens/` (imported by `globals.css`, which also keeps the legacy-name aliases). New code uses the semantic names (`--brand-*`, `--surface-*`, `--text-*`, `--feedback-*`, `--border-*`, `--link-*`, `--status-*`). **Never** hardcode hex values in module CSS. Text tokens are `--text-primary`/`--text-secondary`/`--text-muted` (defined in S15 T1 slice 2; legacy `--text-color`/`--text-secondary-color` alias into them — see DESIGN-SYSTEM.md §2 status note, including the per-element alias-substitution trap for subtree overrides).
- Dark mode via `html[data-theme="dark"]` selector. **Never** `@media (prefers-color-scheme: dark)`. See [ADR-002](docs/adr/ADR-002-css-modules-and-tokens.md).

### Internationalisation — i18next, 10 locales

Locales: `en`, `de`, `tr`, `it`, `ar`, `fr`, `nl`, `es`, `ru`, `zh` (nl added 2026-07-06, PR #126). Every UI string MUST be in `src/locales/<locale>.json`. **Never hardcode UI text** in components.

**Locale parity** is required: every key added to `en.json` must be added to all 9 other locales in the same MR. See [ADR-003](docs/adr/ADR-003-i18next-locale-parity.md).

### Forms — Zod + react-hook-form

Schema-first: define a Zod schema, derive the type with `z.infer`, wire to `react-hook-form` via `@hookform/resolvers/zod`. See [ADR-004](docs/adr/ADR-004-zod-form-validation.md).

### Design-system primitives (mandatory wrappers)

| Component       | Use for                                                                                                                                                                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BaseModal`     | every modal/dialog overlay (no raw `<dialog>`, no headlessui Dialog used directly)                                                                                                                                                                            |
| `FormField`     | every label+input+error grouping                                                                                                                                                                                                                              |
| `StatusBadge`   | every status pill/badge                                                                                                                                                                                                                                       |
| `CheckboxField` | every **new** checkbox — `FormField` puts the label ABOVE the input, which is wrong for a box. The ~65 existing raw `type="checkbox"` inputs are baselined debt; the react-hook-form ones (`{...register(…)}`) cannot migrate until this takes a ref + `name` |
| `ChannelPicker` | the order-type channel checkbox group (composes `CheckboxField`) — one consumer today, see ADR-005                                                                                                                                                            |

See [ADR-005](docs/adr/ADR-005-design-system-primitives.md).

---

## §4 — File length limits

Enforced (blocking) by `scripts/check-file-length.sh` (pre-commit + CI) and warned in-loop by the PostToolUse checker. Max LOC: **page.tsx 200 · `*Modal.tsx` 200 · other `*.tsx` 250 · `use*.ts` hook 200 · `services/`+`lib/` 200 · `types/` 150 · `*.module.css` 200**. Over the limit ⇒ move page logic to a hook, split modals/components/services by concern. Excludes tests/stories/snapshots. Existing violations baselined in `scripts/file-length-baseline.txt`; opt out with `// FILE_LENGTH_EXEMPT: <reason>` (first 5 lines); after a refactor drops a file under limit run `bash scripts/check-file-length.sh --regen-baseline` and commit the baseline.

---

## §5 — Frontend rules (hard)

1. **Pages are orchestrators** — page logic lives in a custom hook; the page component reads from the hook and renders. Max 200 LOC per page.
2. **Modals use `BaseModal`** wrapper. Filename suffix is `Modal` (not `Dialog`).
3. **Forms use `FormField`** for label+input+error pattern.
4. **Status display uses `StatusBadge`** — never inline status pills.
5. **No inline hex colours** in `*.tsx` or `*.module.css` — use CSS variables (semantic tokens in `src/design-system/tokens/`, legacy aliases in `globals.css`). Raw color values belong only in `src/design-system/tokens/` for component CSS; `globals.css` still holds raw values for the not-yet-migrated nav vars + the `.home-overlay-header` subtree overrides (see DESIGN-SYSTEM.md §2 note). Dynamically computed colours (e.g. user avatar bg from hash) are the only exception.
6. **CSS Modules required** — no inline `style={{}}` except for dynamic computed values (positions, dimensions from props).
7. **Dark mode** via `html[data-theme="dark"]` — **never** `@media (prefers-color-scheme: dark)`.
8. **No `: any`** in TypeScript — use `unknown` with type guards. (ESLint rule currently disabled at the config level; will be flipped in Sprint 2 — until then, code review enforces.)
9. **API calls** go through `src/lib/apiClient.ts`, organised by resource in `src/services/<resource>Service.ts`.
10. **Component exports**: `export default function ComponentName(...)` (not arrow functions assigned to consts).
11. **No hardcoded UI text** — every string in `src/locales/*.json`. Locale parity required across all 10 locales.
12. **No hardcoded `process.env.NEXT_PUBLIC_*`** literals scattered across components — read once in `src/lib/config.ts`, export typed constants.
13. **No hardcoded URLs** — backend URL via `NEXT_PUBLIC_API_URL`, image base via `NEXT_PUBLIC_IMAGE_BASE_URL`, etc.
14. **Cross-feature imports** (`src/features/X/` reaching into `src/features/Y/`) are forbidden. Shared code goes in `src/components/` or `src/lib/`.
15. **Which calendar day it is belongs to the RESTAURANT, not the device.** Never derive an operational day from the browser (`new Date().toISOString().split('T')[0]` is the device's _UTC_ day — not even its local one) and send it to the backend: only the server knows the tenant's zone (`Localization:TimeZone`, backend #372). Ask: **`useTenantToday()`** (`GET /api/tenant/today`) is the day the venue is on, and `src/utils/calendarDay.ts` is how to add days to it and label it without a `Date` ever deciding which day it is (#517). Where an endpoint already defaults to the tenant's day, omit the parameter instead and read the day back off the answer (`src/utils/zReportDay.ts`, #511). Falling back to the device is allowed only when the alternative is an empty screen, and then it is the device's **local** day, never `toISOString()`'s. A wire value that is a calendar DAY (midnight UTC) must also be _rendered_ with `timeZone: 'UTC'` — formatting it in the device zone prints the previous day west of UTC. Pin any such test with the timezone environment, never on the runner's ambient zone: on a UTC host (every CI runner and container here) a local-clock implementation and a correct one agree, so the test is a tautology —
    ```
    /**
     * @jest-environment ./jest-environments/timezone.js
     * @jest-environment-options {"timezone": "America/Los_Angeles"}
     */
    ```
    **Both pragmas in ONE docblock** (jest-docblock parses only the first comment, so two blocks drop the options and hand you the ambient zone back — the environment throws rather than let that pass), **assert the premise** inside the suite, and pick the zone by the direction the defect lies in: west of UTC catches a midnight-UTC day formatted on the local clock, east of it catches a local midnight pushed through `toISOString()`. One zone cannot see both, so a value read in two directions needs two suites. The same rule covers the ambient **locale**: `formatBytes`/`toLocaleString` output is the runner's, so match `/^5[.,]6 MB$/`, not `'5.6 MB'`.

---

## §6 — Pre-implementation verification (REQUIRED for non-trivial work)

> Output this checklist BEFORE writing any implementation code. Skipping = restart the task.
> "Non-trivial" = anything beyond a one-line typo / comment fix.

### 1. Backend contract verification (any change consuming a backend API)

For each backend endpoint or DTO referenced, name the source of truth:

- **Backend file**: `backend/RestaurantSystem.Api/Features/<X>/Dtos/<Y>Dto.cs` (or controller signature)
- **Frontend mirror**: `src/services/types/<Y>.ts` (or `src/types/<Y>.ts`)
- Confirm field names + types match. Flag any mismatch as "needs backend MR" before writing frontend code.

### 2. Sibling conventions

List 2–3 sibling files in the directory you're adding to. Note their structure (default export, hook usage, CSS Module naming). Confirm your new file matches.

### 3. Acceptance criteria audit

Quote the relevant criteria from the sprint task / issue. Mark each:

- **Covered fully** (this MR closes it)
- **Partial** (note what's missing, link follow-up)
- **Out of scope** (note where it'll land)

### 4. i18n key audit (any UI string change)

- List every i18n key added or modified.
- Confirm parity: `en.json` ↔ `de.json` ↔ `tr.json` ↔ `it.json` ↔ `ar.json` ↔ `fr.json` ↔ `es.json` ↔ `ru.json` ↔ `zh.json`.
- For RTL locales (`ar`), confirm any layout changes still work (e.g. flex-direction in mirrored components).

### 5. Existing references

Grep for the component / hook / type you're adding or modifying. List every callsite. Confirm each still works after your change OR mark for update in this MR.

### 6. Cross-cutting check

- Does this affect the `backend` repo (DTO contract changes)?
- Does this affect the `printer-app` repo (DTO contracts that may have to mirror backend changes)?
- If yes, flag as "breaking" / "additive" in the MR description.

---

## §7 — Quality gates (all blocking; source of truth `.github/workflows/ci.yml` + `.pre-commit-config.yaml`)

- **Pre-commit / pre-push** (on staged `src/` files): trailing-ws / EOF / large-files / secret-scan / no-commit-to-protected; `prettier --check`; `tsc --noEmit`; `eslint --max-warnings=0`; file-length. On push, `scripts/test-affected.sh` runs Jest `--findRelatedTests` vs `origin/develop` (not a substitute for CI `npm test`).
- **CI**: `npm test` (Jest) + per-file coverage thresholds (`jest.config.js` — pinned per tested file, no fragile global floor); `npm audit` (high+); Gitleaks; njsscan; semgrep; retire.js; `license-checker` (`LICENSES.allowlist`); Trivy **filesystem** scan (misconfig + secrets, `.trivyignore`); **bundle size** (`bundle_size` job: `next build` → `scripts/check-bundle-size.mjs`, fails on any route's gzipped First Load JS growing >10% past `scripts/bundle-size-baseline.json` — DEV-PHASES W2 D2; re-baseline via `--update` when growth is intended); **provider-hostname URLs** (`provider_host_urls` job: `scripts/check-provider-host-urls.mjs`, hard zero — no file in the tree may offer an `https://` URL on a Netcup box's reverse-DNS name, whose zone we do not control, so it can never serve TLS; #559); plus prettier/tsc/eslint/file-length repeated. `npm run build` is still manual pre-commit locally, but now also runs in CI for the bundle gate.
- **Weekly** `security-audit.yml` (cron): deep full-tree scans (npm audit + OSV `-r`, retire.js pinned DB, Trivy fs, license drift) — reporting, not a merge blocker; suppress via `.retireignore.json` with justification.
- **New-dev setup**: `bash scripts/setup_hooks.sh` · `bash scripts/dev-secrets.sh` · `bash scripts/dev-up.sh`.

### Planned but NOT built (carried over from the retired `docs/QUALITY-SECURITY-PLAN.md`, 2026-08-17)

That doc was GitLab-era and is deleted; everything else in it either landed (prettier / eslint
`--max-warnings=0` / `tsc --noEmit` / Jest coverage / Playwright in CI / OSV / gitleaks / TruffleHog /
njsscan / semgrep / license-compliance / weekly `security-audit.yml` / ADRs / dev scripts) or is obsolete
(GitLab CI stages, `.gitlab/` templates, `trivy config` over the gitops manifests — now the deploy repo's
job). These are the items that were planned and are still **not** enforced anywhere:

- **No container-image scan.** There is `trivy_fs` (filesystem) in `ci.yml` and in the weekly sweep, but
  **no Trivy scan of the built image** — `build-image.yml` has no scan step at all. (This §7 previously
  claimed "Trivy image scan"; that claim was wrong and is now corrected.)
- **No bundle/CSP audit after `next build`.** Planned `scripts/check-csp.sh`: fail on source maps shipped
  in `.next/static/`, fail on `sk_live` / `pk_live` / JWT / SMTP-credential strings baked into the bundle.
  The third planned check — a CSP header — _is_ done (`next.config.ts` `headers()`), so only the
  build-output scan is missing.
- **No SBOM artifact.** `cyclonedx-npm` CycloneDX SBOM per build was planned, never wired.
- **No DAST.** OWASP ZAP full-scan against staging + `.zap/rules.tsv` — deferred when staging moved, still open.
- **Forbidden-pattern checks are advisory, not blocking.** `: any` (eslint `no-explicit-any` is `off`),
  inline hex in `style={{}}`, `@media (prefers-color-scheme: dark)`, `*Dialog.tsx` filenames, and
  `process.env.NEXT_PUBLIC_*` outside `src/lib/config.ts` are only **warned** on by the PostToolUse
  `scripts/check-single-file.mjs` and by the review gate. The planned blocking CI job (`check-quality.mjs`)
  was never built — only file-length made it into CI.
- **No full-history secret scan.** Per-PR TruffleHog + gitleaks scan the tree; `--since-commit=root` over
  the whole history was deferred and never scheduled.
- **No `npm outdated` report** (informational artifact, lowest value of this list).

Sonar is not in this list: SonarCloud runs as automatic analysis (its rule IDs are cited throughout the
workflows) and the merge gate blocks on its quality gate — no `sonar-project.properties` is needed.

---

## §8 — Git workflow

### Branch strategy (GitFlow — updated 2026-07-10; supersedes the retired 2026-06-30 main-based model)

```
develop                 ← DEFAULT + integration branch; all feature work targets it
  ├── feature/<x>       → PR to develop
  ├── fix/<x>           → PR to develop
  ├── chore/<x>         → PR to develop
  └── docs/<x>          → PR to develop

main                    ← production RELEASES ONLY; updated solely via a develop→main release PR
```

- **Never push directly to `main` or `develop`** — a GitHub **Ruleset** (`main-develop`, **no bypass**) blocks it server-side (direct push / force-push / deletion), and the pre-commit `no-commit-to-branch` hook blocks it locally. Always open a PR.
- **Branch off `develop`; open every `feature/`·`fix/`·`chore/`·`docs/`·`test/` PR to `develop`.** Merge only when **all CI checks are green and review comments are resolved** (the ruleset requires it).
- **Releases:** open a PR **`develop` → `main`**. Merging it is the release — a merge to `main` auto-builds + deploys to prod. A merge to `develop` publishes the `:staging` image (staging tracks develop).
- One issue = one branch. Delete branch after merge (`gh pr merge --delete-branch`).
- Branch naming: `feature/`, `fix/`, `chore/`, `docs/`, `test/`.

### Commit messages

Format: `type(scope): description`. Same convention as backend (see backend `CLAUDE.md` §8 for the type table).

### Merge requests

Every PR uses [.github/pull_request_template.md](.github/pull_request_template.md). Required sections: summary, sprint-task link, acceptance-criteria coverage, backend-contract verification + i18n parity (where applicable), standard checklist, test plan, deploy notes.

### Traps in THIS clone (each has already cost an agent an hour — read before your first commit)

These are properties of the working copy, not of the code. All four are **silent**: the failing command exits `0`, or the tree looks right and only the history is wrong.

- **`detect-secrets` never converges by re-committing.** pre-commit hands the hook its files in **batches**, and each invocation rewrites the whole `.secrets.baseline` from its own partial view, clobbering the last batch's line numbers. A commit touching many files therefore fails with *"files were modified by this hook"*, you stage the baseline, and it fails again on a **different** slice — each round paying for a full `tsc` + `eslint` + `jest-affected` run. Do **not** loop. Run the hook's own binary once over the whole repo, confirm it is idempotent, then stage and commit:
  ```bash
  DS=$(ls ~/.cache/pre-commit/*/py_env-*/bin/detect-secrets | head -1)   # there is no project-level detect-secrets
  "$DS" scan --baseline .secrets.baseline
  cp .secrets.baseline /tmp/sb1 && "$DS" scan --baseline .secrets.baseline   # second run must be a no-op
  # `generated_at` always changes — compare with that key removed before believing it settled
  git add .secrets.baseline
  ```

- **Sparse-checkout is PER-WORKTREE here and can eat your inputs.** `extensions.worktreeConfig=true` is set, so `core.sparseCheckout` lives in `.git/worktrees/<name>/config.worktree` and is **invisible from the shared clone's config**. When it is on with a stray pattern, two things happen and neither reports an error: `git add -A` stages **nothing** while exiting `0` (tell: `git status` still shows ` M`), and whole directories are **absent from disk** — a sibling found `Persistence/Migrations/` missing in a backend worktree, so any `dotnet ef` command there would have run against an invisible folder. That second mode is the dangerous one, because it silently changes what you *conclude*: a review against a partial file set, or a "this file does not exist" finding that is merely hidden. Check both, and check the second whenever your work **read files** rather than only running git:
  ```bash
  git config core.sparseCheckout && git sparse-checkout list        # want: false / "not sparse"
  comm -23 <(git ls-files | sort) <(find . -type f | sed 's|^\./||' | sort)   # want: empty
  ```
  Fix in **your** worktree (not the shared clone): `git sparse-checkout disable`. Declare it if you run it.

  **Three further modes, measured 2026-08-29 (backend#447 / frontend#630 / frontend#631).** (a) **A `git rebase` RE-APPLIES the
  pattern and deletes the excluded tree from disk** — `src/` vanished mid-PR — and the commits are untouched, so
  `git status` is clean and `git log` is right. What follows is the worst failure mode on this list: **every gate
  then passes VACUOUSLY.** `jest` reported *"13 files checked … 0 matches"* and exited `1`; `tsc`, `eslint`,
  `prettier --check` and the locale gate all exited `0` because there was nothing left to check. A green that means
  "I found nothing" is indistinguishable from a green that means "I found it and it is fine" — so after ANY rebase
  in a worktree, read the test COUNT, not the exit code (`Tests: 4403 passed` vs `13 files checked`), and re-run the
  gates once the tree is restored. (b) For a file that is **already tracked**, `git add` does not silently stage
  nothing — it **refuses out loud** (*"paths … outside of your sparse-checkout definition"*) and points at
  `--sparse`. `git add --sparse <path>` is the one-file workaround; the silent-`git add -A` mode above is the
  UNTRACKED case. Both come from the same setting, and the loud one is the lucky one. (c) **It can be turned back
  ON mid-session by ANOTHER agent, so disabling it once at session start is NOT sufficient** — the setting lives on
  a resource other processes write (frontend#631: disabled and verified at session start, true again hours later in
  the shared `.git/config` AND in `config.worktree`, with a cone nobody working here had asked for; the next
  `git checkout` then stripped `src/` and `scripts/`). Same family as the shared-index trap in the workspace
  CLAUDE.md §2b-i, and it hides the same way: **`git status` is EMPTY and the tree reads CLEAN**, because sparse
  paths are skip-worktree, not deleted. It surfaces as **a lie from an UNRELATED tool** — `node scripts/x.mjs` →
  *"Cannot find module …"*, `next build` → *"ENOENT: scandir 'src/templates'"* — and **nothing anywhere prints the
  word `sparse`**. The tell is that **`ls src` fails while `git log` and `git show --stat HEAD` are intact**. So the
  assertion belongs beside every gate, not at the top of the session: **assert the tree before trusting ANY green** —
  `test -d src/templates` here, `test -d RestaurantSystem.Api` in the backend — because a gate that passes because
  it found NOTHING is worse than a gate that fails. Measuring a base ref in a SEPARATE worktree is stronger than
  `git checkout --detach HEAD~1` in your own: every checkout is a chance for someone else's config to be applied to
  your tree.

- **`core.fsmonitor=false` is deliberate — leave it off.** It is set on the shared clone to stop watchman cookie races from failing `git add`. Turning it on to speed up `git status` reintroduces intermittent, unreproducible staging failures.

- **Never `git commit --amend` during a CONFLICTED rebase.** While a rebase is stopped on a conflict, `HEAD` is the **new base** — your commit does not exist yet — so the amend rewrites the **upstream tip**, replacing an already-merged PR's commit with your tree and message. `git rebase --continue` then prints *"Successfully rebased"* and exits `0`. The resulting tree is correct and `git log` looks plausible; only the history is wrong. Verify after **every** conflicted rebase, and fix without losing work:
  ```bash
  git merge-base --is-ancestor origin/develop HEAD && echo OK || echo CLOBBERED
  git reset --soft <upstream-sha> && git commit -F <msg>   # the index already holds the right tree
  ```
  When you check *which* commit is yours, discriminate by **commit message and file list — never by author**. The whole fleet commits under one identity (`mahmutkaya <mahmutkaya.nl@gmail.com>`), so `git log --author` returns every agent's work; a sibling nearly claimed another agent's commit by trusting it.

---

## §9 — AI guardrails (refusal list)

Never auto-edit these files / take these actions without explicit user instruction:

### Hard refusals

- **`next.config.ts` security headers** (CSP, frame-options, HSTS). Changing these can break the production deployment in subtle ways. Treat as a deploy event, not a code change.
- **Major version bumps** of `next`, `react`, `react-dom` in `package.json`. Breaking-changes class — coordinated upgrade only.
- **Playwright golden snapshots** (`e2e/screenshots/__screenshots__/`, or any `*-snapshots/` dir) — never hand-edit; only regenerate via the documented update command (`npm run test:screenshots:docker:update` — baselines are linux-only, see `e2e/README.md`).
- **`src/locales/*.json` for languages the agent doesn't read** (typically `ar`, `ru`, `zh`). Adding/removing keys is fine (locale parity), but **rephrasing existing translations** in those locales requires a human translator or explicit user instruction.
- **Branch protection bypass**: never `git commit --no-verify`, `git push --force-with-lease` to `develop`/`main`, `git reset --hard` on `develop`/`main`.

### Cross-repo coordination required

- **Backend DTO contract changes** — affects `src/services/types/` and any consumer. Before modifying a frontend type that mirrors a backend DTO, grep usages and flag the cross-repo coordination in the MR.

### Sensitive-file refusal (matches gitleaks/detect-secrets allowlist)

Never commit:

- `.env.local`, `.env.development.local`, `.env.test.local`, `.env.production.local` — gitignored; if missing, flag, don't fabricate
- `*.pem`, `*.key`, `*.pfx`, `*.p12`, `*.cer`
- Any file matching `*secret*`, `*credentials*`

**Intentionally-tracked env files (do NOT delete; do NOT add secrets to):**

- `.env.example` — template that `scripts/dev-secrets.sh` copies into `.env.local`. `NEXT_PUBLIC_*` defaults + empty placeholders for per-developer credentials (`ADMIN` / `CASHIER` / `CUSTOMER`).
- `.env.production` — public deploy-time defaults for the production build. Only `NEXT_PUBLIC_*` values, **never** secrets. Whitelisted in `.gitignore` via `!.env.production`. If you need to add a runtime secret to production, that's a K8s/ArgoCD config change, not a code change to this file.

Bare `.env` is gitignored — credentials live in `.env.local` (per-developer, gitignored).

---

## §10 — Session workflow

### Starting

1. Read this file (auto-loaded).
2. Read [docs/SPRINT-PLAN.md](docs/SPRINT-PLAN.md) if picking up a refactor task.
3. Read the relevant ADR if working on a load-bearing pattern (state mgmt, styling, i18n, forms, design system).
4. Run `npm run lint && npm run build` — confirm baseline green.
5. Check `git status` — start from a clean tree on `main`.

### During implementation

1. Output the §6 verification block before writing code.
2. After non-trivial changes, run `npm run lint` (catches type / hook / import errors fast).
3. Use design-system primitives: `BaseModal`, `FormField`, `StatusBadge`.
4. Read translation values from `t('key')`, never hardcode strings. Add the key to all 10 locales in the same change.
5. Read env vars via `src/lib/config.ts`, never `process.env.NEXT_PUBLIC_*` scattered.

### Before ending

1. `npm run lint` → 0 errors.
2. `npm run build` → succeeds.
3. `npm test` → all passing.
4. `git status` → only intentional changes staged.
5. Commit with `type(scope):` format.
6. Push to feature branch.
7. Open PR via `gh pr create` (or GitHub UI) — fill template fully, including i18n parity confirmation.
