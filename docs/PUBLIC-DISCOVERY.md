# Public restaurant search discovery

Public home and menu pages use the existing i18next translations and tenant copy packs at
`/{locale}` and `/{locale}/menu`. The URL selects the language for server HTML and browser
navigation. Ten display-language options remain available; their existence does not establish
that a restaurant has translated its catalogue into ten languages.

## Route and indexability matrix

| Surface                                                           | Behavior                                                                                      | Discovery policy                                  |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `/`, `/menu`                                                      | Redirect to the configured public default, preserving safe context and supported menu queries | No independent sitemap entry                      |
| `/{locale}`                                                       | Server-rendered home, profile, landing overrides and hours; classic/craft preserved           | Index only audited home equivalents               |
| `/{locale}/menu`                                                  | Server menu snapshot followed by existing guest ordering controls                             | Index only complete audited catalogue equivalents |
| Menu pagination                                                   | Bounded product/offer and bundle pages with crawlable links                                   | Canonical page queries and reciprocal equivalents |
| `/scan` and printed QR links                                      | Existing table/session flow; configured default-locale menu handoff                           | Outside the indexable cluster                     |
| Reservations, legal and other unprefixed guest pages              | Existing routes and preference behavior                                                       | Outside the home/menu cluster; default noindex    |
| Cart, checkout, account, auth callbacks, orders, staff/admin, API | Existing operational routes                                                                   | Absent from sitemap; default noindex              |
| Demo/staging/unconfigured images                                  | Public routes remain usable                                                                   | Noindex, empty sitemap, robots disallow all       |

Tabbed category-filtered offer-family routes preserve `categoryId` and `page` through reload and browser history. They have a canonical for that filtered view and `noindex,follow`; they add no alternate or sitemap entry. Selecting the aggregate view clears the category filter.

The root layout owns the only `<html>` element. Middleware overwrites its internal locale header
from a supported public path, so request headers cannot spoof it. Arabic has `dir="rtl"` in the
initial response. Explicit public paths override account preferences, localStorage and browser
language. `DocumentLanguage` observes client navigation and back/forward changes as well.

## Build policy and canonical hosts

These public settings are baked into each tenant image:

| Variable                              | Purpose                                                               |
| ------------------------------------- | --------------------------------------------------------------------- |
| `NEXT_PUBLIC_TENANT_CANONICAL_ORIGIN` | Trusted absolute origin from the tenant registry/domain configuration |
| `NEXT_PUBLIC_PUBLIC_DEFAULT_LOCALE`   | Default public language, independently of price-formatting locale     |
| `NEXT_PUBLIC_PUBLIC_HOME_LOCALES`     | Comma-separated candidate home languages                              |
| `NEXT_PUBLIC_PUBLIC_MENU_LOCALES`     | Comma-separated candidate catalogue languages                         |
| `NEXT_PUBLIC_PUBLIC_INDEXING_ENABLED` | Explicit `true` enables auditing for indexing; otherwise disabled     |

Candidate lists contain unique supported base codes and include the default. They are an upper
bound: runtime coverage can remove candidates. A domain, language or policy change requires an
image rebuild. Never derive canonical origins from request `Host` or a visitor-supplied URL.

| Deployment    | Canonical origin                     | Default | Candidate home/menu languages | Indexing            |
| ------------- | ------------------------------------ | ------- | ----------------------------- | ------------------- |
| RUMI          | `https://www.rumirestaurant.ch`      | `fr`    | `fr,en,tr`                    | Enabled after audit |
| MC FOOD       | `https://mcdoner.solutioneva.com`    | `fr`    | `fr,en`                       | Enabled after audit |
| Kebab d'Ilhan | `https://kebabdilhan.sofrapiwas.com` | `fr`    | `fr,en`                       | Enabled after audit |
| Demo          | `https://demo.sofrapiwas.com`        | `fr`    | `fr,en`                       | Disabled            |

BYO aliases and `www` redirects remain the deploy registry/Caddy responsibility. The frontend
emits the configured origin even for an alias request. No page advertises another tenant's URLs.

## What counts as translated

Home coverage checks the tenant-overlaid bundled copy and the current landing-page override map.
If authored prose exists in one language, corresponding overrides must exist in an advertised
equivalent. An unknown landing response does not establish coverage.

