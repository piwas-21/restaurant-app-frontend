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

| When | Read |
|---|---|
| Any task | This file |
| Refactoring sprint task | [docs/SPRINT-PLAN.md](docs/SPRINT-PLAN.md) — find the task ID, read its acceptance criteria |
| Design / component patterns | [docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md) |
| Coding conventions | [docs/DEVELOPMENT-GUIDELINES.md](docs/DEVELOPMENT-GUIDELINES.md) |
| Test work | [docs/TEST-COVERAGE-PLAN.md](docs/TEST-COVERAGE-PLAN.md) |
| Adding/changing a Playwright E2E | [docs/E2E-STRATEGY.md](docs/E2E-STRATEGY.md) — scope, HIGH/MED/LOW tiers, selector + auth + reliability rules |
| Quality / security gate work | [docs/QUALITY-SECURITY-PLAN.md](docs/QUALITY-SECURITY-PLAN.md) |
| Security review / threat model | [docs/SECURITY-AUDIT.md](docs/SECURITY-AUDIT.md) |
| Architectural decisions | [docs/adr/README.md](docs/adr/README.md) — index of ADRs |
| Bug or UX item | [../docs/plans/BUGS-IMPROVEMENTS-PLAN.md](../docs/plans/BUGS-IMPROVEMENTS-PLAN.md) (workspace meta-repo) — Track A/B/C items |
| Starting a session | Run `npm run lint && npm run build` to establish baseline |

---

## §3 — Architecture

### App Router structure

```
src/
├── app/                          # Next.js App Router routes
│   ├── (route-groups)/
│   ├── api/                      # API route handlers (proxy to backend)
│   ├── layout.tsx                # Root layout
│   └── globals.css               # imports design-system/tokens + legacy var aliases
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

| Component | Use for |
|---|---|
| `BaseModal` | every modal/dialog overlay (no raw `<dialog>`, no headlessui Dialog used directly) |
| `FormField` | every label+input+error grouping |
| `StatusBadge` | every status pill/badge |

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
- **CI**: `npm test` (Jest) + per-file coverage thresholds (`jest.config.js` — pinned per tested file, no fragile global floor); `npm audit` (high+); Gitleaks; njsscan; semgrep; retire.js; `license-checker` (`LICENSES.allowlist`); Trivy image scan (zero HIGH/CRITICAL, `.trivyignore`); plus prettier/tsc/eslint/file-length repeated. `npm run build` is manual pre-commit.
- **Weekly** `security-audit.yml` (cron): deep full-tree scans (npm audit + OSV `-r`, retire.js pinned DB, Trivy fs, license drift) — reporting, not a merge blocker; suppress via `.retireignore.json` with justification.
- **New-dev setup**: `bash scripts/setup_hooks.sh` · `bash scripts/dev-secrets.sh` · `bash scripts/dev-up.sh`.

---

## §8 — Git workflow

### Branch strategy

```
main                    ← production (auto-deploys on merge since 2026-06-30)
  ├── feature/<x> …     ← branch off main, PR to main
  └── develop           ← staging channel (`:staging` image; kept in sync via main→develop back-merges)
```

- **Never push to `main` or `develop` directly** — pre-commit hook blocks this.
- Branch off **`main`**. Open PR to **`main`** (merging = prod deploy — treat every merge as a release). Use `develop` only to stage something on the test env before prod, then promote; back-merge `main`→`develop` afterwards to keep the branches converged.
- Branch naming: `feature/`, `fix/`, `chore/`, `docs/`, `test/`.

### Commit messages

Format: `type(scope): description`. Same convention as backend (see backend `CLAUDE.md` §8 for the type table).

### Merge requests

Every PR uses [.github/pull_request_template.md](.github/pull_request_template.md). Required sections: summary, sprint-task link, acceptance-criteria coverage, backend-contract verification + i18n parity (where applicable), standard checklist, test plan, deploy notes.

---

## §9 — AI guardrails (refusal list)

Never auto-edit these files / take these actions without explicit user instruction:

### Hard refusals
- **`next.config.ts` security headers** (CSP, frame-options, HSTS). Changing these can break the production deployment in subtle ways. Treat as a deploy event, not a code change.
- **Major version bumps** of `next`, `react`, `react-dom` in `package.json`. Breaking-changes class — coordinated upgrade only.
- **Playwright golden snapshots** in `tests/**/*-snapshots/` — never hand-edit; only regenerate via explicit `npx playwright test --update-snapshots`.
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
