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
