import type { CashierOrderGroupDto } from '@/types/cashier';
import type { OrderDto } from '@/types/order';

function dateInTimeZone(value: string, timeZone: string): string | null {
  const timestamp = new Date(value);
  if (!Number.isFinite(timestamp.getTime())) return null;
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone,
    }).formatToParts(timestamp);
    const values = new Map(parts.map((part) => [part.type, part.value]));
    const year = values.get('year');
    const month = values.get('month');
    const day = values.get('day');
    return year && month && day ? `${year}-${month}-${day}` : null;
  } catch (error: unknown) {
    if (error instanceof RangeError) return null;
    throw error;
  }
}

export function orderBusinessDate(order: OrderDto, timeZone?: string): string | null {
  if (order.businessDate && /^\d{4}-\d{2}-\d{2}$/.test(order.businessDate)) return order.businessDate;
  return timeZone ? dateInTimeZone(order.orderDate, timeZone) : null;
}

export function filterCashierGroupsToBusinessDate(
  groups: readonly CashierOrderGroupDto[],
  businessDate: string | null | undefined,
  timeZone?: string,
): CashierOrderGroupDto[] {
  if (!businessDate) return [...groups];
  return groups
    .map((group) => ({
      ...group,
      orders: group.orders.filter((order) => orderBusinessDate(order, timeZone) === businessDate),
    }))
    .filter((group) => group.orders.length > 0);
}

export function filterOrdersToBusinessDate(
  orders: readonly OrderDto[],
  businessDate: string | null | undefined,
  timeZone?: string,
): OrderDto[] {
  if (!businessDate) return [...orders];
  return orders.filter((order) => orderBusinessDate(order, timeZone) === businessDate);
}
