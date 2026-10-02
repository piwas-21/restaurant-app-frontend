export function formatDeliveryChannelDate(value: string | null, locale: string, unavailable: string): string {
  if (!value) return unavailable;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return unavailable;
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  } catch (error) {
    // Invalid locale data uses the supplied translated placeholder rather than exposing a runtime error.
    if (error instanceof RangeError) return unavailable;
    throw error;
  }
}

export function formatDeliveryChannelPrice(
  minor: number | null,
  currency: string,
  locale: string,
  unavailable: string,
): string {
  if (minor === null || !Number.isFinite(minor) || !/^[A-Z]{3}$/.test(currency)) return unavailable;
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(minor / 100);
  } catch (error) {
    // Invalid locale/currency input uses the supplied translated placeholder rather than exposing a runtime error.
    if (error instanceof RangeError) return unavailable;
    throw error;
  }
}
