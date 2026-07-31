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
/*
 * There is deliberately no BRANDING_LOGO here any more (SOFRA-ONBOARDING-PLAN O6).
 * The header now renders `RestaurantInfo.logoUrl`, uploaded by the tenant at runtime, and
 * falls back to the restaurant's NAME as text. The baked `/branding/logo.png` this used to
 * point at is tenant-1's, and because nothing in the onboarding funnel ever passed
 * `branding_url`, every self-serve tenant's header showed another restaurant's brand.
 * Re-adding a baked default would restore exactly that. The file itself is still shipped
 * so tenant-1 can upload its own logo through the admin UI like anyone else.
 *
 * The remaining assets below are still tenant-1's defaults — a self-serve tenant gets
 * RUMI's favicon, hero and placeholder. Same class of gap, out of O6's scope; tracked in
 * the ROADMAP rather than silently fixed here.
 */
export const BRANDING_ICON = '/branding/icon.svg';
export const BRANDING_HERO = '/branding/hero.png';
/** Fallback image for menu items with no photo — per-tenant like the rest of /branding/. */
export const BRANDING_PLACEHOLDER = '/branding/placeholder.png';
