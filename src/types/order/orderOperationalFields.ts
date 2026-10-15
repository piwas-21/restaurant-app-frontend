/** Additive tenant-local order identity and preparation fields shared by order projections. */
export interface OrderOperationalFields {
  /** Human-facing sequence scoped to businessDate; `id` remains the stable technical identifier. */
  dailyOrderNumber?: number;
  /** Tenant operational date (`YYYY-MM-DD`) for this order. */
  businessDate?: string;
  /** Server-resolved preparation duration, including any authorized staff override. */
  effectivePreparationMinutes?: number | null;
  /** Promised ready instant in UTC; absent until a pending order is accepted. */
  expectedReadyAt?: string | null;
  /** IANA zone used to present business-facing order times. */
  businessTimeZoneId?: string | null;
}
