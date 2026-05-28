# Frontend — Quality & Security Hardening Plan

Stack: **Next.js 15.5**, **React 19**, **TypeScript**, **CSS Modules**, **i18next** (9 locales), **Jest + RTL**, **Playwright**. Hosted on GitLab.

> Read [/QUALITY-SECURITY-PLAN.md](../../docs/plans/QUALITY-SECURITY-PLAN.md) first. This document only adds the JS/TS-specific tasks.

---

## 0. Current state

- `.gitlab-ci.yml` (142 lines): `npm test`, `npm audit --audit-level=high` (blocking), gitleaks, **njsscan**, **semgrep p/javascript**, **retire.js**, `docker build`, deploy trigger, `trivy image` (allow_failure)
- ESLint config exists (`eslint.config.mjs`) but not gated in CI
- No Prettier check, no `tsc --noEmit` gate, no Jest coverage threshold, no Playwright in CI
- No SonarCloud
- No CSP audit on the built bundle (DeelMarkt's web-security pattern is missing)

## 1. Tooling decisions

| Concern | Tool | Why |
|---|---|---|
| Format | Prettier | already de facto on this stack |
| Lint | ESLint flat config (existing) — flip `--max-warnings=0` | block warning drift |
| Type-check | `tsc --noEmit` | catches errors lint can't |
| Test | Jest + RTL (existing) | already adopted |
| E2E | Playwright (existing) — add smoke job to CI | regression net |
| Coverage | Jest's built-in (Istanbul) → `lcov.info` | feeds SonarCloud + GitLab MR |
| SCA | npm audit (existing) + OSV-Scanner | npm audit alone misses non-npm advisories |
| SBOM | `cyclonedx-npm` | CycloneDX 1.5 SBOM artifact |
| SAST | semgrep (existing) + SonarCloud | quality gate |
| DAST | OWASP ZAP (full-scan, scheduled, against staging) | match DeelMarkt parity |
| Secret scan | gitleaks (existing) + detect-secrets (pre-commit) | belt + suspenders |
| CSP / bundle audit | custom shell script in CI | mirrors DeelMarkt's `web-security` job |

Drop `retire.js` from the **per-PR** pipeline once OSV-Scanner + npm audit are wired (redundant there — all three read the same lockfile, and retire.js is the least-maintained of them). **Retain it in the weekly full-tree sweep (§6)**: there it fingerprints vulnerable library *code* in `node_modules` / bundled JS, a surface that lockfile-based scanners (OSV, npm audit) never inspect. Keep `njsscan` as cheap layered defence.

## 2. Repository-level changes

### 2.1 `package.json` scripts to add
```json
"format": "prettier --check .",
"format:fix": "prettier --write .",
"lint:strict": "next lint --max-warnings=0",
"typecheck": "tsc --noEmit",
"test:ci": "jest --ci --coverage --coverageReporters=lcov --coverageReporters=text-summary",
"test:e2e:ci": "playwright test --reporter=junit"
```

### 2.2 Coverage thresholds (`jest.config.js`)
**Landed (issue #21, 2026-05).** CI `npm_test` job now runs `npm test -- --ci --runInBand --coverage`, which activates `coverageThreshold` in `jest.config.js`:
```js
coverageThreshold: {
  global: { branches: 0.3, functions: 0.4, lines: 0.3, statements: 0.3 }
}
```
Pinned at the current honest floor (baseline measured 2026-05: stmts 0.38 / branch 0.32 / funcs 0.43 / lines 0.32). Mirrors backend coverlet gate pattern. Ratchet upward as test coverage grows — see jest.config.js header comment for the procedure.

### 2.3 File-length / pattern checker
Port of DeelMarkt's `check_quality.dart`. Add `scripts/check-quality.mjs` enforcing [CLAUDE.md](../../CLAUDE.md):
- Page component > 200 LOC
- UI component (`*.tsx`) > 250 LOC
- Modal > 200 LOC
- Custom hook > 200 LOC
- Service file > 200 LOC
- Type/interface file > 150 LOC
- CSS module > 200 LOC

Forbidden-pattern checks (grep-style):
- `: any` in `*.ts`/`*.tsx` outside `*.test.*`/`*.d.ts`
- inline `style={{ color: '#` in `*.tsx`
- `@media (prefers-color-scheme: dark)` (rule §8 — must use `html[data-theme="dark"]`)
- `Dialog` in component file names (rule §7 — must be `Modal`)
- `process.env.NEXT_PUBLIC_*` accessed outside `src/lib/config.ts` (centralise env reads)

### 2.4 CSP audit script (`scripts/check-csp.sh`)
Run after `next build` against `.next/`:
- Fail on source-maps in `.next/static/`
- Fail on inline strings matching `sk_live`, `pk_live`, `gAA`, JWT, SMTP-creds patterns
- Warn if no CSP header configured in `next.config.ts` (mirrors DeelMarkt's web-security job)

## 3. Pre-commit hooks

`.pre-commit-config.yaml` (in `frontend/`) — adds these `local` hooks on top of the cross-repo general+secrets sections:

```yaml
- id: prettier
  name: prettier --check
  language: system
  entry: bash -c 'npx prettier --check $(git diff --cached --name-only --diff-filter=ACM | grep -E "\.(ts|tsx|js|mjs|json|css|md)$" | tr "\n" " ")'
  pass_filenames: false
  files: \.(ts|tsx|js|mjs|json|css|md)$
  stages: [pre-commit]

- id: eslint
  name: eslint --max-warnings=0
  language: system
  entry: bash -c 'npx next lint --max-warnings=0'
  pass_filenames: false
  files: \.(ts|tsx|js|mjs)$
  stages: [pre-commit]

- id: typecheck
  name: tsc --noEmit
  language: system
  entry: bash -c 'npx tsc --noEmit'
  pass_filenames: false
  files: \.(ts|tsx)$
  stages: [pre-commit]

- id: quality-rules
  name: frontend file-length / pattern rules
  language: system
  entry: node scripts/check-quality.mjs
  pass_filenames: false
  files: \.(ts|tsx|css|module\.css)$
  stages: [pre-commit]

# Pre-push only — slower
- id: jest-affected
  name: jest --findRelatedTests
  language: system
  entry: bash -c 'CHANGED=$(git diff --name-only origin/$(git rev-parse --abbrev-ref HEAD) HEAD -- "src/**/*.ts" "src/**/*.tsx"); [ -z "$CHANGED" ] || npx jest --findRelatedTests $CHANGED --passWithNoTests'
  pass_filenames: false
  files: \.(ts|tsx)$
  stages: [pre-push]

- id: npm-audit
  name: npm audit --audit-level=high
  language: system
  entry: bash -c 'npm audit --audit-level=high --omit=dev'
  pass_filenames: false
  files: package(-lock)?\.json$
  stages: [pre-push]
```

`detect-secrets` baseline scan paths: `src/`, `public/`, `scripts/`, `*.config.{ts,mjs,js}`.

## 4. GitLab CI

Replace the existing `.gitlab-ci.yml` (use the existing as base — most changes are additions, not replacements).

### Stages
```
lint → test → security → sast → build → scan → deploy_pipeline
```

### New / changed jobs

| Stage | Job | Image | Blocking? | Notes |
|---|---|---|---|---|
| lint | `format` (prettier --check) | `node:20-bullseye@sha256:...` | yes | new |
| lint | `lint` (`next lint --max-warnings=0`) | node:20 | yes | new |
| lint | `typecheck` (`tsc --noEmit`) | node:20 | yes | new |
| lint | `quality-rules` (file-length + patterns) | node:20 | yes | new |
| test | `unit` (existing `npm_test` → run `test:ci`, emit lcov + junit) | node:20 | yes | upgrade |
| test | `e2e-smoke` (Playwright) | `mcr.microsoft.com/playwright:v1.56.1@sha256:...` | yes | new |
| security | `npm-audit` (existing — keep blocking) | node:20 | yes | rename `npm_audit` → `npm-audit`; drop `retire` from per-PR (retained weekly — see §6) |
| security | `gitleaks` (existing) | `zricethezav/gitleaks@sha256:...` | yes | pin digest |
| security | `njsscan` (existing) | `python:3.12-slim@sha256:...` | yes | pin digest |
| security | `osv-scanner` (lockfile) | `ghcr.io/google/osv-scanner@sha256:...` | yes | new |
| security | `sbom` (`cyclonedx-npm`) | node:20 | no, artifact | new |
| security | `trivy-fs` | aquasec/trivy | yes | new |
| sast | `semgrep` (existing) | `returntocorp/semgrep@sha256:...` | yes | pin digest |
| sast | `sonarcloud` | `sonarsource/sonar-scanner-cli@sha256:...` | yes (quality gate) | new |
| build | `build_image` (existing) | docker:24 | yes | move build args to CI variables |
| build | `csp-audit` (post-`next build` checks) | node:20 | yes | new |
| scan | `trivy_image` (existing — flip to `exit-code: 1`) | docker:24 | yes | upgrade |

### Coverage report wiring
```yaml
unit:
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml
      junit: junit.xml
    paths:
      - coverage/
    expire_in: 7 days
```

### Hardcoded secrets in current build args
```yaml
docker build
  --build-arg NEXT_PUBLIC_API_URL=https://www.rumirestaurant.ch
  --build-arg NEXT_PUBLIC_GOOGLE_CLIENT_ID=102252528656-3quqh29v8b7psntuo04r7duambcs1i0t.apps.googleusercontent.com
```
The Google Client ID is a public OAuth identifier (low risk) but **must move to CI variables** for parity with envs and to avoid drift between branches.

## 5. SonarCloud config (`frontend/sonar-project.properties`)

```
sonar.projectKey=rumi_frontend
sonar.organization=<rumi-org>
sonar.sources=src
sonar.tests=src
sonar.test.inclusions=**/*.test.ts,**/*.test.tsx,**/*.spec.ts
sonar.javascript.lcov.reportPaths=coverage/lcov.info
sonar.exclusions=\
  **/*.test.ts,**/*.test.tsx,**/*.spec.ts,\
  **/*.d.ts,\
  src/i18n/locales/**,\
  public/**,\
  .next/**
sonar.coverage.exclusions=\
  src/app/layout.tsx,\
  src/middleware.ts,\
  src/i18n/**,\
  **/*.config.{ts,js,mjs}
```
Quality gate: A-rating, ≥ 70% new-code coverage, no new vulnerabilities.

## 6. Weekly scheduled pipeline

**Landed (issue #19, 2026-05).** Implemented as `.github/workflows/security-audit.yml` — cron `0 6 * * 1` (Mondays 06:00 UTC) + `workflow_dispatch`, `permissions: contents: read`, all actions SHA-pinned to match `ci.yml`. This is a **reporting/alerting** gate: the scheduled run fails (red ❌ on the Actions tab) on any finding, but it has no PR context so it blocks no merge. Triage the finding, then bump the dep or add a scoped, justified suppression (same policy as the per-PR gate). No issue/Slack write automation is wired in — keeps the workflow read-only with no injection surface.

Why it adds value beyond per-PR CI: the per-PR jobs scan the diff / current tree once, so a CVE disclosed *after* a dependency was merged is never re-checked. The weekly run re-scans the **unchanged committed lockfile** (npm audit + OSV) and does a full-tree sweep, surfacing newly-disclosed CVEs and scan-tool DB drift without needing a PR.

Jobs that landed:
- **npm audit (high+)** — re-checks the same committed lockfile against today's advisory DB.
- **OSV-Scanner** — full-tree (`-r`) dependency CVE scan (broader than the per-PR single-`--lockfile` job).
- **retire.js** — full JS/`node_modules` scan (`retire@5.2.7`, `--severity high`). Distinct from npm audit / OSV above: those read the lockfile, whereas retire.js fingerprints vulnerable library *code* in installed/bundled JS — so it's dropped from per-PR CI (§4) as lockfile-redundant but kept here for the surface only a content scan covers.
- **Trivy fs** — HIGH/CRITICAL filesystem scan.
- **license-compliance** — drift re-check, mirrors the per-PR `license_compliance` job verbatim (`license-checker-rseidelsohn@4.3.0`, production scope, `LICENSES.allowlist`).
- **audit_summary** — aggregates the five results into the run summary and fails the run if any scan failed.

Deferred (not in scope for #19; tracked for a later sweep):
- TruffleHog full-history secret scan (`--since-commit=root`) — adds value but needs `fetch-depth: 0` + careful tuning to avoid noise.
- `npm outdated` → artifact (best-effort, informational).
- **OWASP ZAP full-scan** against `$STAGING_URL` — DAST, mirrors DeelMarkt's `zap-scan`; deferred until the new staging deploy lands.
- `trivy config` over the deploy manifests — moves with the new deploy stack (legacy `rumi-argocd-gitops` being replaced).

## 7. Phased task breakdown

### Sprint 1 (hygiene + dev-experience baseline)
1. Commit cross-repo `.pre-commit-config.yaml` (general + secrets)
2. Generate `.secrets.baseline`, list paths in `.secrets-scan-paths` (`src/`, `public/`, `scripts/`)
3. Add `scripts/setup_hooks.sh`
4. Move hardcoded build args to GitLab CI variables (`NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_IMAGE_BASE_URL`)
5. Document branch protection in `frontend/README.md`
6. Add `.gitlab/merge_request_templates/Default.md` — Schema/Contract Verification section names: backend DTO files consumed (path under `backend/RestaurantSystem.Api/Features/**/Dtos/`), service-type files mirroring them under `src/services/types/`, i18n keys added with locale-parity confirmation table (en + de + tr + it + ar + fr + es + ru + zh)
7. Add `scripts/dev-up.sh` + `dev-down.sh` + `dev-secrets.sh`. `dev-up.sh` orchestrates: health-check `$NEXT_PUBLIC_API_URL/health` (fail fast with friendly "is backend dev-up?" message) → ensure `.env.local` exists (template from `.env.example`, never overwrite without backup) → `npm install` only when `package-lock.json` SHA changed → `npm run dev`. `--no-run` skips the dev server.
8. Update `frontend/README.md` with one-liner: `bash scripts/setup_hooks.sh && bash scripts/dev-up.sh`
9. Create `docs/adr/` + `ADR-template.md` + `README.md` index. Backfill ADRs:
   - **ADR-001** App Router + Context API for state (vs Redux / Zustand) — why this works for RUMI's session-scoped state
   - **ADR-002** CSS Modules (vs Tailwind / styled-components) — design-token discipline, dark-mode strategy via `html[data-theme]`
   - **ADR-003** i18next + 9 locales (vs next-intl) — why, and the locale-parity rule
   - (ADR-004 and ADR-005 land in Sprint 2)

### Sprint 2 (format + lint + types + reusable CI templates)
10. Add Prettier config + ignore file; commit `format`/`format:fix`/`lint:strict`/`typecheck` scripts
11. Add `scripts/check-quality.mjs` enforcing CLAUDE.md rules + forbidden patterns
12. Add Prettier / ESLint / tsc / quality-rules pre-commit hooks
13. **Add `.gitlab/ci/setup-node.yml`** with `.setup-node` job template: pinned `node:20-bullseye@sha256:...`, npm cache (`~/.npm` keyed by `package-lock.json` hash), `npm ci`. `include:` it from `.gitlab-ci.yml`.
14. Add `lint` stage with 4 jobs to `.gitlab-ci.yml` — all using `extends: .setup-node`
15. Refactor existing jobs (`npm_test`, `npm_audit`) to also use `extends: .setup-node` (drops 6 lines of duplication per job)
16. Pin all remaining images in `.gitlab-ci.yml` by digest
17. Drop `retire` job from per-PR CI (redundant with OSV on the lockfile; retained in the weekly full-tree sweep — see §6)
18. Backfill remaining ADRs:
   - **ADR-004** Zod as form-validation source of truth — schema-first pattern, error-message i18n strategy
   - **ADR-005** BaseModal / FormField / StatusBadge as design-system primitives — why these three are mandatory wrappers (not just preferred)

### Sprint 3 (test + coverage + SAST + Sonar)
12. Wire Jest coverage thresholds (start at current floor)
13. Replace `npm_test` job with `unit` running `test:ci`, emitting lcov + junit + cobertura
14. Add `e2e-smoke` Playwright job (golden-path scenarios only)
15. Add `scripts/check-csp.sh` + `csp-audit` job
16. Create SonarCloud project, commit `sonar-project.properties`
17. Add `sonarcloud` SAST job; enable MR decoration
18. Add new-code coverage pre-push hook (lcov diff vs base branch)

### Sprint 4 (deep security)
19. Add `osv-scanner`, `trivy-fs`, `sbom` (cyclonedx-npm) jobs
20. Flip `trivy image` from `allow_failure: true` to blocking
21. Add weekly schedule pipeline (TruffleHog full, OSV JSON, npm outdated, license-checker, sensitive-file audit, ZAP full-scan)
22. Author / port `.zap/rules.tsv` for the staging environment
23. Add `trivy config` over the gitops manifests

## 8. Acceptance criteria

- [ ] `pre-commit run --all-files` green from a clean checkout
- [ ] MR pipeline blocks on: format, lint, typecheck, quality-rules, unit tests, e2e smoke, npm-audit High+, OSV CVE, SonarCloud quality gate
- [ ] `npm run lint:strict && npm run typecheck && npm run test:ci` succeeds locally
- [ ] No `: any`, no inline hex colors in `*.tsx`, no `@media (prefers-color-scheme: dark)`, no `Dialog` filenames (enforced by `check-quality.mjs`)
- [ ] No `NEXT_PUBLIC_*` literal in `.gitlab-ci.yml` build args — all via CI variables
- [ ] Weekly pipeline produces SBOM, OSV JSON, outdated-deps, license audit, ZAP report
- [ ] No floating image tags in `.gitlab-ci.yml`
