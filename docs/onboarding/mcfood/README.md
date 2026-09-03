# MC FOOD (Orchamps-Vennes) — onboarding data pack

Partner: Mustafa. Source: their temporary site **https://mcdoner-orchamps.fr/**.
Captured **2026-09-03**. This is _preparation only_ — nothing has been created in RUMI yet.

## Verdict

**Everything is fetchable.** Their temp site is a Vite SPA over a public REST API; the domain
resolves to `restaurantId 17` / slug `mcfood`. The full menu, settings, opening hours and all
94 images came down over public, unauthenticated endpoints — the same ones a guest browsing
their site hits. Two things are _not_ available and must come from Mustafa directly (see
[Blockers](#blockers-must-come-from-mustafa)).

|                       |                                                                |
| --------------------- | -------------------------------------------------------------- |
| Categories            | 16 (all active, all with an image)                             |
| Products              | 69 (all active, none sold out, all with an image)              |
| Product size variants | 29 products carry 2–4 sizes                                    |
| Modifier groups       | 13, 74 options total                                           |
| Images                | 94 files, 31.3 MB, 73 distinct (21 are reused across products) |
| Tables                | 1 (`Masa 1`)                                                   |
| Delivery zones        | 0 — delivery is **off**                                        |
| Active campaigns      | 0                                                              |

## What's in this folder

| File                   |                                                                                                                                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dataset.json`         | Normalised, consolidated capture — restaurant, service config, hours, site theme, tables, all 13 modifier groups, and the 16 categories with their 69 products nested.                 |
| `assets-manifest.json` | All 94 images: source object path, target filename, real format, byte size, **sha256**, and what each is used for.                                                                     |
| `fetch.mjs`            | Re-runs the whole capture (`node fetch.mjs [outDir]`). Verified end-to-end: it reproduces all 94 assets byte-identically and self-checks against `assets-manifest.json`.               |
| `decisions.json`       | Every judgement call the capture could not make — the 7 self-contradictory groups, the 5 unnameable ones, the duplicates, the typos. `confirmed: false` on each until Mustafa answers. |
| `map.mjs`              | **Pure.** `dataset.json` + `decisions.json` → the request bodies our API accepts. `--verify` self-checks; opens no socket.                                                             |
| `import.mjs`           | The transport half: pushes the mapped catalogue into a provisioned tenant with a `menu:write` API token. `--dry-run` is a pre-flight.                                                  |

### Why the images aren't committed

31.3 MB of binaries, and 9 of the 94 exceed the repo's 1 MB `check-added-large-files`
pre-commit limit. `fetch.mjs` regenerates them on demand and the manifest's per-file sha256
proves the result is the same set. They also drift-check: the script reports added/changed/
removed objects against the committed manifest, so a re-run before onboarding shows whether
Mustafa has changed anything since capture.

**Their temp site is the only copy we have.** If it goes down before onboarding, the images
are gone — worth pulling a local archive if onboarding isn't imminent.

## Blockers (must come from Mustafa)

1. **A real logo.** `logoUrl` is a **2172×724 marketing banner** — photo background, "MCFOOD"
   wordmark, and the street address baked into the pixels. It is also their OG image. It is not
   a logo and cannot be used as one: our `RestaurantInfoDto` wants `logoUrl` + `logoDarkUrl`
   (a dark-theme variant), and the chromes render it small. Ask for the source wordmark,
   ideally transparent PNG/SVG, without the address burned in.
2. **Geocoordinates.** `latitude`/`longitude` are both `null` on their side; our
   `RestaurantInfoDto` carries them. Geocode `12 Rue des Bleuets, 25390 Orchamps-Vennes` at
   onboarding, or ask Mustafa to drop a pin.

## Data quality — fix during onboarding, not after

- **7 modifier groups say `isRequired: false` but `minSelect: 1`.** Groups 76, 78, 80, 82, 86,
  87, 88. Self-contradictory: either the guest must pick one or they need not. Groups 78/80/86/88
  are all "Sans X" (remove-an-ingredient) lists, so the intent is plainly _optional_ — but taken
  literally these force every guest to remove something. Confirm each with Mustafa before mapping.
- **Placeholder group names.** `"+ + +"`, `"-"`, `"- -"`, `"--"`, `"- Libanaise"`. These are
  admin shorthand, not guest-facing copy, and they cannot be translated as-is. Every one needs a
  real name before it reaches a menu (§5 rule 11 — all guest strings go through `src/locales/`).
- **Product 405 "Menu Galette" is a duplicate.** It exists both as a standalone product (11.50 €)
  _and_ as the second size on product 404 "Galette" (`Menu Galette`, 11.50 €). Pick one shape;
  keeping both double-lists it.
- **Group 82 "Ajouter Legume" lists `+ Oignons` and `+ Oignon`** — same option twice, both free.
- **Group 85 has `Veggıe`** — dotless Turkish ı in a French menu. Typo for `Veggie`.
- **`serviceFeeServiceTypes` includes `delivery` while `deliveryEnabled` is `false`** and there
  are no delivery zones. Harmless today, but don't carry the stale flag across.

## Schema mapping — theirs → ours

The menu shape does **not** map one-to-one. Their model is a single flat "modifier group"
primitive; ours deliberately splits that across three mechanisms
(`src/types/menu/sauce.ts`: _"deliberately NOT a general min/max-select engine"_).

| Theirs                                                                              | Ours                                                                                                    | Note                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `restaurant.address` (one string)                                                   | `addressLine1` / `city` / `postalCode` / `country`                                                      | Must be split: `12 Rue des Bleuets` / `Orchamps-Vennes` / `25390` / `FR`.                                                                                                                                                                                                                                                                                                                     |
| `restaurant.phone`                                                                  | `RestaurantPhoneNumberDto[]`                                                                            | Ours is a list with labels + a WhatsApp flag; theirs is one string.                                                                                                                                                                                                                                                                                                                           |
| `workingHours.<day>.intervals[]`                                                    | `UpdateWorkingHoursDto.shifts[]`                                                                        | Direct match — both model split lunch/dinner service. Their `open`/`close` top-level pair is the same legacy first-window mirror our `openTime`/`closeTime` is. `"HH:mm"` → `"HH:mm:ss"`. Monday is closed.                                                                                                                                                                                   |
| `product.sizes[].price` (**absolute**)                                              | `variations[].priceModifier` (**relative**)                                                             | Conversion required: `priceModifier = size.price − basePrice`. Getting this backwards silently misprices **29 products / 68 variations** — measured, and previously written here as "40 products", which contradicted this file's own summary table. `map.mjs --verify` re-derives every absolute price back out of the payload, which is the only check that tells the two directions apart. |
| Groups 79 `Boissons`, 81/83/84 `N Viandes`, 85 `Viande au choix`, 87 `Fille/Garçon` | `MenuDefinition` → `MenuSection` (`isRequired`, `minSelection`, `maxSelection`) + `ProductType: 'menu'` | These are genuine "choose from a list" steps and fit our bundle sections cleanly. This is how "Menu Kebab = sandwich + drink" should be built.                                                                                                                                                                                                                                                |
| Group 77 `SAUCES` (min 1, max 2)                                                    | `SauceGroupRule` (`min`/`max`/`includedFree`) + `ProductType: 'sauce'`                                  | Direct match. `includedFree` = 2 to keep both sauces free, as they are today.                                                                                                                                                                                                                                                                                                                 |
| Groups 78/80/86/88 `Sans X`                                                         | `ProductIngredient` with `isOptional: true`, `isIncludedInBasePrice: true`                              | Deselecting removes it. Not a modifier group in our model.                                                                                                                                                                                                                                                                                                                                    |
| Groups 76 `+ Viande/Cheddar/…`, 82 `Ajouter Legume`                                 | `ProductIngredient` with `isOptional: true`, `price > 0`, `isIncludedInBasePrice: false`                | Paid add-ons.                                                                                                                                                                                                                                                                                                                                                                                 |
| `siteSettings` (`themePreset: street`, `customAccent: #F5A524`, dark base)          | `themePaletteKey` (ADR-007) + template tokens                                                           | Their accent is an orange we can carry; the rest is their platform's vocabulary, not ours. Home hero/tagline map to landing-page config.                                                                                                                                                                                                                                                      |
| `currency: EUR`                                                                     | `TENANT_CURRENCY` + `TENANT_LOCALE`                                                                     | Build this tenant with `currency: EUR` **and** `locale: fr-FR`, or prices render `EUR 8.00` instead of `8,00 €`. Both default to the Swiss values, so the locale must be passed explicitly.                                                                                                                                                                                                   |
| `table.qrToken`                                                                     | —                                                                                                       | Theirs; we mint our own. Redacted here.                                                                                                                                                                                                                                                                                                                                                       |

### Platform fix this raised (done)

`src/utils/currency.ts` used to hard-code `DEFAULT_LOCALE = 'de-CH'` while taking only the
currency _code_ from config, so this tenant would have rendered `EUR 8.00` on every price.
Fixed separately by the `fix/tenant-locale-price-formatting` PR: `TENANT_LOCALE`
(`NEXT_PUBLIC_TENANT_LOCALE`, `de-CH` fallback) drives both formatters there, plumbed through the
Dockerfile and the tenant build workflows as a `locale` input beside `currency`. That PR is a
prerequisite for onboarding this tenant.

**So this tenant must be built with `locale: fr-FR`.** It is a new, optional registry field in
the deploy repo; until that repo emits it every tenant falls back to `de-CH`, which is the Swiss
tenants' correct value but not this one's. Adding `locale: fr-FR` to MC FOOD's registry entry is
a prerequisite for onboarding, not a nice-to-have.

### Also captured, decide at onboarding

`onlinePaymentEnabled: true` with a 5 % online service fee (`serviceFeeOnlinePercent`), plus
`loyaltyCardEnabled`, `supportChatEnabled`, `orderEmailEnabled`. Their loyalty _settings_ sit
behind auth (`401`) so only the on/off flag is known — the point balances and rules need to come
from Mustafa if they're to be carried over.

`orderNotificationEmail` is set to a personal Gmail address. It is exposed by their public API,
but it is redacted in `dataset.json` rather than committed to our history — collect it from
Mustafa at onboarding.

## Importing it

Provisioning gives an **empty** tenant — it seeds `RestaurantInfo` and nothing else, and no
runbook covers the catalogue. (The demo tenant got its menu by cloning another tenant's
_database_, which needs a source tenant already on the platform. MC FOOD is the first
tenant whose catalogue comes from outside.) These two scripts are that missing step.

```bash
node fetch.mjs out                      # materialise the 94 images (~31 MB, not in git)
node map.mjs --verify                   # exhaustive offline self-check
export MCFOOD_TOKEN=...                 # a menu:write API token
node import.mjs --base https://mcdoner.sofrapiwas.com --dry-run
node import.mjs --base https://mcdoner.sofrapiwas.com
```

The token comes from `MCFOOD_TOKEN`, not from a flag: `--token "$TOKEN"` expands before exec,
so it would be visible in `ps` to anyone else on the box and written to the shell history.
`--token` still exists as an escape hatch. It is an API token with the **`menu:write`** scope,
minted in the tenant's own admin.
One scope is enough for the whole import, images included: a token carries the Admin role
claim so it satisfies the `[RequireAdmin]` on the image endpoints, while `ApiTokenScopeFilter`
still denies it every endpoint not annotated with a scope it holds. No password is involved.

**Both scripts REFUSE to run while any decision they depend on is `confirmed: false`.** A
guess that silently becomes a menu is the failure this design exists to prevent — four of
these groups, read literally, would force every guest to remove an ingredient before they
could order.

`import.mjs` writes each created id to a state file **immediately after the server confirms
it** (write-then-rename, so a crash cannot leave half a file), and a record and its **image**
resume independently — keyed together, a crash during an upload left that record permanently
image-less. **A dry run writes no state at all**, which is what makes the two-command recipe
above safe: it used to poison the default state file, so the real run skipped every request
and reported success against an empty tenant.

Verified against a stub API, not by inspection:

|                       |                                                                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| full run              | **303** requests — 16 categories + 16 `PUT` category image + 124 product creates (57 mainItem, 11 beverage, 22 component, 34 menu) + 102 images + 45 `PUT` menuDefinition |
| complete re-run       | **0** requests                                                                                                                                                            |
| killed at request 150 | state `16/22/44/0/8/59`; resumed with **154**, and 149 + 154 = 303 — the clean run's exact total, **no duplicates**                                                       |
| dry run               | writes **no** state file                                                                                                                                                  |

The 45 `menuDefinition` updates are **34** bundles carrying `Plat` + a drink or meat choice,
and **11** existing dishes that needed a choice step of their own (Tacos and LIBANAISE
1/2/3 Viande, Assiette Mixte, Galette, the three Menu Enfant).

Order is the contract, and each step needs the one before it: categories → components (a
section cannot point at a product that does not exist) → products → menus (a `Plat` section
wraps a dish that must already exist).

**What none of that checks is the server's own validation.** `map.mjs --verify`'s price check is
a real oracle — their absolute price is a number it did not compute — but the content, string and
sauce checks only assert the shape `map.mjs` was written to produce. Three defects got through
that way (a `null` description that 400s, an `exclusionGroup` that made add-ons mutually
exclusive, and a sauce rule with no sauce rows). The cheap structural fix is to round-trip one
product through a real staging `POST /api/Products` as part of the pre-flight; until then, do the
first real import against **staging**, not the tenant.

### Two API limits worth knowing before you look for a bug

- **Category names cannot be translated at all.** `CreateCategoryCommand(Name, Description,
IsActive, DisplayOrder, AvailableOrderTypes)` has no content map and there is no
  `CategoryDescription` entity. For a `[fr, en]` tenant that means the 16 category headings are
  permanently French in the `en` locale. Not something this script can fix.
- **Category `displayOrder` is discarded by the server** — `CreateCategoryCommandHandler` sets
  `DisplayOrder = max + 1` regardless of what is sent. Their order survives only because this
  script creates them in order. Do not reorder the loop expecting the field to hold it.

### What the importer does NOT do yet

The **bundle steps** — `MenuDefinition` + `MenuSection` + component products. Six groups
across 40 product references, including group 79 `Boissons`, the drink choice on all 29
"Menu X" sizes. `map.mjs --verify` names every one of them and **refuses to emit** until
they are built, rather than shipping a catalogue that looks complete and silently drops a
step. Also not imported: working hours, the table, and the restaurant profile.

### The size/product asymmetry, which is easy to miss

Their modifier groups hang off **both** the product and the individual size. Product 395
"Kebab" lists `[76,77,78,79]` at product level while its `Kebab Seul` size lists `[76,77,78]`
— group 79 is the drink, and it belongs to the `Menu Kebab` size alone. Read at product
level, a guest ordering the plain sandwich is asked to choose a drink they are not getting.
So the **default size's** list governs a plain product, and the menu sizes are what become
bundles.

## Scope note

Only public read endpoints were used. Their `/api/admin/*` and `/api/superadmin/*` routes are
visible in their JS bundle and were deliberately left alone; anything behind their login needs
Mustafa's say-so and his credentials, not ours.
