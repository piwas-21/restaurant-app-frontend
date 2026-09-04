# MC FOOD (Orchamps-Vennes) — onboarding data pack

Partner: Mustafa. Source: their temporary site **https://mcdoner-orchamps.fr/**.
Captured **2026-09-03**, imported the same day into `mcdoner.sofrapiwas.com`.

**The first run produced a catalogue with nine structural defects**, all repaired by hand against
the live tenant on 2026-09-03 and every one of them passing `map.mjs --verify` green. The scripts
have since been changed so they cannot reproduce them —
[The rules the platform enforces](#the-rules-the-platform-enforces--learned-by-shipping-them-wrong)
is what they are and how each is now gated. Read that section before running this pack against the
next partner-migrated tenant; it is the part of it that was learned rather than designed.

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
| Groups 79 `Boissons`, 81/83/84 `N Viandes`, 85 `Viande au choix`, 87 `Fille/Garçon` | `MenuDefinition` → `MenuSection` (`isRequired`, `minSelection`, `maxSelection`) + `ProductType: 'menu'` | These are genuine "choose from a list" steps and fit our bundle sections cleanly — under rules 2–4 below. **`minSelection` is the count the group's own name sells, not their `minSelect: 1`**: "3 Viandes" on a 13,00 € three-meat tacos means 3..3, or the guest pays for three and picks one. Group 79's items are the REAL beverages; the others are hidden components.                   |
| Group 77 `SAUCES` (min 1, max 2)                                                    | `SauceGroupRule` (`min`/`max`/`includedFree`) + rows with `kind: 'sauce'`                               | Direct match on the rule. `includedFree` = 2 to keep both sauces free, as they are today. The ROWS are `isOptional: true, isIncludedInBasePrice: false` — always, whatever the source group says. The rule is what makes a sauce required; the flags are what decide whether the app PRESELECTS it, and preselecting all 11 is a 400. Rule 1 below.                                           |
| Categories `BOISSONS` (13) and `DESSERTS` (3)                                       | `ProductType: 'beverage'` / `'dessert'`                                                                 | Per category, from `decisions.productTypes`, fail-closed. Not cosmetic: `useDrinkUpsell` asks the catalogue for `Type=Beverage`, and `groupSuggestedSideItems` partitions a dish's sides by the side's own type.                                                                                                                                                                              |
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

## The rules the platform enforces — learned by shipping them wrong

Nine defects reached the live tenant on the first run, and all of them passed this pack's own
self-check. That is the lesson before the list: every offline gate here asked whether the payload
was the shape the mapper meant to emit, and none asked whether the shape could be **ordered**.

Each rule below is now a blocking check, and each was verified by putting its defect back and
watching the gate go red — the count in brackets is what the reinstated defect produces.

### 1. A sauce is `isOptional: true`, never `false` — the order blocker \[50]

`buildBaseIngredientSelection` (`src/utils/ingredientSelection.ts`) preselects a row when
`!isOptional || isIncludedInBasePrice === true`. The sauce group declared **neither** flag,
`JSON.stringify` drops `undefined`, the server read both as false — so the app's own default
payload asked for all 11 sauce rows against a `sauceMax` of 2 and `POST /api/Basket/items`
answered **400 `SauceMaximumExceeded`** on every savoury dish, from the day the tenant opened.

What makes a sauce _required_ is the group rule (`sauceMin`/`sauceMax`/`sauceIncludedFree`), never
the ingredient flag — and a non-optional sauce is not merely preselected, it is also dropped from
the free allowance, which `waivedSauceUnits` allocates only over rows that are
`isSauce && isOptional && isActive`. kebabdilhan's sauces are `isOptional: true`.

**Gated by** `rowFlags`, which forces `isOptional: true, isIncludedInBasePrice: false` on every
`kind: 'sauce'` row and **throws** when any other group leaves either flag undeclared — an absent
key reading as false is exactly how this shipped. And by `verifyDefaultSelection`, which rebuilds
the app's own default payload and fails when it exceeds `sauceMax`. That check has an external
referent at both ends (the util's preselect rule, the server's ceiling), which is why it sees what
five shape checks could not.

### 2. A `type: menu` product's own recipe and sauce rule are DEAD DATA \[11]

`buildBundleSteps` maps **sections only**, and `BasketItemFactory.BuildMenuItemAsync` never reads
the parent's `SelectedIngredients` — the parent row stores no composition at all. So rows on a menu
are not redundant, they are invisible: the guest cannot see them, the ticket does not carry them,
and the admin who edits them changes nothing. 11 dishes shipped that way.

A dish that carries a choice step **is** a menu in our model, so its recipe moves to a hidden
**carrier component behind its one-item `Plat` section** — the shape that already makes `Menu
Kebab` work. That is the `dish` component family. **Gated by** `verifyMenusCarryNoRecipe`.

### 3. A `MenuSectionItem` references a PRODUCT, not a variation \[5]

So a portion sold as a _size_ is unreachable from a bundle: `Menu 12 X Nuggets` charged 15,00 € and
delivered `6 X Nuggets`. The five large TEXMEX portions each get their own `portion` component, and
a menu's `Plat` points at it. Matched on the name with `Menu ` stripped (their spacing is
inconsistent — `12X` vs `12 X`), and refused when the match is not unique.

