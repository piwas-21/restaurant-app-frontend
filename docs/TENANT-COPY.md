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
one reason: **a single free-text field cannot be translated.** RUMI provides ten UI/copy-pack locales (its current audited discovery candidates are `fr/en/tr`; catalogue coverage is separate); one admin string would render "Authentic Turkish Cuisine" to a German visitor who
currently reads "Authentische türkische Küche". The hard constraint on the neutralising change was
that RUMI prod reads exactly as it does today, and only a per-locale overlay can promise that.

A `RestaurantInfo.tagline` is still the right feature for a **self-serve** tenant's own one-line
positioning — one string, the owner's language, typed in tenant admin, with the neutral platform
copy as the fallback when it is empty. It is additive to this design (a pack would win over it, or
the two would occupy different keys), it needs a backend field + migration + admin UI, and it is
**not** a substitute for taking tenant 1's words out of the shared bundle. Track it separately.

## First paint: `firstPaintCopy()` and `copy()`

Public home and menu routes use an explicit `/{locale}` URL. Middleware supplies that locale to
root layout and the request-local i18next provider, so the initial HTML and first browser render
use the same language, tenant copy pack and `lang`/`dir`. Stored preferences apply to unlocalized
operational pages; they do not override an explicit public path.

Use `firstPaintCopy(i18n, locale)` from `src/lib/firstPaintCopy.ts` before hydration, then `t` from
that provider. Write each key once:

```tsx
const copy = isClient ? t : firstPaintCopy(i18n, locale);
<h1>{copy('home_hero_title')}</h1>
<p>{copy('home_story_content', { name, city })}</p>
```

The helper reads the existing i18next instance rather than importing a duplicate translation
bundle. English remains its fallback for callers without an explicit locale. `check-t-keys.mjs`
scans `copy(` alongside `t(`, so these keys remain checked.

Home/indexability coverage also reads authored landing overrides. Display language options and
confirmed equivalent pages are separate; see [PUBLIC-DISCOVERY.md](PUBLIC-DISCOVERY.md).

## Adding a home-page or SEO string

1. Write it **cuisine/country/city-neutral** in `src/locales/en.json`, then all ten locales.
2. If it names a place, interpolate `{{city}}` / `{{country}}` — never spell one out.
3. Add it to `HOME_AND_SEO_KEYS` in `src/locales/tenantNeutralCopy.test.ts`.
4. If a tenant pack should override it, add it to **every** locale of that pack (the pack contract
   test requires identical key sets across all ten).

## Runtime platform and partner credit

Both tenant templates use `PartnerCredit` and `/api/tenant/partner` for public attribution.
Enabled partner sites follow the partner's published name and optional website automatically.
Unpartnered sites show the platform's configured Sofra website and company contact email.
The email is attribution, not the restaurant's contact address. Restaurant opt-outs and
unpublished/withdrawn partner brands render no credit. Mounted pages refresh every minute;
normal publication takes at most two refresh intervals. An unavailable endpoint cannot block
ordering and cached footer attribution expires after five minutes without a successful read.
