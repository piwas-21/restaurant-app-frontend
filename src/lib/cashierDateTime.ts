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
  if (Number.isNaN(date.getTime()) || !timeZone) return fallback;
  try {
    return new Intl.DateTimeFormat(locale || 'en', {
      dateStyle,
      timeStyle: 'short',
      // A missing timezone is an unavailable tenant context, not permission to guess with UTC.
      timeZone,
    }).format(date);
  } catch (error: unknown) {
    // A bad server timezone is surfaced as the caller's localized fallback, never as the device zone.
    void error;
    return fallback;
  }
}
