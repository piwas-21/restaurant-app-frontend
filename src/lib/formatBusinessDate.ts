/** Format a tenant business date without interpreting it in the visitor's local timezone. */
export function formatBusinessDate(value: string | null | undefined, locale: string): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;

  try {
    return new Intl.DateTimeFormat(locale || 'en', { dateStyle: 'medium', timeZone: 'UTC' }).format(date);
  } catch (error: unknown) {
    if (error instanceof RangeError) return value;
    throw error;
  }
}

/** Format an order instant only when the tenant's timezone is known; never guess from the device. */
export function formatBusinessTime(
  value: string | null | undefined,
  locale: string,
  timeZone?: string | null,
): string | null {
  if (!value || !timeZone) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;

  try {
    return new Intl.DateTimeFormat(locale || 'en', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone,
    }).format(date);
  } catch (error: unknown) {
    if (error instanceof RangeError) return null;
    throw error;
  }
}
