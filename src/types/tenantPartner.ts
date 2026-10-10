/** Public runtime attribution served by GET /api/tenant/partner. */
export interface TenantPartnerDto {
  name: string | null;
  url: string | null;
  /** Optional for compatibility with older backends; only the platform default supplies email. */
  email?: string | null;
}
