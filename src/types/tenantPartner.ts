/**
 * Frontend mirror of the backend `Features/Tenant/Dtos/TenantPartnerDto`.
 *
 * Source of truth: `backend/RestaurantSystem.Api/Features/Tenant/` (SOFRA-PARTNER-PLAN
 * §11d channel C). The tenant's backend reads `TENANT_PARTNER_NAME` / `TENANT_PARTNER_URL`
 * out of its own environment, which `provision-tenant.sh` renders from the registry — the
 * attribution boolean is already resolved there, so this payload carries exactly one
 * meaning: WHAT TO DISPLAY.
 */

export interface TenantPartnerDto {
  /**
   * The partner's public brand, or null when this tenant has no attribution to show —
   * which is EVERY tenant provisioned before the registry keys existed. "No partner" is a
   * 200 with both fields null, NOT a 404, so a non-empty `name` is the only render
   * condition there is.
   */
  name: string | null;
  /**
   * The partner's website, or null. Null WITH a name is a real state: the backend
   * withholds a non-https url and still serves the name, so the credit must be able to
   * render as plain text.
   *
   * The backend normalises through `Uri.AbsoluteUri`, so `https://example.com` is served
   * as `https://example.com/` — with a trailing slash. Use it as an `href` and nothing
   * else; never string-compare it against anything a partner typed.
   */
  url: string | null;
}
