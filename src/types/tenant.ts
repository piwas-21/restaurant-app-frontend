/**
 * Tenant-scoped facts the app reads from its own backend.
 */

/**
 * What day it is at the RESTAURANT — `GET /api/tenant/today`
 * (backend `Features/Tenant/Dtos/TenantTodayDto`).
 *
 * The browser cannot work this out: it knows its own zone and nothing about the tenant's
 * (`Localization:TimeZone`). Between local midnight and the UTC one the two are different days, and
 * a client that guesses books a table on the wrong one (frontend #517) or reads the wrong day's
 * takings (#511).
 */
export interface TenantToday {
  /** The tenant's calendar day, `YYYY-MM-DD`. */
  date: string;
  /**
   * The IANA zone it was derived on — diagnostic; nothing here computes with it. It is the
   * EFFECTIVE zone: a backend whose configured zone is unknown to its host falls back, and reports
   * the fallback here.
   */
  timeZone: string;
}
