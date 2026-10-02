import type { OrderDto, OrderType } from '@/types/order';
import type { OrderAmendmentDraft } from '@/hooks/orderAmendments/orderAmendmentTypes';
import type { UnitRange } from './orderAmendmentViewTypes';

export function updateOrderAmendmentChange(
  draft: OrderAmendmentDraft,
  orderItemId: string,
  change: OrderAmendmentDraft['changes'][number] | null,
): OrderAmendmentDraft {
  const changes = draft.changes.filter((item) => item.orderItemId !== orderItemId);
  return { ...draft, changes: change ? [...changes, change] : changes };
}

export function sourceLineRange(line: OrderDto['items'][number], ranges: Record<string, UnitRange>): UnitRange {
  return ranges[line.id] ?? { startOrdinal: 1, quantity: Math.max(1, line.quantity) };
}

export function isNativeOrderType(value: string): value is OrderType {
  return value === 'DineIn' || value === 'Takeaway' || value === 'Delivery';
}

export function serverSourceChangesReadOnly(order: OrderDto): boolean {
  return ['OutForDelivery', 'InTransit', 'Completed', 'Delivered'].includes(order.status);
}
