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
