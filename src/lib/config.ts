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
 * Brand-neutral tenant asset convention (issue #125 part 3). The repo ships
 * tenant-1 (RUMI) defaults at these paths; a tenant image overrides them by
 * extracting a branding archive into `public/branding/` at build time (see
 * .github/workflows/build-tenant-image.yml `branding_url` input).
 */
export const BRANDING_LOGO = '/branding/logo.png';
export const BRANDING_LOGO_DARK = '/branding/logo-dark.png';
export const BRANDING_ICON = '/branding/icon.svg';
export const BRANDING_HERO = '/branding/hero.png';
