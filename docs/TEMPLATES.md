# Tenant UI Templates

> How the build-time template system works and how to add a template.
> Decision record: [ADR-006](adr/ADR-006-tenant-ui-templates.md). Master plan: workspace `docs/plans/SOFRA-TENANT-TEMPLATES-PLAN.md`.

## Templates shipped

| Template  | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `classic` | Current RUMI look — extracted as-is (T2). Since T3 slice 2 its Shell owns the customer chrome as a verbatim extraction (`classic/chrome/CustomerChrome.tsx`) — 28/28 screenshot zero-diff re-proven after the split.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `craft`   | Sofra-mirror look (T3 slices 1–2, 2026-07-10/11): `tokens.css` (craft palette per plan §3.3 + `--font-family-sans` → Quicksand and a `body[class]` rule so the body face beats the joined font classNames), `fonts.ts` (Quicksand/Amatic SC/Caveat), a distinct `HomePage.tsx` (asymmetric hero, tilted letterpress cards, dotted-leader menu-board section for opening hours) + `craft.module.css` (letterpress shadow, `roundedCraft`, tape label, dotted leader utility classes), `primitives.module.css` (2026-07-22 — ONE source for every craft button/tape-chip/paper-card look: `btnPrimary{,Sm,Lg}`/`btnOutline{,Sm}`/`btnKraft`/`btnOnPhoto`/`btnGhost`, `tapeChip{,Active}`, `cardLift`/`cardStatic`/`cardPlate`, `optionCard{,Selected}` — craft-owned surfaces MUST `composes` these instead of re-declaring the look; shape literals live in `--craft-radius`/`--craft-tape-clip` tokens), and its **own customer chrome** (`craft/chrome/`): sticky letterpress header with a hand-lettered Amatic SC wordmark, tokens-skinned shared `RoleNavLinks`, a letterpress reservations CTA, a mobile slide-in menu with classic-parity aria, and a kraft-paper footer with a Caveat sign-off. Build: `NEXT_PUBLIC_TEMPLATE=craft npm run build` / `npm run dev`. |

## The mechanism

One tenant image bakes exactly **one** template, selected at build time:

```
deploy registry `template:`  →  build-tenant-image.yml `template` input
  →  Dockerfile ARG/ENV NEXT_PUBLIC_TEMPLATE
    →  next.config.ts alias  @active-template → src/templates/${NEXT_PUBLIC_TEMPLATE || 'classic'}
      →  webpack resolve.alias (build) + turbopack.resolveAlias (dev)
```

- Empty/unset `NEXT_PUBLIC_TEMPLATE` → `classic` (`||`, not `??` — the Docker
  ARG plumbing bakes an **empty string** when the build-arg is omitted).
- An unknown value **fails the build at config load** with
  `NEXT_PUBLIC_TEMPLATE="<x>" is not a known UI template …` — no silent fallback.
