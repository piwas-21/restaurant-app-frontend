import type { RefundPaymentCommand } from '@/types/order/commands';
import type { OrderDto } from '@/types/order';
import { parseAccountContributionMinor } from '@/lib/accountPaymentMoney';
import { parseOrderTipMinor } from '@/lib/orderPaymentMoney';
import { formatOrderCurrency, orderCurrency } from '@/lib/cashierMoney';

type RefundDraftResult =
  | { readonly ok: false; readonly errorKey: string; readonly fallback?: string; readonly max?: string }
  | { readonly ok: true; readonly paymentId: string; readonly command: RefundPaymentCommand };

interface RefundDraftInput {
  readonly order: OrderDto;
  readonly paymentId: string | null;
  readonly amount: string;
  readonly tipAmount: string;
  readonly reason: string;
}

export function buildOrderRefundDraft({
  order,
  paymentId,
  amount,
  tipAmount,
  reason,
}: RefundDraftInput): RefundDraftResult {
  if (!paymentId || !reason.trim()) {
    return { ok: false, errorKey: 'fill_refund_details', fallback: 'Please fill in all refund details' };
  }
  if (reason.trim().length < 5) {
    return { ok: false, errorKey: 'cashier.refund_reason_min_length' };
  }

  const currency = orderCurrency(order);
  const refundAmountMinor = parseAccountContributionMinor(amount || '0', currency);
  const refundTipMinor = parseOrderTipMinor(tipAmount || '0', currency);
  if (refundAmountMinor === null) return { ok: false, errorKey: 'enter_valid_refund_amount' };
  if (refundTipMinor === null) return { ok: false, errorKey: 'cashier.refund_tip_invalid' };
  if (refundAmountMinor === 0 && refundTipMinor === 0) {
    return { ok: false, errorKey: 'fill_refund_details', fallback: 'Please fill in all refund details' };
  }

  const payment = (order.payments ?? []).find((candidate) => candidate.id === paymentId);
  if (!payment) return { ok: false, errorKey: 'select_payment_to_refund' };

  const maxAmountMinor = parseAccountContributionMinor(payment.amount.toFixed(2), currency);
  if (maxAmountMinor === null || refundAmountMinor > maxAmountMinor) {
    return {
      ok: false,
      errorKey: 'cashier.refund_exceeds_payment',
      max: formatOrderCurrency(payment.amount, order),
    };
  }

  const maxTipMinor = Math.max(0, (payment.tipMinor ?? 0) - (payment.refundedTipMinor ?? 0));
  if (refundTipMinor > maxTipMinor) {
    return {
      ok: false,
      errorKey: 'cashier.refund_tip_exceeds_payment',
      max: formatOrderCurrency(maxTipMinor / 100, order),
    };
  }

  return {
    ok: true,
    paymentId,
    command: {
      refundAmount: refundAmountMinor / 100,
      ...(refundTipMinor > 0 ? { refundTipMinor } : {}),
      refundReason: reason,
    },
  };
}
