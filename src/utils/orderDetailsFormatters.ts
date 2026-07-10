/**
 * Pure formatters for the order-details views (Swiss locale).
 * Extracted from OrderDetailsModal (Sprint 6 god-file decomposition).
 */

import { formatCurrency } from '@/utils/currency';

/** Formats a number as a tenant-currency string (shared formatCurrency, de-CH locale). */
export function formatOrderPrice(price: number): string {
  return formatCurrency(price);
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