- The build-time alias in `next.config.ts` is the **sole resolver**. tsc/editors
  type-check via ambient declarations in `src/templates/active-template.d.ts`;
  `jest.config.js` maps `@active-template` → `classic` for tests. Every template
  must stay assignable to `TemplateDefinition`. **Do not re-add a `@active-template`
  `tsconfig.json` `paths` entry** — Next's webpack build honors `paths` OVER
  `resolve.alias`, which silently bundles `classic` for every non-classic template
  (the S15 T3 bug this file's history records).
- Only the active template's code, CSS, and fonts end up in the bundle
  (dead-code elimination — no runtime branching). Verified for `classic`:
  a default build and an explicit `NEXT_PUBLIC_TEMPLATE=classic` build
  produce byte-identical content-hashed chunks.

## What a template owns (v1 contract — `src/templates/types.ts`)

| Piece        | File                        | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------ | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`       | `index.ts`                  | Style name (`classic`, `craft`), never a tenant name.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `tokens.css` | `tokens.css`                | The semantic design-token entrypoint. The root layout imports `@active-template/tokens.css` **first** (before `globals.css`) — CSS order is load-bearing. `classic` re-exports the shared `src/design-system/tokens/`; a template overrides semantic names, it does NOT fork the shared token files.                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `fonts`      | `fonts.ts`                  | `next/font` loads; the root layout joins their classNames onto `<body>`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `Shell`      | `Shell.tsx`                 | Customer-facing chrome (header/nav/footer). Staff/admin chrome is NOT templated in v1: every Shell dispatches `/admin`, `/cashier`, `/server`, `/kitchen-staff` (helper `src/templates/shared-chrome.ts`) to the SHARED `app-internal-layout.tsx`, untouched, so both templates render identical chrome there. Customer routes render the template's own chrome under `<template>/chrome/` (`classic`: verbatim extraction of app-internal-layout's customer path; `craft`: its own design). Role-based nav links live once in the shared `src/components/RoleNavLinks.tsx` (skinned via the `--nav-link-*` vars, never forked); app-internal-layout keeps its original inline copy on purpose — the untouched staff surface beats DRY until T4 consolidation. |
| `HomePage`   | `HomePage.tsx` + module CSS | The whole landing composition. `src/app/page.tsx` is a thin re-export.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

The shared customer surfaces (menu, cart, checkout, reservations, auth) are
skinned via semantic tokens by default. **Per-surface component slots — the
`TemplateSurfaces` map — are LIVE since T4** (owner decision 2026-07-18, over the
plan's original v2 deferral): a template may replace a shared surface with
genuinely-distinct DOM.

### Per-surface slots (T4)

- Each template exports a `surfaces.ts` → `@active-template/surfaces` (kept OUT of
  the eager `template` object so importing a slot never drags Shell/HomePage/fonts
  into that surface's client bundle).
- A shared surface resolves its component at build time:
  `const MenuCard = surfaceOr('MenuCard', DefaultMenuCard)` (`src/templates/resolve-surface.tsx`).
  A template omitting the slot renders the shared default — **classic is untouched
  by construction** (verified: the craft menu motifs never appear in a classic
  build). To add a slot: add the optional field to `TemplateSurfaces`
  (`types.ts`), have the surface host resolve it via `surfaceOr`, and ship the
  override under `<template>/surfaces/`. Add a slot only when a template actually
  provides a distinct version.

## Rules (from ADR-006 / plan §3.4)

- Templates are ordinary source: file-length limits, no `any`, no raw hex
  (tokens only), CSS Modules.
- Dark mode stays `html[data-theme="dark"]` in every template.
- Templates never fork i18n: reuse existing keys; template-specific copy goes
  under `template.<name>.*` in the same 10 locale files (parity rule unchanged).
- Import templates **only** via `@active-template` (never
  `src/templates/<name>/...` from app code) — a direct import defeats the
  per-tenant selection and bundles a template for everyone.

## Adding a template (T3 checklist shape)

1. `mkdir src/templates/<name>` with `index.ts` exporting a
   `TemplateDefinition`, plus `tokens.css`, `fonts.ts`, `Shell.tsx`,
   `HomePage.tsx`.
2. Build it: `NEXT_PUBLIC_TEMPLATE=<name> npm run build`
   (dev: `NEXT_PUBLIC_TEMPLATE=<name> npm run dev`).
3. Extend the allowlist in `.github/workflows/build-tenant-image.yml`
   (validation step) if the registry contract grows beyond `classic|craft`.
4. Gate it: axe/contrast on all customer routes + a per-template screenshot
   baseline (`npm run test:screenshots:docker`; see `e2e/README.md`).

## Verifying the default stays pixel-identical

The committed screenshot baselines (28 PNGs, `e2e/screenshots/__screenshots__/`)
are the regression gate for the default/classic build — run
`npm run test:screenshots:docker` against a seeded e2e backend before merging
anything that touches template plumbing.