**Gated by** `verifyMenuUplift`, which is an oracle rather than a mirror: every menu on this carte
is its dish plus a fixed 3,00 €, so the menus of one product must all show the **same** uplift over
whatever their `Plat` advertises. Pointed at the base, `Menu 12 X Nuggets` reads `+8` beside its
sibling's `+3`. Nothing structural could see it — the reference was to a real, existing product.

### 4. A bundle's drink section references the REAL beverages \[374]

The first run pointed all 34 menus at 11 phantom 0,01 € `isComponent` copies. Everything about that
reads fine, and it is a parallel catalogue: an admin's price edit reaches no menu, and a drink
marked sold out stays orderable inside every bundle.

The counter-argument that created them is real but narrower than it was applied: group 81's meat
option `Kebab` name-matches the SANDWICHES product `Kebab` (8,00 €), and pointing a Tacos' meat
section at that would put a whole priced sandwich inside the tacos. That holds for meats and gifts.
It never applied to a drink, where the option **is** the product. So `meat`/`gift`/`dish`/`portion`
are components and drinks are not, and `decisions.bundles.drinkProducts` maps each option to its
real product explicitly — their names do not match (`Coca Cola` is `Coca Cola 33cl`, `Fanta` is
`Fanta Orange`, `Eau` is `Eau 50cl`, `Coca Cola Cherry` is `Coca Coca Cherry 33cl`, typo and all),
so a fuzzy match over four of eleven would be a guess. **Gated by** `verifyDrinkSections`.

Relatedly, and from the same cause: every catalogue product was hard-coded `type: mainItem`, so the
13 real drinks and 3 desserts were main dishes. `useDrinkUpsell` asks for
`GET /api/Products?Type=Beverage`, which then answered **0** — no dish on the menu was ever offered
a drink — and `groupSuggestedSideItems` partitions a dish's sides by the **side's own** type, so the
desserts landed under "accompaniments". The type now comes from `decisions.productTypes` per
category, fail-closed, and `--verify` re-reads the category's **own name**: a heading called
BOISSONS typed anything but `beverage` is a failure.

### Two more, cheaper but real

- **A section whose NAME sells N must REQUIRE N.** \[9 sections] Their groups say
  `minSelect: 1, maxSelect: N` on a group they themselves called "3 Viandes", sold on "Tacos 3
  Viande" at the three-meat price — so a guest pays 13,00 € for three meats and may leave with one.
  Gated by `verifySectionCounts`, against their own group name.
- **`hideBaseProduct` belongs only on a product that has variations.** \[24] It was derived from
  the SOURCE size count, which stopped equalling the emitted variation count the moment the
  `Menu …` sizes became bundles. `isBaseRowHidden` degrades it to false on client and server, so
  nothing was unorderable — it is a lie stored in the catalogue and shown ticked in the admin. Now
  derived from the emitted variations, and gated by `verifyBaseRow` against the platform's rule.

### One trap the move itself created

Moving 11 recipes onto carriers took those rows out of six gates at a stroke — every check scoped
to `products` simply stopped seeing them, and stayed green. `runVerify` now runs them over
`recipeOwners` (`products` + `components`), and prints the row totals so the drop is visible:
**771 recipe rows / 50 sauce rules / 550 sauce rows**, the same numbers as before the move. A gate
that passes because it found nothing is worse than one that fails.

### Writing to an existing catalogue

