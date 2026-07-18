# ADR-007 — Runtime colour-palette theming: owner-selectable palettes without a rebuild

**Status:** Accepted (owner decision 2026-07-18) — **Phase 1 implementation in progress**: backend palette key (`RestaurantInfo.ThemePaletteKey`) + frontend preset registry (`src/design-system/palettes/`) + SSR injection in `layout.tsx` + owner "Appearance" tab. Not yet shipped end-to-end; this ADR precedes and governs those PRs.
**Date:** 2026-07-18
**Author:** mahmutkaya (analysis + drafting: Claude)
**Reviewers:** mahmutkaya
**Implements / builds on:** ADR-006 **Alternative A** ("token-only theming … adopted as the foundation" — decision 4), realized here as a *runtime* layer; ADR-002 (CSS Modules + semantic tokens). Workspace `docs/plans/SOFRA-PARTNER-PLAN.md` ("white-label", previously *Later / Not scheduled*).
**References:**

- `src/design-system/tokens/colors.css` (the ~30 semantic names this overrides; light `:root` + dark `html[data-theme='dark']`)
- `src/templates/{classic,craft}/tokens.css` (per-template baked palette — the exact paired-block shape a preset must emit)
- `src/app/layout.tsx` (Server Component; the load-bearing token→globals CSS order the injection sits after)
- `src/components/ThemeContext.tsx` (the only existing runtime theming — flips `data-theme`, never injects values)
- `src/types/restaurantInfo.ts` + `src/services/restaurantInfoService.ts` + `src/hooks/useRestaurantInfo.ts` (the per-tenant runtime fetch this rides)
- backend `RestaurantSystem.Domain/Entities/RestaurantInfo.cs` + `Features/RestaurantInfo/Dtos/RestaurantInfoDto.cs` (where the palette key is stored + exposed)

---

## Context

Owners (and, later, partners) want to recolour their tenant's public site — pick a different colour palette from a dashboard — **without rebuilding the tenant Docker image**. Today colour is 100% build-time: each tenant image bakes one template whose `tokens.css` sets the ~30 semantic CSS variables (`--brand-*`, `--surface-*`, `--text-*`, `--link-*`, `--border-*`, `--feedback-*`, `--status-*`), light on `:root` and dark on `html[data-theme='dark']`. Every component reads those semantic names (CLAUDE.md §5 forbids raw hex in modules), so overriding them re-skins the whole app.

Forces:

- ADR-006 **rejected runtime *template* switching** (Alternative C: bundles all templates, runtime branching everywhere) but **adopted token-only theming (Alternative A) as the foundation** — and never wired it for runtime. A per-owner **palette** is the narrow, in-bounds version of A: swap CSS-variable *values*, same template/layout/DOM.
- The only runtime theming today is light/dark: `ThemeContext` flips the `data-theme` attribute; it never sets colour *values*. Nothing in `src/` calls `setProperty` / emits a per-tenant `<style>`. Per-tenant runtime config (`RestaurantInfoDto`, fetched from the .NET backend) carries name/address/contact — **no colours**.
- The tenant frontend talks to the **backend**, not to the **sofra** control plane. A palette "chosen in a dashboard" must reach a build-time-baked site at runtime — a cross-system data-flow question, not just a UI one.
- One maintainer; the a11y gate (WCAG AA, CLAUDE.md §5) must not be bypassable by a colour choice.

## Decision

