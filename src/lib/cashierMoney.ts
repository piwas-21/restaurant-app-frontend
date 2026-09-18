import type { OrderDto } from '@/types/order';
import { formatCurrency, TENANT_CURRENCY, TENANT_LOCALE } from '@/utils/currency';

/** A wire order may carry its own currency; malformed values fall back to tenant configuration. */
export type CashierCurrencySource = Pick<OrderDto, 'currency'>;

const ISO_CURRENCY_CODE = /^[A-Z]{3}$/;
const CASH_DENOMINATIONS = [5, 10, 20, 50, 100] as const;

export function orderCurrency(order: CashierCurrencySource): string {
  const candidate = typeof order.currency === 'string' ? order.currency.trim().toUpperCase() : '';
  return ISO_CURRENCY_CODE.test(candidate) ? candidate : TENANT_CURRENCY;
}

/** Format order money with the order's currency, never from the viewer's language or device. */
export function formatOrderCurrency(amount: number | null | undefined, order: CashierCurrencySource): string {
  return formatCurrency(amount ?? 0, TENANT_LOCALE, orderCurrency(order));
}

/**
 * Cash values useful at a counter: the exact due amount plus the next two common denominations.
 * Received cash is transient and is never sent as a captured amount.
 */
export function cashSuggestions(remainingAmount: number): number[] {
  if (!Number.isFinite(remainingAmount) || remainingAmount <= 0) return [];
  const exact = Math.round((remainingAmount + Number.EPSILON) * 100) / 100;
  const next = CASH_DENOMINATIONS.filter((value) => value > exact).slice(0, 2);
  return [exact, ...next];
}
