# Tenant copy — how a restaurant's own words reach its own image

> Companion to [TEMPLATES.md](TEMPLATES.md) (which skin a tenant) and `src/lib/config.ts` (what a
> tenant image bakes). This file answers one question: **whose words are in `src/locales/*.json`?**

## The rule

`src/locales/*.json` is the **platform bundle**. It is what every tenant image inherits when
nothing overrides it, so **anything in it that is true of only one restaurant is that restaurant's
identity leaking onto every other one**.

That is not hypothetical. It shipped twice:

- `scripts/check-locale-parity.mjs` swept 63 hardcoded "Genève" / "Женеве" / "日内瓦" out of these
  files — tenant 1's **city**, in nine languages, in the page titles of every tenant on the platform.
- On 2026-08-19 a French restaurant in Montreal-la-Cluse was provisioned and its home page announced
  **"Authentic Turkish Cuisine"**, its hero read **"Discover Authentic Turkish Flavors"**, and its
  `<title>` said it was in **Switzerland**. Tenant 1's **cuisine and country**, this time.

So: platform copy is **cuisine-neutral, country-neutral, city-neutral**. A city or a country in the
copy comes from `RestaurantInfo` as `{{city}}` / `{{country}}`; a cuisine comes from the tenant.

Enforced by `src/locales/tenantNeutralCopy.test.ts`, which reads the VALUES in all ten locales.
The placeholder gate cannot see this class of defect and says so in its own comment: _"a key that
hardcodes a tenant value in the ENGLISH source has nothing to compare and stays invisible here."_

## Tenant copy packs

A tenant whose own wording differs from the platform default puts it in

```
src/locales/tenant/<pack>/<locale>.json     # all ten locales, keys that already exist in the platform bundle
src/locales/tenant/<pack>/index.ts          # imports them into one object
```

registers it in `TENANT_COPY_PACKS` (`src/lib/tenantCopy.ts`), and bakes the pack name into its
image:

```
NEXT_PUBLIC_TENANT_COPY_PACK=<pack>         # Dockerfile ARG → build-image.yml / build-tenant-image.yml
```

`src/i18n.ts` lays the pack over the platform bundle per locale, so **no callsite changes** — `t()`
and `copy()` see one merged bundle. An unknown pack name **fails the build** rather than silently
falling back to platform copy.

Today there is exactly one pack, `rumi`, applied by `build-image.yml`'s **prod** job — the same seam
that applies `public/branding-rumi/`. RUMI is a tenant like any other; its Turkish positioning is
its own, not the platform's.

## Why a pack and not a `RestaurantInfo.tagline` field

O6 made runtime data the right home for a tenant's **logo**, and the same instinct says a tagline
belongs on `RestaurantInfo` — admin-editable, no rebuild. It is the wrong tool for **this** job for
one reason: **a single free-text field cannot be translated.** RUMI serves its positioning in ten
languages today; one admin string would render "Authentic Turkish Cuisine" to a German visitor who
currently reads "Authentische türkische Küche". The hard constraint on the neutralising change was
that RUMI prod reads exactly as it does today, and only a per-locale overlay can promise that.

A `RestaurantInfo.tagline` is still the right feature for a **self-serve** tenant's own one-line
positioning — one string, the owner's language, typed in tenant admin, with the neutral platform
copy as the fallback when it is empty. It is additive to this design (a pack would win over it, or
the two would occupy different keys), it needs a backend field + migration + admin UI, and it is
**not** a substitute for taking tenant 1's words out of the shared bundle. Track it separately.

## First paint: `copy()` and `staticText()`

The locale is chosen in the **browser** (`src/i18n.ts` detects it from `localStorage` → `navigator`),
so the server cannot know it. The home templates therefore render twice: an English first pass on the
server and in the browser's first render, then the visitor's own language after hydration.

That first pass used to be a **string literal typed into the component**
(`isClient ? t('home_hero_title') : 'Discover Authentic Turkish Flavors'`). Two defects:

1. it was the leaked copy, and it is what a crawler and the first paint actually see;
2. where it was not tenant-1's identity it had simply **drifted** — the server rendered "View Menu"
   and "Visit Us" while the hydrated page said "Explore Our Menu" and "Find Us".

Use `makeCopy(t, isClient)` from `src/lib/staticCopy.ts` and write the key **once**:

```tsx
const copy = makeCopy(t, isClient);
...
<h1>{copy('home_hero_title')}</h1>
<p>{copy('home_story_content', { name, city })}</p>
```

`scripts/check-t-keys.mjs` scans `copy(` and `staticText(` alongside `t(`, so a key that resolves
nowhere still fails the gate.

## Adding a home-page or SEO string

1. Write it **cuisine/country/city-neutral** in `src/locales/en.json`, then all ten locales.
2. If it names a place, interpolate `{{city}}` / `{{country}}` — never spell one out.
3. Add it to `HOME_AND_SEO_KEYS` in `src/locales/tenantNeutralCopy.test.ts`.
4. If a tenant pack should override it, add it to **every** locale of that pack (the pack contract
   test requires identical key sets across all ten).
