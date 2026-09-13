export type CashierDateStyle = 'short' | 'medium';

/** Format an order instant in the server-provided tenant zone, never the device zone. */
export function formatCashierDateTime(
  value: string,
  locale: string,
  timeZone: string | undefined,
  dateStyle: CashierDateStyle,
  fallback: string,
): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  try {
    return new Intl.DateTimeFormat(locale || 'en', {
      dateStyle,
      timeStyle: 'short',
      // UTC is a deterministic last resort while the tenant context is loading. It avoids
      // relabelling a server-selected order with the tablet's local zone.
      timeZone: timeZone || 'UTC',
    }).format(date);
  } catch (error: unknown) {
    // A bad server timezone is surfaced as the caller's localized fallback, never as the device zone.
    void error;
    return fallback;
  }
}
