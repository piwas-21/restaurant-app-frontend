# RUMI Frontend

Restaurant management system frontend — Next.js 15 (App Router), React 19, TypeScript, CSS Modules, i18next.

> **For agents:** read [CLAUDE.md](CLAUDE.md) first; it auto-loads in Claude Code sessions and lists the rules every change must follow.

---

## Stack

- **Next.js 15.5** (App Router with Turbopack dev server)
- **React 19** + **TypeScript**
- **CSS Modules** + design tokens (`src/app/globals.css`). See [ADR-002](docs/adr/ADR-002-css-modules-and-tokens.md).
- **i18next** with 9 locales (en, de, tr, it, ar, fr, es, ru, zh). See [ADR-003](docs/adr/ADR-003-i18next-locale-parity.md).
- **State**: React Context API (Auth, Session, Cart, Table, Checkout, Theme). See [ADR-001](docs/adr/ADR-001-app-router-context-api.md).
- **Forms**: Zod schemas + react-hook-form. See [ADR-004](docs/adr/ADR-004-zod-form-validation.md).
- **Design system**: `BaseModal`, `FormField`, `StatusBadge` mandatory wrappers. See [ADR-005](docs/adr/ADR-005-design-system-primitives.md).
- **Testing**: Jest + React Testing Library (unit), Playwright (E2E)
- Hosted on GitLab; CI runs gitleaks, npm audit, njsscan, semgrep, retire.js, build, Trivy image scan per `.gitlab-ci.yml`.

## Repository layout

```
src/
├── app/                          # Next.js App Router (pages + API routes)
│   ├── globals.css               # Design tokens (CSS variables) + base styles
│   └── layout.tsx                # Root layout
├── components/                   # Shared UI components
│   ├── design-system/            # BaseModal, FormField, StatusBadge
│   ├── menu/                     # Feature-area folders
│   └── ...
├── contexts/                     # React Context providers
├── hooks/                        # Custom hooks (page-level logic lives here)
├── lib/                          # apiClient, config, formatters
├── locales/                      # i18next JSON files (9 locales)
├── schemas/                      # Zod schemas (form validation)
├── services/                     # Backend API service files (one per resource)
├── styles/                       # Shared CSS Modules + globals
├── types/                        # TypeScript types/interfaces
└── utils/                        # Pure utility functions

docs/                             # Design system, sprint plan, ADRs, security audit
scripts/                          # Local dev orchestration
.gitlab/                          # MR templates, CI templates
__mocks__/                        # Jest mocks
__tests__ / *.test.ts             # Unit tests colocated with source
e2e/                              # Playwright E2E (see docs/E2E-STRATEGY.md)
```

## Quick start (new clone)

```bash
# 1. Install pre-commit hooks (one-time)
bash scripts/setup_hooks.sh

# 2. Bootstrap local .env.local from .env.example (one-time)
bash scripts/dev-secrets.sh
# then edit .env.local with your local backend URL etc.

# 3. Make sure the backend is running first
#    (in the backend repo: bash scripts/dev-up.sh)

# 4. Start the frontend dev server
bash scripts/dev-up.sh

# Stop
bash scripts/dev-down.sh
```

`dev-up.sh` health-checks the backend before starting the dev server (skip with `--no-backend-check` if you're working offline). It also runs `npm install` only when `package-lock.json` changed since last invocation, so subsequent invocations are fast.

## npm scripts

```bash
npm run dev          # Next.js dev server (Turbopack)
npm run build        # production build
npm run lint         # ESLint
npm test             # Jest (unit)
npm run test:watch   # Jest watch mode
npm run coverage     # Jest with coverage
npm run test:e2e     # Playwright (headless)
npm run test:e2e:ui  # Playwright with UI mode
```

## Branch strategy

```
main          ← production deployment (currently develop; cutover pending)
└── develop   ← test environment (auto-deployed)
     ├── feature/<x>
     ├── fix/<x>
     ├── chore/<x>
     └── docs/<x>
```

Pre-commit hook blocks direct commits to `main`, `develop`, and `master`. Branch off `develop`, open MR to `develop` using the [default MR template](.gitlab/merge_request_templates/Default.md). After test-env validation, `develop` is promoted to `main` for production.

### Branch protection (GitLab)

Configured in **Settings → Repository → Protected Branches**:

| Branch | Allowed to push | Allowed to merge | Force push |
|---|---|---|---|
| `main` | No one | Maintainers | Disabled |
| `develop` | No one | Maintainers + Developers | Disabled |

All MRs require the pipeline to pass before merge.

## Environment variables

| Variable | Purpose | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API base URL | E.g. `http://localhost:5221` for local; `https://www.rumirestaurant.ch` for prod |
| `NEXT_PUBLIC_IMAGE_BASE_URL` | Image CDN / S3 base | E.g. S3 bucket URL |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth client (public) | Per-environment value |

Read variables via `src/lib/config.ts` (typed export), never `process.env.NEXT_PUBLIC_*` scattered across components.

## Pull requests

Every MR uses [.gitlab/merge_request_templates/Default.md](.gitlab/merge_request_templates/Default.md). It auto-loads when you create an MR via the GitLab UI or `glab mr create`.

Required sections: summary, sprint-task link, acceptance-criteria coverage, backend-contract verification (for API-consumer changes), i18n parity (for string changes — all 9 locales must be touched), standard checklist, test plan.

## Documentation

| File | Purpose |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Agent rules — auto-loaded |
| [docs/SPRINT-PLAN.md](docs/SPRINT-PLAN.md) | 8-sprint refactoring plan |
| [docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md) | Design system patterns |
| [docs/DEVELOPMENT-GUIDELINES.md](docs/DEVELOPMENT-GUIDELINES.md) | Coding conventions |
| [docs/SECURITY-AUDIT.md](docs/SECURITY-AUDIT.md) | Security findings + status |
| [docs/TEST-COVERAGE-PLAN.md](docs/TEST-COVERAGE-PLAN.md) | Test strategy (Jest + Playwright phases, coverage targets) |
| [docs/E2E-STRATEGY.md](docs/E2E-STRATEGY.md) | Playwright E2E rules — scope, tiers, selectors, auth, reliability |
| [docs/QUALITY-SECURITY-PLAN.md](docs/QUALITY-SECURITY-PLAN.md) | CI / quality / security gate plan |
| [docs/adr/](docs/adr/) | Architecture Decision Records |