- **Everything goes through `PUT /api/Products/{id}`, bundles included.** Never
  `PUT /api/Menus/{id}`: `UpdateMenuBundleCommandHandler` `RemoveRange()`s `ProductCategories`
  before its own null guard, so **no payload** sent there can preserve a bundle's categories
  (backend #190). The product handler updates `MenuDefinition` when `type == menu` and keeps
  categories.
- **`UpdateProductCommand` is a full replace.** Build every body from a live `GET` and patch it.
  Preserving `detailedIngredients[].id` is load-bearing — `IngredientQuantitiesJson` on past orders
  keys off it.
- **The API token authenticates as `Authorization: Bearer sk_live_…`, not `X-Api-Token`.** Almost
  every catalogue `GET` is `[AllowAnonymous]`, so a read succeeding proves **nothing** about the
  token. `GET /api/ApiTokens` is the discriminator: 403 with a valid token, 401 without.
  (`import.mjs` already sends `Bearer`; this is for anything written by hand alongside it.)

### Known and not fixed

**`sauceMin` is not enforced server-side.** A dish with a one-sauce minimum accepts an order
carrying none — the gate is `stepBlocker` in the browser only. Measured; harmless here, and not
MC FOOD-specific.

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

|                       |                                                                                                                                                                                                                                               |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| full run              | **263** requests — 16 categories + 16 `PUT` category image + 84 `POST /api/Products` (57 plain catalogue products + 27 hidden components) + 45 `POST /api/Menus` (34 wrapper menus + 11 dishes that carry a choice step) + 102 product images |
| complete re-run       | **0** requests                                                                                                                                                                                                                                |
| killed at request 150 | measured at **303** requests, before the four rules below changed what is created; the resume arithmetic is unchanged and the total is now 263 — **re-measure before quoting it**                                                             |
| dry run               | writes **no** state file                                                                                                                                                                                                                      |

The 45 `POST /api/Menus` are **34** wrapper bundles (`Plat` + a drink choice) and **11** dishes
that carry a choice step of their own (Tacos and LIBANAISE 1/2/3 Viande, Assiette Mixte, Galette,
the three Menu Enfant). Those 11 are `type: menu`, so their recipe lives on a hidden carrier behind
their `Plat` — rule 2 below.

The 27 hidden components are **9** meats, **2** gifts, **11** recipe carriers and **5** large
TEXMEX portions. There are no hidden _drinks_: a bundle's drink section names the real beverages —
rule 4 below.

Order is the contract, and each step needs the one before it: categories → components (a
section cannot point at a product that does not exist) → products → menus (a `Plat` section
wraps a dish that must already exist).

**What none of that checks is the server's own validation** — and that gap is what shipped nine
defects. `map.mjs --verify` has real oracles: the price check re-derives a number it did not
compute, and four of the gates added since read the platform's own rules rather than the mapper's
intent. But the content, string and structural checks only assert the shape `map.mjs` was written
to produce, and a check that agrees with the mapper cannot disagree with it.

**The decisive verification is placing a real order for every item.** Nothing structural found the
`SauceMaximumExceeded`; one basket POST found it immediately. After an import, sweep the catalogue:
for every product and every bundle, `POST /api/Basket/items` with **the payload the app itself
would build** — `buildBaseIngredientSelection` for a product's ingredients, each required section's
first option for a bundle — and assert the line comes back charged at the advertised price. Two
failure modes, both of which have happened here: a 4xx (the item cannot be ordered at all) and a
200 at the wrong price (`Menu 12 X Nuggets` at 15,00 € delivering the 6-piece).

That sweep is not in `import.mjs` — it needs a live tenant and a basket session, which is the other
side of this pack's pure/transport split. Until it is written, run it by hand, and do the first
real import of any new tenant against **staging**, not the tenant.

### Two API limits worth knowing before you look for a bug

- **Category names cannot be translated at all.** `CreateCategoryCommand(Name, Description,
IsActive, DisplayOrder, AvailableOrderTypes)` has no content map and there is no
  `CategoryDescription` entity. For a `[fr, en]` tenant that means the 16 category headings are
  permanently French in the `en` locale. Not something this script can fix.
- **Category `displayOrder` is discarded by the server** — `CreateCategoryCommandHandler` sets
  `DisplayOrder = max + 1` regardless of what is sent. Their order survives only because this
  script creates them in order. Do not reorder the loop expecting the field to hold it.

### What the importer does NOT do

The **working hours**, the **table** and the **restaurant profile** — those are `RestaurantInfo`
and `WorkingHours`, not the menu, and this pack is the catalogue.

It also does not build the **Accompagnement** section (`Frites` on the 34 wrapper menus) that the
live tenant carries; that was added by hand and is a shape decision, not a defect this pack can
derive from their data. And it does not write **allergens or dietary labels**, which are recipe
facts only the kitchen knows.

The bundle steps themselves ARE built (34 wrapper menus, 11 sectioned dishes, 27 components).
`map.mjs --verify` still derives which groups actually reached a section from the OUTPUT and
**refuses to emit** if any fell out of the mapping — that check stays precisely because it can now
legitimately be empty, which is when a silent regression would be invisible.

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
