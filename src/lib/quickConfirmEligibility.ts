import { OrderDto, OrderType } from '@/types/order';

/** Whether an incoming order belongs in the cashier's accept-or-cancel prompt. */
export function isQuickConfirmCandidate(order: OrderDto): boolean {
  if (order.status !== 'Pending') return false;

  return (
    order.type === OrderType.Takeaway ||
    order.type === OrderType.Delivery ||
    (order.type === OrderType.DineIn && (order.tableNumber === undefined || order.tableNumber === null))
  );
}