Menu coverage checks the complete active public categories, products and bundles, including mapped category-offer anchors and named offer targets visible in that presentation. A non-source
language needs a nonblank translated name and a translated description whenever source description
text exists. Regional content keys resolve consistently with the displayed text. Declared source
text can serve its own language; older rows without source metadata use the audited public default.
Built-in category vocabulary is eligible only when it actually resolves and no untranslated
category description would leak. Missing translations remove the entire non-equivalent menu
variant from hreflang and sitemap, while guests can still select that interface language.

The 2026-09-30 anonymous API audit found these collection totals:

| Tenant        | Products | Bundles | Active categories | Coverage observation                                                                |
| ------------- | -------: | ------: | ----------------: | ----------------------------------------------------------------------------------- |
| RUMI          |       83 |       0 |                10 | Product translations are partial; categories carry no explicit translation map      |
| MC FOOD       |       43 |      45 |                16 | Bundles expose French/English entries; categories carry no explicit translation map |
| Kebab d'Ilhan |       50 |      14 |                12 | French/English item entries exist; categories carry no explicit translation map     |
| Demo          |       45 |      45 |                18 | Mixed category source/translation metadata; deliberately noindex                    |

These are API totals before visible-row filtering, not a claim that every candidate language is
complete. The live sitemap and emitted page alternates are the current audited result. Re-audit
after menu edits rather than freezing this inventory into routing logic.

## Data, hydration and freshness

`publicDiscoveryService` uses existing anonymous backend contracts for restaurant info, landing
content, hours, categories, products, menus and catalogue offer families. Requests have a five-second
timeout and a 30-second revalidation window. This is bounded freshness, not instantaneous publish
invalidation. No new backend API or tenant catalogue migration is required.

Collection readers validate page metadata, stable unique identities and count/completeness evidence.
Unknown totals, repeated pages, failures or the bounded page limit suppress indexing rather than
advertising a complete catalogue. A confirmed empty bundle collection is valid. Legacy one-page menus
render the complete bounded category/product and bundle snapshot at one logical menu URL;
pagination queries normalize to that URL. When one-page layout is combined with category offers, offer families remain paginated, category controls scroll within that page, and `categoryId` filters normalize away. Products/bundles
are bounded to 20 upstream pages of 200 rows; categories to five pages of 100; offer families to
20 pages of 100. Guest visibility rules exclude inactive, unavailable and internal component rows.

Server snapshots seed the existing menu hooks. Confirmed empty categories can skip the initial category request; failed category snapshots retain incomplete status and retry through the guest hooks, so a temporary outage cannot permanently blank a one-page menu. A failed client landing refresh retains its known server snapshot instead of replacing restaurant-authored prose with bundled defaults. Product/bundle identities, customization and cart
behavior remain separate. One-page, tabbed and category-offer presentation retain their existing
flows. Cart/table/session providers stay above the public page. Language and pagination navigation
must reconcile the new snapshot without replacing those shared providers.

`Restaurant` JSON-LD uses the public restaurant record: name, address, active phone, coordinates
when supplied, canonical/menu URLs and valid active opening windows. It invents no ratings, cuisine,
reviews or offers. Missing data stays absent. The manifest starts at the public default and retains
root scope; the existing service worker is network-only and provides no offline menu cache.

## Release verification

Run lint, typecheck, relevant unit tests and the emitted-output contract wired into CI. Its fixture
must exercise a catalogue larger than one upstream page, missing translations, a valid empty bundle
set, repeated/unknown pagination, a temporary category outage with client recovery, inactive hours, Arabic, conflicting preferences and noncanonical/noindex policy. Offer-family and product pagination must preserve reload and back/forward behavior.
Inspect actual HTML/XML rather than only metadata helper objects.

After a staging/demo release, check guest language/history navigation, filters, customization/cart,
QR table handoff and manifest/service-worker behavior. Then verify each advertised production URL
from its sitemap with the workspace `scripts/verify-public-discovery.py`. Google/Bing inspection
is a separate evidence level: HTTP success and submission do not prove indexing, ranking or citation.
The workspace [public discovery runbook](https://github.com/piwas-21/rumi-workspace/blob/main/docs/runbooks/public-search-discovery.md) describes
ownership verification, recrawl checks and ongoing measurements.
