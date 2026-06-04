/**
 * Pure formatters for the order-details views (Swiss locale).
 * Extracted from OrderDetailsModal (Sprint 6 god-file decomposition).
 */

/** Formats a number as Swiss-franc currency (e.g. "CHF 12.50"). */
export function formatOrderPrice(price: number): string {
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF',
  }).format(price);
}

/** Formats an ISO date string as a Swiss short date-time. */
export function formatOrderDate(dateString: string): string {
  return new Date(dateString).toLocaleString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
