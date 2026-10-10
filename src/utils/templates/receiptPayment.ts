import type { OrderDto, OrderPaymentDto } from '@/types/order';
import { formatOrderCurrency } from '@/lib/cashierMoney';
import { getPaymentMethodLabel } from '@/utils/paymentMethodDisplay';
import { escapeHtml } from './receiptHtml';
import { receiptFallback, type ReceiptTranslate } from './receiptPresentation';

export const isCapturedPayment = (payment: OrderPaymentDto): boolean =>
  payment.status === 'Completed' || payment.status === 'PartiallyRefunded' || payment.status === 'Refunded';

/** Food balance is server-owned. Pending tender declarations are never presented as received money. */
export function receiptPaymentHtml(order: OrderDto, translate: ReceiptTranslate = receiptFallback): string {
  const money = (amount: number) => formatOrderCurrency(amount, order);
  const status =
    order.paymentStatus === 'Refunded'
      ? translate('payment_status_refunded', 'Refunded')
      : order.paymentStatus === 'Overpaid'
        ? translate('payment_status_overpaid', 'Overpaid')
        : order.isFullyPaid
          ? translate('receipt.status.paid', 'Paid')
          : order.totalPaid > 0
            ? translate('receipt.status.part_paid', 'Partly paid')
            : translate('receipt.status.unpaid', 'Unpaid');
  const rows = (order.payments ?? [])
    .map((payment) => {
      const method = escapeHtml(getPaymentMethodLabel(payment.paymentMethod, translate));
      if (!isCapturedPayment(payment)) {
        if (payment.status !== 'Pending') return '';
        return `<div>${method} — ${escapeHtml(translate('payment_status_pending', 'Pending'))}</div>`;
      }
      const tip = (payment.tipMinor ?? 0) / 100;
      const refundedTip = (payment.refundedTipMinor ?? 0) / 100;
      return (
        `<div>${method}: ${money(payment.amount)}</div>` +
        ((payment.refundedAmount ?? 0) > 0
          ? `<div>${escapeHtml(translate('refund_amount', 'Refund Amount'))}: ${money(payment.refundedAmount ?? 0)}</div>`
          : '') +
        (tip > 0
          ? `<div>${escapeHtml(translate('cashier.collection.staff_tip', 'Tip for staff'))}: ${money(tip)}</div>`
          : '') +
        (refundedTip > 0
          ? `<div>${escapeHtml(translate('cashier.refund_tip_amount', 'Tip refunded'))}: ${money(refundedTip)}</div>`
          : '')
      );
    })
    .join('');
  const capturedTips =
    order.paymentTipMinor ??
    (order.payments ?? [])
      .filter(isCapturedPayment)
      .reduce((total, payment) => total + Math.max(0, (payment.tipMinor ?? 0) - (payment.refundedTipMinor ?? 0)), 0);
  const hasTip = (order.payments ?? []).some(
    (payment) => isCapturedPayment(payment) && ((payment.tipMinor ?? 0) > 0 || (payment.refundedTipMinor ?? 0) > 0),
  );
  return `<div class="separator"></div><div class="payment-summary">
    <strong>${escapeHtml(translate('payment_status', 'Payment Status'))}: ${escapeHtml(status)}</strong>
    <div>${escapeHtml(translate('receipt.amount_paid', 'Payment received'))}: ${money(order.totalPaid)}</div>
    <div>${escapeHtml(translate('receipt.amount_remaining', 'Still to pay'))}: ${money(Math.max(0, order.remainingAmount))}</div>
    ${order.remainingAmount < 0 ? `<div>${escapeHtml(translate('cashier.tables.round_credit', 'Credit'))}: ${money(-order.remainingAmount)}</div>` : ''}
    ${rows ? `<div><strong>${escapeHtml(translate('payment', 'Payment'))}:</strong>${rows}</div>` : ''}
    ${hasTip ? `<div><strong>${escapeHtml(translate('cashier.collection.total_collected', 'Total collected'))}: ${money(order.totalPaid + capturedTips / 100)}</strong></div>` : ''}
  </div>`;
}
