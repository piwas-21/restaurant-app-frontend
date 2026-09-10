import type { OrderDto } from '@/types/order';

/** Tolerance mirroring the backend's penny check (OrderSettlementEligibility). */
const PAYMENT_TOLERANCE = 0.01;

/**
 * Frontend mirror of the backend's `OrderSettlementEligibility.CanCollect` (backend #522):
 * fulfilment completion does NOT block collection — a genuinely unpaid sale stays collectible —
 * while cancelled, refunded and credited orders never reopen debt. The server remains
 * authoritative; this only decides which control is offered.
 */
export function canCollectPayment(order: OrderDto): boolean {
  if (order.status === 'Cancelled' || order.status === 'Refunded') return false;
  if (order.paymentStatus === 'Refunded') return false;
  if (order.payments?.some((payment) => payment.isRefunded || payment.refundedAmount)) return false;
  return order.remainingAmount > PAYMENT_TOLERANCE;
}
