# Tenant onboarding — data intake

> What we must collect from a restaurant BEFORE provisioning, and where each field lands.
> Companion to [TENANT-COPY.md](../TENANT-COPY.md) (whose words go in the bundle) and
> [DEPLOYMENT.md](DEPLOYMENT.md) (how the image ships).
>
> Fill one `intake/<tenant>.json` per tenant. A field left `null` is a field someone has to
> chase later, mid-provisioning — which is the delay this sheet exists to remove.

## Why a sheet and not a scrape

A partner's existing website is the fastest source for most of this, but it is never the
authoritative one: prices drift, hours on a homepage are stale, and a logo lifted from a page is
usually the wrong resolution for `logo.png` + `logo-dark.png` + the three PWA icons. Treat a scrape
as a **draft to confirm with the owner**, never as the record.

Note also that agent sessions run behind an egress allowlist that does not include the open web —
see the status note at the bottom of this file. Collecting from a live site is a human step today.

## The fields

### 1. Restaurant profile → `RestaurantInfoDto` (`src/types/restaurantInfo.ts`)

Lands via `/admin/restaurant-settings?tab=general` (setup step `restaurant-info`).

| Field                           | Notes                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------- |
| `name`                          | Legal/display name as the owner wants it rendered                                                 |
| `addressLine1`, `addressLine2`  | `addressLine2` nullable                                                                           |
| `city`, `postalCode`, `country` | Feed `{{city}}` / `{{country}}` in platform copy — never hardcode into locales                    |
| `latitude`, `longitude`         | Nullable, but set them: the guest map needs them                                                  |
| `email`                         | Required                                                                                          |
| `website`                       | Nullable — the CURRENT site, if it stays up after cutover                                         |
| `phoneNumbers[]`                | Each: `label`, `number` (**E.164**, e.g. `+33...`), `whatsAppEnabled`, `displayOrder`, `isActive` |

`logoUrl` / `logoDarkUrl` / `interiorImageUrl` are **not** part of the profile PUT — they have
dedicated upload endpoints so a General Settings save cannot wipe them. Collect the assets (§4)
but expect to upload them separately.

### 2. Opening hours → `UpdateWorkingHoursDto` (`src/types/workingHours.ts`)

Setup step `opening-hours`. One entry per `dayOfWeek` (0=Sunday … 6=Saturday).

- `shifts[]` is the real field: `{ openTime, closeTime }` as `"HH:mm:ss"`. A restaurant that
  shuts between lunch and dinner needs **two** shifts that day — the legacy flat
  `openTime`/`closeTime` pair only carries the first window.
- A day the venue is closed: `isClosed: true`. Sending `shifts: []` on a day that is not
  `isClosed` is refused by the API on purpose.
- Hours are in the **tenant's** zone (`Localization:TimeZone`), never the collector's device.

### 3. Menu → `MenuItem` (`src/types/menu/menuItem.ts`)

Setup step `menu`, via `/admin/menu-management`. Per item:

- `name`, `description`, `price` (number, tenant currency), `categoryKey`
- `image` — see §4 for the asset itself
- `variations[]` — sizes/options as `{ name, priceModifier, displayOrder, isActive }`.
  `priceModifier` is a **delta**, not an absolute price.
- `dietaryTags`, `allergens`, `ingredients` — collect if the source has them; allergens are a
  legal requirement in the EU, so flag their absence rather than shipping empty.
- `content` — per-locale `{ name, description }`. Which locales the tenant actually serves is
  the `extra-languages` module question in §5.

### 4. Brand assets → `public/branding-<tenant>/`

Mirror the file set in `public/branding-rumi/`:

`logo.png` · `logo-dark.png` · `icon.svg` · `icon-192.png` · `icon-512.png` ·
`icon-maskable-512.png` · `hero.png` · `placeholder.png`

Ask the owner for **vector or high-res originals**. A logo pulled off a website is typically a
sub-200px raster with a baked background, which fails the dark-theme variant and the maskable icon
immediately. Per-item menu photography is the long pole — budget for it.

### 5. Commercial / module setup

Which of `MODULE_IDS` (`src/lib/modules.ts`) this tenant buys:
`core` · `kitchen-board` · `cashier` · `server` · `reservations` · `loyalty` · `printing` ·
`online-payments` · `extra-languages`.

The setup checklist the owner sees is filtered by this, so getting it right up front is what makes
first-run feel short. Also decide:

- `themePaletteKey` (ADR-007) or a full template (ADR-006 / [TEMPLATES.md](../TEMPLATES.md))
- `NEXT_PUBLIC_TENANT_COPY_PACK` — only if the tenant's own wording differs from platform default;
  a pack is ten locale files, so do not open one for a tagline nobody asked to change
- `TENANT_PARTNER_NAME` / `TENANT_PARTNER_URL` (`src/types/tenantPartner.ts`) — the partner
  attribution credit. URL must be `https://` or the backend withholds it and serves the name alone.

## Handover checklist

- [ ] `intake/<tenant>.json` complete, no unexplained `null`
- [ ] Prices and hours **confirmed by the owner**, not just scraped
- [ ] Allergen data present, or its absence explicitly accepted by the owner
- [ ] Brand assets received as originals, all 8 files derivable
- [ ] Module list agreed commercially
- [ ] Partner attribution decided
