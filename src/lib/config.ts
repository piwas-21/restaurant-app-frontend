/**
 * Build-time tenant configuration (CLAUDE.md §5.12): NEXT_PUBLIC_* values are
 * read once here and exported as typed constants — never scattered through
 * components.
 *
 * RESTAURANT_NAME is baked into the bundle at build time (Dockerfile ARG →
 * build-image.yml for RUMI prod, build-tenant-image.yml per tenant), so it is
 * identical on server and client and SSR fallbacks can never cause a
 * hydration mismatch. Runtime truth is the RestaurantInfo API
 * (`useRestaurantInfo`); this constant is the pre-API / API-unreachable
 * fallback and the value for baked print/export surfaces (issue #125).
 */
export const RESTAURANT_NAME = process.env.NEXT_PUBLIC_RESTAURANT_NAME || 'Restaurant';

/**
 * ISO 4217 currency code for every user-facing price, baked in at build time
 * (deploy repo registry `currency:` field → build-tenant-image.yml `currency`
 * input → Dockerfile ARG). Pairs with the backend's
 * `LocalizationSettings.Currency` (backend PR #147, deploy PR #33). Trimmed
 * and validated: anything other than a 3-letter uppercase code (unset, empty,
 * junk) falls back to CHF, so the default (RUMI) build renders byte-identical
 * strings everywhere. Consumers format via src/utils/currency.ts helpers.
 */
const rawTenantCurrency = (process.env.NEXT_PUBLIC_TENANT_CURRENCY ?? '').trim();
export const TENANT_CURRENCY: string = /^[A-Z]{3}$/.test(rawTenantCurrency) ? rawTenantCurrency : 'CHF';

/**
 * BCP-47 locale that formats every user-facing price, baked in at build time
 * (deploy repo registry `locale:` field -> build-tenant-image.yml `locale`
 * input -> Dockerfile ARG), exactly like {@link TENANT_CURRENCY} beside it.
 *
 * It is the TENANT's locale, deliberately not the viewer's UI language. A
 * price is the venue's own figure -- it must read the same as its printed
 * menu and its receipts for every guest, so a French restaurant prints
 * `8,00 €` for everyone. Switching the i18next language must never move a
 * decimal separator or a currency symbol.
 *
 * Validated through `Intl.getCanonicalLocales`, which is the authority here: it
 * canonicalises case, so `DE-ch` resolves to `de-CH`, and it throws
 * `RangeError` on a structurally invalid tag (`de_CH`, `junk!`, `123`).
 * Unset falls back to `de-CH` silently -- that is every tenant but this one --
 * while a tag that was SET and is invalid warns rather than being swallowed:
 * degrading in silence would ship Swiss price formatting to a non-Swiss
 * tenant, which is the exact defect this constant exists to prevent (E9 --
 * bind the error AND surface it). Consumers format via src/utils/currency.ts.
 */
function resolveTenantLocale(raw: string): string {
  if (raw === '') return 'de-CH';
  try {
    const [canonical] = Intl.getCanonicalLocales(raw);
    if (canonical !== undefined) return canonical;
  } catch (error) {
    console.warn(
      `NEXT_PUBLIC_TENANT_LOCALE=${JSON.stringify(raw)} is not a valid BCP-47 language tag, ` +
        `so prices will format as de-CH: ${String(error)}`,
    );
  }
  return 'de-CH';
}

export const TENANT_LOCALE: string = resolveTenantLocale((process.env.NEXT_PUBLIC_TENANT_LOCALE ?? '').trim());

/**
 * Per-tenant build-time assets (issue #125 part 3, corrected in SOFRA-ONBOARDING-PLAN O6).
 *
 * `public/branding/` holds the **SofraPiwas platform default set**, because it is what a
 * tenant image inherits when nothing overrides it. It used to hold tenant-1's assets, which
 * meant a self-serve restaurant's home hero was a PHOTOGRAPH of RUMI's dining room with
 * RUMI's logo on the wall, and its favicon was RUMI's. RUMI is a tenant like any other and
 * now gets its own set from `public/branding-rumi/`, applied by build-image.yml's prod job.
 *
 * A tenant overrides any of these via `branding_url` / `branding_dir`
 * (.github/workflows/build-tenant-image.yml). See public/branding/README.md.
 *
 * There is deliberately no BRANDING_LOGO. The logo is **runtime** data since O6 —
 * `RestaurantInfo.logoUrl`, uploaded in tenant admin — and the header falls back to a
 * designed lockup of the SofraPiwas mark plus the restaurant's own name. A baked default
 * would be a second source of truth that silently wins over what the tenant uploaded.
 */
export const BRANDING_ICON = '/branding/icon.svg';
export const BRANDING_HERO = '/branding/hero.png';
/** Fallback image for menu items with no photo — per-tenant like the rest of /branding/. */
export const BRANDING_PLACEHOLDER = '/branding/placeholder.png';

/**
 * Tenant COPY pack baked at build time (Dockerfile ARG → build-image.yml for RUMI prod). Empty for
 * every other tenant, which is the platform default: the cuisine-neutral strings in
 * src/locales/*.json. See src/lib/tenantCopy.ts for why the tenant's own words are an overlay of
 * ten locale files rather than one admin-editable field, and docs/TENANT-COPY.md for the recipe.
 */
export const TENANT_COPY_PACK: string = (process.env.NEXT_PUBLIC_TENANT_COPY_PACK ?? '').trim();

/**
 * Colours for the installed-app chrome (web app manifest, src/app/manifest.ts).
 *
 * They live here, as build-time env with a default, for two reasons: a manifest is JSON, so it
 * cannot read a CSS custom property from src/design-system/tokens, and every tenant image already
 * bakes its own branding at build time. Defaults are the classic template's `--brand-primary`
 * (#c00000) and `--surface-primary` (#ffffff) — the same values the app paints with today.
 * A tenant that overrides its palette should pass these two build args as well.
 */
export const PWA_THEME_COLOR = (process.env.NEXT_PUBLIC_PWA_THEME_COLOR ?? '').trim() || '#c00000';
export const PWA_BACKGROUND_COLOR = (process.env.NEXT_PUBLIC_PWA_BACKGROUND_COLOR ?? '').trim() || '#ffffff';
