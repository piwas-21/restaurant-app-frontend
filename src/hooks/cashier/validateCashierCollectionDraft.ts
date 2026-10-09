import type { OrderDto } from '@/types/order';
import { PaymentMethod } from '@/types/order';
import { parseCurrencyAmountMinor } from '@/lib/accountPaymentMoney';
import { inputFromMinor, parseOrderTipMinor } from '@/lib/orderPaymentMoney';
import { orderCurrency } from '@/lib/cashierMoney';
import { paymentModalSchema } from '@/components/cashier/paymentModalSchema';

export type PaymentDraftResult =
  | { readonly errorKey: string }
  | { readonly amountMinor: number; readonly tipMinor: number; readonly cashReceivedMinor: number | undefined };

export function validatePaymentDraft(
  amount: string,
  tip: string,
  method: string,
  received: string,
  order: OrderDto,
  locale: string,
): PaymentDraftResult {
  const currency = orderCurrency(order);
  const amountMinor = parseCurrencyAmountMinor(amount, currency, locale);
  const tipMinor = parseOrderTipMinor(tip, currency, locale);
  const cashReceivedMinor =
    method === PaymentMethod.Cash ? parseCurrencyAmountMinor(received, currency, locale) : undefined;
  if (amountMinor === null || tipMinor === null || (method === PaymentMethod.Cash && cashReceivedMinor === null)) {
    return { errorKey: 'cashier.payment_amount_required' };
  }
  const parsed = paymentModalSchema.safeParse({
    amount: inputFromMinor(amountMinor),
    amountMinor,
    tipMinor,
    paymentMethod: method,
    cashReceivedMinor,
  });
  if (!parsed.success) {
    return {
      errorKey:
        parsed.error.issues[0]?.path[0] === 'cashReceivedMinor'
          ? 'cashier.cash_received_too_low'
          : 'cashier.payment_amount_required',
    };
  }
  const orderBalanceMinor = parseCurrencyAmountMinor(Math.max(0, order.remainingAmount).toFixed(2), currency, locale);
  if (orderBalanceMinor === null || amountMinor > orderBalanceMinor) {
    return { errorKey: 'cashier.payment_exceeds_balance' };
  }
  return { amountMinor, tipMinor, cashReceivedMinor: cashReceivedMinor ?? undefined };
}
