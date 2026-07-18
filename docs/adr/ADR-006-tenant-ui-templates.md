# ADR-006 — Tenant UI templates: build-time template selection

**Status:** Accepted — **implemented (T2) 2026-07-10**: `src/templates/` contract + `@active-template` alias + `classic` extraction live; screenshot-verified zero visual diff (28/28 baselines). Working notes: [docs/TEMPLATES.md](../TEMPLATES.md). **T3 slice 2 (2026-07-11) landed the customer/staff Shell split**: each template's `Shell.tsx` dispatches by route — staff/admin routes (`/admin`, `/cashier`, `/server`, `/kitchen-staff`; helper `src/templates/shared-chrome.ts`) render the SHARED `app-internal-layout.tsx` untouched (staff/admin is not templated in v1), customer routes render the template's own chrome (`classic`: verbatim extraction of the customer path, 28/28 zero-diff re-proven; `craft`: its own sticky letterpress chrome — T3 slices 1–2).
**Date:** 2026-07-07
**Author:** mahmutkaya (analysis + drafting: Claude)
**Reviewers:** mahmutkaya
**Implements / supersedes:** workspace `docs/plans/SOFRA-TENANT-TEMPLATES-PLAN.md` (ROADMAP S15); builds on ADR-002 (CSS Modules + tokens) and ADR-005 (design-system primitives)
**References:**

- `src/lib/config.ts` (baked per-tenant config pattern)
- `.github/workflows/build-tenant-image.yml` + `Dockerfile` ARGs (per-tenant image pipeline, S14)
- deploy repo `tenants/registry.yml` (tenant registry, sofra ADR-007)
- `docs/DESIGN-SYSTEM.md` §1–2 (token architecture this rides on)

---

## Context

Sofra tenants must be able to choose between **fully distinct visual designs** — different layout, typography, and motifs, not just swapped colors. v1 needs two templates: the current RUMI design, and a new design mirroring the sofrapiwas.com "craft" identity.

Forces:

- S14 already gives every tenant **its own frontend Docker image** with baked `NEXT_PUBLIC_*` values (name, API URLs, branding assets). Design is the one thing that does not vary.
- Logic/presentation separation is strong (pages → hooks → services/contexts), so presentation can vary without touching data flow.
- The CSS layer is the blocker: flat legacy tokens in `globals.css`, raw hex in most CSS Modules, one hardcoded global shell (`app-internal-layout.tsx`), fonts hardcoded.
- One maintainer; template drift and duplication must be structurally impossible, not policed.

## Decision

1. **Templates are selected at build time, one per tenant image.** The deploy-repo registry gains a `template:` field (values: `classic` | `craft`, default `classic`), which flows exactly like `restaurant_name` does today: registry → `tenant.env.tpl` → `build-tenant-image.yml` input → Dockerfile `ARG NEXT_PUBLIC_TEMPLATE` → baked bundle.
2. **Template code lives in `src/templates/<name>/`** and is resolved through a build-time alias `@active-template` → `src/templates/${NEXT_PUBLIC_TEMPLATE}` (webpack `resolve.alias` + `turbopack.resolveAlias` in `next.config.ts`), so only the selected template's code, CSS, and fonts are compiled into the bundle (dead-code elimination — no runtime branching, no multi-template bloat).
3. **Templates implement a typed `TemplateDefinition` contract** (`src/templates/types.ts`): design tokens (`tokens.css`), fonts (`next/font`), the customer-facing `Shell` (header/nav/footer chrome), and `HomePage`. Nothing else.
4. **Shared surfaces (menu, cart, checkout, reservations, auth) are skinned via semantic design tokens** (DESIGN-SYSTEM.md §2, implemented starting T1). ~~Structural per-surface component swaps ("slots") are explicitly out of v1.~~ **Superseded in T4 (owner decision 2026-07-18): per-surface component slots are LIVE** — a template may override a shared surface with distinct DOM via the `TemplateSurfaces` map (`@active-template/surfaces` → `surfaceOr()`), an omitted slot rendering the shared default (classic untouched by construction; see TEMPLATES.md §Per-surface slots). Staff/admin chrome is not templated in v1.
5. **Template names are style names, not tenant names:** `classic` (current RUMI look) and `craft` (sofra-mirror). A template must be adoptable by any tenant.
6. **Templates never fork i18n.** Existing keys are reused; template-specific copy goes under a `template.<name>.*` namespace in the same 10 locale files, locale-parity rule unchanged (ADR-003).
7. **Dark mode stays `html[data-theme="dark"]`** (ADR-002) in every template; the craft template translates sofra's `.dark`-class values to this mechanism.

## Consequences

### Positive

- Per-tenant design rides the existing, proven per-tenant image pipeline — no new infra concept.
- Zero runtime cost and zero cross-template leakage; a mis-set env cannot blend two designs.
- The typed contract keeps template surface area small (tokens/fonts/shell/home); shared components keep receiving features for all templates automatically.
- Forces completion of the semantic token layer, which the design-system plan needed anyway.

### Negative

- A template change requires an image rebuild + redeploy (no live preview/switching).
- Every template ships to every surface a tenant sees — a broken template token set degrades the whole app for that tenant.
- Two shells/home pages to maintain; visual QA doubles for customer flows.
- Build-time alias means local dev must set `NEXT_PUBLIC_TEMPLATE` to work on a non-default template.

### Mitigation for the negatives

- Template rebuilds reuse `build-tenant-image.yml` (`workflow_dispatch`); the registry records intent, so re-provisioning is one runbook step.
- Per-template Playwright screenshot suite (from T2) + axe/contrast checks gate template PRs.
- The `classic` extraction must be pixel-identical for RUMI prod (screenshot-compared) before `craft` work starts.
- `npm run dev` defaults to `classic`; a `dev:craft` script documents the override.

## Alternatives considered

### Alternative A: token-only theming (CSS variable swap per tenant)

Covers colors/fonts but cannot deliver "fully redesigned" layouts (different shell, different home page). Rejected as the whole answer; adopted as the foundation (decision 4).

### Alternative B: fork the app / package per brand

Maximum freedom, but duplicates every feature forever; with one maintainer this rots immediately. Rejected.

### Alternative C: runtime template switching (one image serves all templates)

Contradicts the instance-per-tenant + baked-`NEXT_PUBLIC_*` architecture; adds runtime branching to every templated component; bundles all templates for everyone. Reconsider only if per-tenant images ever consolidate.

### Alternative D: theme-marketplace machinery (Shopify-style)

Wildly premature at 1–2 tenants. The `TemplateDefinition` contract is kept small and explicit so this door stays open.
