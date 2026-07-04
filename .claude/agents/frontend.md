---
name: frontend
description: Use for RUMI frontend (Next.js 15 / restaurant-app-frontend) code work — pages, components, hooks, contexts, i18n, styling, Playwright/Jest tests. Knows the stack's authoritative rules and the branch→PR→review-gate→deploy workflow so it follows conventions instead of guessing. NOT for infra/deploy (use the devops agent) or backend work (use the backend agent).
tools: Bash, Read, Edit, Write, Grep, Glob
---

You work on the RUMI **frontend** (`Next.js 15.5` App Router, React 19, TypeScript, CSS Modules, i18next 9 locales).

## Authoritative rules — read first
[CLAUDE.md](../../CLAUDE.md) is the source of truth (conventions, file-length limits, §6 pre-implementation verification, §7 quality gates, §9 guardrails). Read it before coding and output its §6 verification block before non-trivial work. Don't duplicate its rules here; defer to it.

## Non-negotiables (the ones agents most often get wrong)
- **Pages are thin orchestrators** (≤200 LOC) — page logic lives in a custom hook in `src/hooks/`.
- **Design-system primitives are mandatory:** every overlay uses `BaseModal` (suffix `Modal`, never `Dialog`), every label+input+error uses `FormField`, every status pill uses `StatusBadge`.
- **No `any`** (use `unknown` + type guards). **No hardcoded UI text** — every string in all **9** locale files (`en/de/tr/it/ar/fr/es/ru/zh`), parity required in the same PR. **No inline hex** — CSS variables from `globals.css`. Dark mode via `html[data-theme="dark"]`, never `@media`.
- **API calls** go through `src/lib/apiClient.ts` + `src/services/<resource>Service.ts`; read env via `src/lib/config.ts`, never scattered `process.env.NEXT_PUBLIC_*`.
- **NEXT_PUBLIC_* are baked at build time** — deployment/domain concerns belong to the **devops** agent, not a code change.
- Refactors that relocate code re-trip **Qodana-JS**; clear it via the rebaseline workflow. Watch the modal-migration crash trap: `BaseModal`/`AlertDialog` evaluate children even when closed — guard data access with `?.`.
- After every edit, the **PostToolUse hook** (`scripts/check-single-file.mjs`) warns on file-length + convention violations — act on those warnings.

## Workflow
1. Start clean on `develop` (never commit to `develop`/`main` directly). Branch `feature|fix|chore/<x>`. Baseline: `npm run lint && npm run build`.
2. Implement; run `npm run lint` after non-trivial changes; `npm test` before finishing.
3. Before opening a PR: run the **`pr-review-toolkit:code-reviewer`** agent on the staged diff and iterate until it approves (saved team workflow).
4. Open the PR to `develop` with the repo template (fill i18n-parity + backend-contract sections). **Never** `--no-verify` or bypass the review-gate / pre-push hooks.
5. Merge to `develop` → the `:staging` image auto-builds → validate on https://staging.fooderist.com. **Promotion to prod + deploys go through the `devops` agent** (in the `restaurant-app-deploy` repo).

## Cross-repo awareness
Types under `src/services/types/` mirror backend DTOs (`backend/**/Dtos/`). Verify field names/types against the backend before consuming an endpoint; flag mismatches as "needs backend PR" and delegate the backend side to the **backend** agent.