1. **Scope: colours only.** A palette re-declares the semantic colour variables. It is **not** a template (templates stay build-time per ADR-006) and **not** fonts (build-time `next/font`, part of `TemplateDefinition`). **A palette is orthogonal to the template** — any template × any palette.
2. **Data flow — Option A (store on the backend, pick in the tenant admin).** A nullable **palette key** lives per tenant on the .NET backend (`RestaurantInfo.ThemePaletteKey`), exposed on the public `GET /api/restaurant-info` (unauthenticated, so SSR can read it) and set on the admin `PUT`. The **owner** picks a preset in their own **tenant admin** ("Appearance" tab). The public site fetches the key and injects the palette at runtime. This rides the *existing* RestaurantInfo loop — zero new cross-system coupling.
3. **Key in the DB, values in code.** The DB stores only the key string; the preset **values** are a versioned, AA-tested frontend registry (`src/design-system/palettes/`: typed `PALETTES` + a `paletteToCss(key)` serializer). Selecting among shipped presets is a pure **runtime** DB write (no rebuild — the whole point); curating or adding a preset is a normal **reviewed, contrast-gated frontend release**. Backend validation is **loose** (accept any short non-empty string); the frontend **safe-falls-back** to the baked default on an unknown/removed key — so there is no cross-repo key allowlist to keep in sync.
4. **Injection — SSR inline `<style>`.** `layout.tsx` (a Server Component) fetches the key server-side (`revalidate: 30`, matching the app's existing RestaurantInfo freshness) and emits an inline `<style>` **after** the `@active-template/tokens.css` + `globals.css` imports, re-declaring the tokens with **doubled-specificity** selectors (`:root:root{…}` + `html[data-theme='dark']:root{…}`, paired light + dark) so the runtime block overrides the template's plain `:root` / `html[data-theme='dark']` tokens by **specificity** — independent of where the `<style>` lands in the document, so it is robust against head-injection / style-hoisting order (no reliance on source order; the dark selector `(0,2,1)` still outranks the light `(0,2,0)` in dark mode). **Not** client-side `setProperty` (which flashes the default palette before hydration — unacceptable FOUC on a public page). React 19 still hoists the `<style>` into `<head>` so it is server-rendered on first paint and the server/client markup matches — no hydration mismatch.
5. **Safe default (hard requirement).** No key / unknown key → **emit nothing** → the template's baked `tokens.css` renders byte-identical. Every un-themed tenant — including RUMI prod (`classic`, no key) — is provably unchanged.
6. **Named presets first.** 4–6 curated palettes, each a paired light + dark override set, each **WCAG-AA contrast-checked** (text-on-surface, both modes) by a Jest test that gates the registry. **Custom hex is deferred** (Phase 3) — arbitrary owner colours can produce sub-AA pairs and break the contrast gate; a custom tier needs automated runtime contrast validation first.
7. **Excludes theme-invariant values.** The preset schema covers only the semantic brand/surface/text/border/feedback names. It must **not** touch the frozen `--color-*` primitives (`colors.css`) or the raw-hex `.home-overlay-header` overrides (`globals.css`) — those are theme-invariant by construction.
8. **Owner-picked in the tenant admin for Phase 1.** Partner/founder picking from the **sofra** control plane is deferred (Phase 2): it would require a new sofra→tenant-backend integration (sofra holds no tenant-backend credentials; `tenant-registry.ts` is a documented read-only seam). Whoever provisions a tenant already has tenant-admin access, so Option A covers "owners and partners" for now.

## Consequences

### Positive

- Owners recolour their site from the admin **without a rebuild** — the ask, delivered on the existing per-tenant fetch with no new infra concept.
- **Templates reserved for genuine differences.** Once recolours are runtime presets, "we want a different colour scheme" no longer pressures anyone to fork a whole template — templates stay for layout/DOM/typography, palettes absorb the colour axis. Directly serves ADR-006's "keep the template contract small/extensible" goal.
- **A11y gated by construction** — curated presets are AA-checked and Jest-gated; an owner cannot select an unreadable palette in Phase 1.
- Clean separation of concerns: runtime selection (data) vs curated values (reviewed code).

### Negative

- Introduces the **first runtime-injected CSS-var mechanism** in the app, inside the **load-bearing** `layout.tsx` token→globals cascade (order is screenshot-verified) — a new failure surface.
- A **backend DTO field + an immutable EF migration** (get it right once, per backend §9) + the frontend DTO mirror — a cross-repo additive contract change.
- SSR must reach the backend **server-side**: `apiClient` resolves the browser-facing `NEXT_PUBLIC_API_URL`; the server fetch needs a server-reachable URL (the public tenant API domain, or a new server-only `API_INTERNAL_URL`).
- Phase 1 owners pick from a **curated set**, not arbitrary colours (custom hex is a later, validated tier).

### Mitigation for the negatives

- **Safe default** (decision 5) guarantees zero delta for every un-themed tenant, so shipping the mechanism cannot regress RUMI prod or any classic/craft tenant that hasn't opted in.
- The AA **Jest contrast test** gates every preset in both modes before it can ship.
- Injection is **source-order-after** the baked tokens and **excludes** the theme-invariant primitives, bounding the blast radius to the intended semantic names.
- Prove the whole loop first on the **`demo`/`craft`** tenant (staging), the showcase for "any template × any palette", before any real tenant opts in.

## Alternatives considered

### Alternative A: bake the palette as another `NEXT_PUBLIC_*` per image

Build-time — changing it needs a rebuild + redeploy, which fails the core requirement ("from the dashboard, no rebuild"). Rejected. (This is exactly what today's per-template `tokens.css` already is; the ADR exists to move *off* it for the colour axis.)

### Alternative B: store the palette in the sofra control plane + `registry.yml`

The `registry.yml` path is build-time (bakes → rebuild). The Prisma path requires sofra to **push** the palette into each tenant's backend at runtime — a brand-new coupling sofra deliberately avoids (no tenant-backend credentials; the registry is a read-only seam). Rejected for MVP. A partner-facing picker can be layered on top of Option A later (Phase 2) if genuinely needed.

### Alternative C: client-side `documentElement.style.setProperty` injection

Simpler to wire, but flashes the *default* palette before hydration — a visible FOUC on a public marketing page. Rejected in favour of SSR inline `<style>`.

### Alternative D: store the full colour values in the DB (not a key)

Lets owners set arbitrary colours, but bypasses the AA gate, bloats the row, and couples the DB to the palette schema. Custom colour is deferred to a validated Phase 3 tier; for MVP the DB stores a key and the values stay curated code. Rejected for MVP.

### Alternative E: a dedicated `TenantTheme` entity + `GET /api/tenant-theme`

Cleaner bounded context, but more net-new surface (entity, endpoint, fetch path). For MVP, **extend `RestaurantInfo`** — the site already fetches it every load — and revisit a dedicated endpoint if the aggregate grows crowded. Rejected for MVP, noted for later.

## Phasing

- **Phase 1 (MVP, this):** named presets, owner-picked in the tenant admin, backend key, SSR injection, safe default. Proven on the `demo`/`craft` tenant.
- **Phase 2 (deferred):** partner/founder picking from the sofra control plane; per-section palettes; live preview.
- **Phase 3 (deferred):** custom-hex tier with automated runtime WCAG-AA contrast validation at pick time.
