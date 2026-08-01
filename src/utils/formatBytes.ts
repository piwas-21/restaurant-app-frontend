const UNITS = ['B', 'KB', 'MB', 'GB'] as const;

/**
 * Human-readable byte size, e.g. `1.4 MB`.
 *
 * Deliberately unit-suffixed rather than translated: `KB`/`MB` are the same tokens in every
 * locale this app ships, and routing them through i18next would create ten keys that can drift
 * apart while meaning one thing. The NUMBER is localised — a comma decimal separator is real in
 * most of these locales — via toLocaleString with the active language.
 */
export function formatBytes(bytes: number, locale?: string): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return `0 ${UNITS[0]}`;

  // Clamped so a value beyond the table cannot index past the end and print `undefined`.
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1);
  const value = bytes / 1024 ** exponent;
  // Whole bytes never want a decimal; larger units get one only when it says something.
  const fractionDigits = exponent === 0 || value >= 100 ? 0 : 1;

  return `${value.toLocaleString(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })} ${UNITS[exponent]}`;
}
