import type { TFunction } from 'i18next';
import type { OrderDto } from '@/types/order';

/** Read-only projection. Original IDs/versions remain on the source DTO used for mutations. */
export function currentOrderTicket(source: OrderDto, related: readonly OrderDto[] = []): OrderDto {
  const members = new Map(related.map((order) => [order.id, order]));
  if (!members.size) return source;
  const orders = [...members.values()].filter((order) => !['Cancelled', 'Refunded'].includes(order.status));
  if (orders.length === 0) return members.get(source.id) ?? source;
  const sum = (value: (order: OrderDto) => number) => orders.reduce((total, order) => total + value(order), 0);
  const totalPaid = sum((order) => order.totalPaid);
  const due = sum((order) => order.remainingAmount ?? (order.payableTotal ?? order.total) - order.totalPaid);
  return {
    ...(members.get(source.id) ?? source),
    status:
      ['PendingApproval', 'Pending', 'Confirmed', 'Preparing', 'Ready', 'OutForDelivery', 'Delivered'].find((status) =>
        orders.some((order) => order.status === status),
      ) ?? source.status,
    items: orders.flatMap((order) => order.items),
    subTotal: sum((order) => order.subTotal),
    tax: sum((order) => order.tax),
    discount: sum((order) => order.discount),
    customerDiscountAmount: sum((order) => order.customerDiscountAmount),
    fidelityPointsDiscount: sum((order) => order.fidelityPointsDiscount ?? 0),
    deliveryFee: sum((order) => order.deliveryFee),
    tip: sum((order) => order.tip),
    total: sum((order) => order.total),
    payableTotal: sum((order) => order.payableTotal ?? order.total),
    billingCreditAmount: sum((order) => order.billingCreditAmount ?? 0),
    billChargeAmount: sum((order) => order.billChargeAmount ?? 0),
    billCharges: orders.flatMap((order) => order.billCharges ?? []),
    paymentTipMinor: sum(netPaymentTipMinor),
    totalPaid,
    remainingAmount: due,
    isFullyPaid: due <= 0,
    paymentStatus: currentPaymentStatus(due, totalPaid),
    payments: orders.flatMap((order) => order.payments ?? []),
  };
}

function currentPaymentStatus(due: number, totalPaid: number): OrderDto['paymentStatus'] {
  if (due < 0) return 'Overpaid';
  if (due === 0) return 'Completed';
  return totalPaid > 0 ? 'PartiallyPaid' : 'Pending';
}

function netPaymentTipMinor(order: OrderDto): number {
  return (
    order.paymentTipMinor ??
    (order.payments ?? [])
      .filter((payment) => ['Completed', 'PartiallyRefunded', 'Refunded'].includes(payment.status))
      .reduce((total, payment) => total + Math.max(0, (payment.tipMinor ?? 0) - (payment.refundedTipMinor ?? 0)), 0)
  );
}

/** A nullable table number is absent; labels such as 01 and 11a retain their exact spelling. */
export function orderTableLabel(order: Pick<OrderDto, 'type' | 'tableLabel' | 'tableNumber'>): string | null {
  if (order.type !== 'DineIn') return null;
  return order.tableLabel?.trim() || (order.tableNumber != null ? String(order.tableNumber) : null);
}

export function orderChannelLabel(type: string, t: TFunction): string {
  if (type === 'DineIn') return t('cashier.workspace.channel_dine_in');
  if (type === 'Takeaway') return t('cashier.workspace.channel_takeaway');
  if (type === 'Delivery') return t('cashier.workspace.channel_delivery');
  return t('cashier.workspace.channel_unknown');
}
