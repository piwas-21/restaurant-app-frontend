import type { OrderDto } from '@/types/order';

export function serverOrderVisitHref(order: OrderDto): string | null {
  if (order.type !== 'DineIn' || !order.tableId || !order.serviceSessionId) return null;
  const query = new URLSearchParams({ serviceSessionId: order.serviceSessionId, orderId: order.id });
  return `/server/tables/${encodeURIComponent(order.tableId)}?${query.toString()}`;
}
