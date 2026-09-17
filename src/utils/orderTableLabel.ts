import type { OrderDto } from '@/types/order';

export type OrderTableIdentity = Pick<OrderDto, 'tableId' | 'tableNumber'>;

/**
 * Returns the server-provided table label without coercing it into a number.
 * `tableNumber` is retained only as the compatibility value for older orders.
 */
export function getOrderTableLabel(order: Pick<OrderDto, 'tableLabel' | 'tableNumber'>): string | null {
  const label = order.tableLabel?.trim();
  if (label) return label;

  return order.tableNumber === null || order.tableNumber === undefined ? null : String(order.tableNumber);
}

/**
 * Matches an order to a table by stable ID whenever both payloads have one. Numeric matching is
 * deliberately limited to legacy orders that have no table ID; arbitrary labels must never be
 * parsed or compared as numbers.
 */
export function orderBelongsToTable(
  order: OrderTableIdentity,
  tableId?: string | null,
  tableNumber?: string | null,
): boolean {
  if (tableId && order.tableId) return order.tableId === tableId;
  if (!tableNumber || order.tableNumber === null || order.tableNumber === undefined) return false;

  return String(order.tableNumber) === tableNumber;
}
