# `public/branding/` — the platform default tenant asset set

These files are the **SofraPiwas** defaults every tenant image inherits when nothing
overrides them. They are deliberately **not** any one restaurant's assets.

| File | Used by | Notes |
|---|---|---|
| `icon.svg` | favicon (`BRANDING_ICON`) | the onion mark, simplified for small sizes |
| `hero.png` | home hero + craft auth pages (`BRANDING_HERO`) | 2000×800, brand gradient + onion watermark; mid-dark so classic's white hero type reads through its `rgba(0,0,0,.3)` overlay |
| `placeholder.png` / `.svg` | menu item with no photo (`BRANDING_PLACEHOLDER`) | onion + wordmark lockup on cream |

## Why this directory is the platform set, not tenant-1's

It used to hold RUMI's assets. Because `public/branding/` is what every tenant image gets
by default, and because nothing in the self-serve funnel ever passed `branding_url`, that
meant a brand-new restaurant's site opened on **a photograph of RUMI's dining room, with
RUMI's logo on the wall**, under RUMI's favicon. RUMI is one tenant among others; its
assets now live in `public/branding-rumi/` and are applied only to RUMI's own image by
`build-image.yml`'s prod job.

## There is no `logo.png` here, on purpose

Since SOFRA-ONBOARDING-PLAN O6 the logo is **runtime** data — `RestaurantInfo.logoUrl`,
uploaded by the owner in tenant admin and served from the tenant's own uploads volume. A
tenant with no logo gets a designed lockup (the SofraPiwas mark beside their own name,
typeset in the active template's face), not a stand-in image.

Re-adding a baked `logo.png` would create a second source of truth that silently wins over
whatever the tenant uploaded. Don't.

## How a tenant overrides these

`.github/workflows/build-tenant-image.yml` copies `icon.svg`, `hero.png` and
`placeholder.png` over these before the Docker build, from either:

- `branding_url` — an `https://` `.tar.gz` with those filenames at the archive root, or
- `branding_dir` — a path already committed in this repo.

A file absent from the archive/dir keeps the default below it.

## Regenerating `hero.png`

Composited from the brand mark rather than photographed, so it belongs to no restaurant:
a diagonal `#30180F → #7A3A22 → #B95634` ramp, the onion mark stamped three times at
14% / 7% / 5% opacity, a soft vignette and ~4.5% grain. Palette sampled from the mark
itself (outline `#602F1D`, rind `#B95634`, saffron `#F2A218`).
