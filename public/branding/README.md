# `public/branding/` — the platform default tenant asset set

These files are the **SofraPiwas** defaults every tenant image inherits when nothing
overrides them. They are deliberately **not** any one restaurant's assets.

| File | Used by | Notes |
|---|---|---|
| `icon.svg` | favicon (`BRANDING_ICON`) + web app manifest (`sizes: "any"`) | the onion mark, simplified for small sizes |
| `icon-192.png` / `icon-512.png` | web app manifest, `purpose: "any"` | raster install icons, rendered from `icon.svg` on a `#FCF6E6` plate |
| `icon-maskable-512.png` | web app manifest, `purpose: "maskable"` | same mark inset by 20% per side, so a circular OS mask cannot clip it |
| `hero.png` | home hero + craft auth pages (`BRANDING_HERO`) | 2000×800, brand gradient + onion watermark; mid-dark so classic's white hero type reads through its `rgba(0,0,0,.3)` overlay |
| `placeholder.png` / `.svg` | menu item with no photo (`BRANDING_PLACEHOLDER`) | onion + wordmark lockup on cream |

## RUMI's own set goes through the same script

`public/branding-rumi/` holds tenant-1's assets, and `build-image.yml`'s prod job applies them with
`scripts/apply-tenant-branding.sh` — the same script the self-serve path uses. It used to be an
inline three-file loop (`hero.png icon.svg placeholder.png`) that skipped the three install PNGs, so
it was the one branding path that bypassed the icon-set rule below. Measured on prod:
rumirestaurant.ch served RUMI's own favicon and the **SofraPiwas onion** in `icon-192.png`,
byte-identical to demo's. Do not re-inline it.

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

`.github/workflows/build-tenant-image.yml` copies **six** filenames over these before the
Docker build, through one script (`scripts/apply-tenant-branding.sh`) shared by both sources:

| Filename | Notes |
|---|---|
| `icon.svg` | favicon + manifest vector icon |
| `icon-192.png` | manifest install icon, `purpose: "any"` |
| `icon-512.png` | manifest install icon, `purpose: "any"` |
| `icon-maskable-512.png` | manifest install icon, `purpose: "maskable"` |
| `hero.png` | home hero background |
| `placeholder.png` | menu item with no photo |

- `branding_url` — an `https://` `.tar.gz` with those filenames at the archive **root**, or
- `branding_dir` — a path already committed in this repo.

A file absent from the archive/dir keeps the default below it, **with one exception**.

### The icon set travels together, or the build fails

A source that supplies `icon.svg` **must** supply all three PNGs. If it does not, the build
**fails loudly** with the missing filenames.

Why fail instead of falling back: the PNGs are what a phone puts on the **home screen**. Keeping
the platform default under a tenant's own `icon.svg` means the tenant's favicon in the tab and
the **SofraPiwas onion** on their customers' phones — another brand's mark on a paying tenant's
device, and nothing in the build says so. Rendering the PNGs here instead would have to guess the
design decisions the platform set encodes (the `#FCF6E6` plate, the 20% maskable inset) and would
ship a wrong-looking icon just as silently. A build that stops and names three files is the cheap
failure. Supplying **no** icon at all is still fine and still supported: the tenant inherits the
whole platform icon set consistently.

Produce them from the tenant's `icon.svg` at 192/512 px on the plate colour, the maskable one
inset 20% per side (the originals were rendered with headless Chromium via the repo's Playwright
install; `sharp` is also already a dependency of this repo).

### PWA colours are build args, and their default is RUMI's red

The installed app's chrome and splash colours come from **two build args, not from the branding
directory**:

| Build arg / workflow input | Default when empty | Used for |
|---|---|---|
| `pwa_theme_color` → `NEXT_PUBLIC_PWA_THEME_COLOR` | **`#c00000` — RUMI red** | manifest `theme_color`, the browser/OS chrome around the installed app |
| `pwa_background_color` → `NEXT_PUBLIC_PWA_BACKGROUND_COLOR` | `#ffffff` | manifest `background_color`, the splash screen while the app boots |

The defaults are the classic template's `--brand-primary` / `--surface-primary`
(`src/lib/config.ts`). **A tenant whose palette is not red must pass BOTH inputs** when the image
is built, or their own icon sits on a RUMI-red splash. The values are validated as `#rrggbb`;
empty means "use the default".

## Regenerating `hero.png`

Composited from the brand mark rather than photographed, so it belongs to no restaurant:
a diagonal `#30180F → #7A3A22 → #B95634` ramp, the onion mark stamped three times at
14% / 7% / 5% opacity, a soft vignette and ~4.5% grain. Palette sampled from the mark
itself (outline `#602F1D`, rind `#B95634`, saffron `#F2A218`).
