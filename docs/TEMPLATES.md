# Tenant UI Templates

> How the build-time template system works and how to add a template.
> Decision record: [ADR-006](adr/ADR-006-tenant-ui-templates.md). Master plan: workspace `docs/plans/SOFRA-TENANT-TEMPLATES-PLAN.md`.

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
- `tsconfig.json` maps `@active-template` to `classic` as the **type-source**
  (tsc/editors always check against classic); `jest.config.js` mirrors this.
  Every template must therefore stay assignable to `TemplateDefinition`.
- Only the active template's code, CSS, and fonts end up in the bundle
  (dead-code elimination — no runtime branching). Verified for `classic`:
  a default build and an explicit `NEXT_PUBLIC_TEMPLATE=classic` build
  produce byte-identical content-hashed chunks.

## What a template owns (v1 contract — `src/templates/types.ts`)

| Piece | File | Notes |
|---|---|---|
| `name` | `index.ts` | Style name (`classic`, `craft`), never a tenant name. |
| `tokens.css` | `tokens.css` | The semantic design-token entrypoint. The root layout imports `@active-template/tokens.css` **first** (before `globals.css`) — CSS order is load-bearing. `classic` re-exports the shared `src/design-system/tokens/`; a template overrides semantic names, it does NOT fork the shared token files. |
| `fonts` | `fonts.ts` | `next/font` loads; the root layout joins their classNames onto `<body>`. |
| `Shell` | `Shell.tsx` | Customer-facing chrome (header/nav/footer). Staff/admin chrome is NOT templated in v1. `classic` re-exports the shared `app-internal-layout.tsx` unchanged (composition, not rewrite — the customer/staff split happens when `craft` needs its own chrome). |
| `HomePage` | `HomePage.tsx` + module CSS | The whole landing composition. `src/app/page.tsx` is a thin re-export. |

Everything else (menu, cart, checkout, reservations, auth) stays **shared**
and is skinned via semantic tokens only. Per-surface component slots are
explicitly a v2 mechanism — do not add contract fields for one-off needs.

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
