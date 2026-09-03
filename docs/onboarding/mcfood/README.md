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

| File                   |                                                                                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `dataset.json`         | Normalised, consolidated capture — restaurant, service config, hours, site theme, tables, all 13 modifier groups, and the 16 categories with their 69 products nested.   |
| `assets-manifest.json` | All 94 images: source object path, target filename, real format, byte size, **sha256**, and what each is used for.                                                       |
| `fetch.mjs`            | Re-runs the whole capture (`node fetch.mjs [outDir]`). Verified end-to-end: it reproduces all 94 assets byte-identically and self-checks against `assets-manifest.json`. |

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

| Theirs                                                                              | Ours                                                                                                    | Note                                                                                                                                                                                                                                                     |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `restaurant.address` (one string)                                                   | `addressLine1` / `city` / `postalCode` / `country`                                                      | Must be split: `12 Rue des Bleuets` / `Orchamps-Vennes` / `25390` / `FR`.                                                                                                                                                                                |
| `restaurant.phone`                                                                  | `RestaurantPhoneNumberDto[]`                                                                            | Ours is a list with labels + a WhatsApp flag; theirs is one string.                                                                                                                                                                                      |
| `workingHours.<day>.intervals[]`                                                    | `UpdateWorkingHoursDto.shifts[]`                                                                        | Direct match — both model split lunch/dinner service. Their `open`/`close` top-level pair is the same legacy first-window mirror our `openTime`/`closeTime` is. `"HH:mm"` → `"HH:mm:ss"`. Monday is closed.                                              |
| `product.sizes[].price` (**absolute**)                                              | `variations[].priceModifier` (**relative**)                                                             | Conversion required: `priceModifier = size.price − basePrice`. Getting this backwards silently misprices 40 products.                                                                                                                                    |
| Groups 79 `Boissons`, 81/83/84 `N Viandes`, 85 `Viande au choix`, 87 `Fille/Garçon` | `MenuDefinition` → `MenuSection` (`isRequired`, `minSelection`, `maxSelection`) + `ProductType: 'menu'` | These are genuine "choose from a list" steps and fit our bundle sections cleanly. This is how "Menu Kebab = sandwich + drink" should be built.                                                                                                           |
| Group 77 `SAUCES` (min 1, max 2)                                                    | `SauceGroupRule` (`min`/`max`/`includedFree`) + `ProductType: 'sauce'`                                  | Direct match. `includedFree` = 2 to keep both sauces free, as they are today.                                                                                                                                                                            |
| Groups 78/80/86/88 `Sans X`                                                         | `ProductIngredient` with `isOptional: true`, `isIncludedInBasePrice: true`                              | Deselecting removes it. Not a modifier group in our model.                                                                                                                                                                                               |
| Groups 76 `+ Viande/Cheddar/…`, 82 `Ajouter Legume`                                 | `ProductIngredient` with `isOptional: true`, `price > 0`, `isIncludedInBasePrice: false`                | Paid add-ons.                                                                                                                                                                                                                                            |
| `siteSettings` (`themePreset: street`, `customAccent: #F5A524`, dark base)          | `themePaletteKey` (ADR-007) + template tokens                                                           | Their accent is an orange we can carry; the rest is their platform's vocabulary, not ours. Home hero/tagline map to landing-page config.                                                                                                                 |
| `currency: EUR`                                                                     | `TENANT_CURRENCY` (`NEXT_PUBLIC_TENANT_CURRENCY`, CHF fallback)                                         | The currency _code_ is configurable and EUR is test-covered. The **locale is not**: `formatCurrency` defaults to `de-CH` (`src/utils/currency.ts`), so an EUR tenant renders `EUR 8.00`, not `8,00 €`. For a French tenant that needs a fix — see below. |
| `table.qrToken`                                                                     | —                                                                                                       | Theirs; we mint our own. Redacted here.                                                                                                                                                                                                                  |

### Follow-up this raises in our own code

`src/utils/currency.ts` hard-codes `DEFAULT_LOCALE = 'de-CH'` while taking the currency code
from config. `src/utils/currency.test.ts:157` pins today's behaviour: with `TENANT_CURRENCY=EUR`,
`formatCurrency(5)` still formats through `de-CH`. A French EUR tenant should read `8,00 €`
(`fr-FR`), so the tenant locale needs to drive the formatter the way the currency code already
does. Worth an issue before this tenant goes live — it is a platform fix, not tenant data, and
so is out of scope for this pack.

### Also captured, decide at onboarding

`onlinePaymentEnabled: true` with a 5 % online service fee (`serviceFeeOnlinePercent`), plus
`loyaltyCardEnabled`, `supportChatEnabled`, `orderEmailEnabled`. Their loyalty _settings_ sit
behind auth (`401`) so only the on/off flag is known — the point balances and rules need to come
from Mustafa if they're to be carried over.

`orderNotificationEmail` is set to a personal Gmail address. It is exposed by their public API,
but it is redacted in `dataset.json` rather than committed to our history — collect it from
Mustafa at onboarding.

## Scope note

Only public read endpoints were used. Their `/api/admin/*` and `/api/superadmin/*` routes are
visible in their JS bundle and were deliberately left alone; anything behind their login needs
Mustafa's say-so and his credentials, not ours.
