import { parseCurrencyAmountMinor } from '@/lib/accountPaymentMoney';
import { inputFromMinor } from '@/lib/orderPaymentMoney';
import { billTenderSchema } from '@/schemas/tableBill.schema';
import { PaymentMethod } from '@/types/order';

type ParsedTableTender = ReturnType<typeof billTenderSchema.parse>;

export type TableTenderDraftResult =
  | { readonly data: ParsedTableTender; readonly tipMinor: number }
  | {
      readonly error:
        'cashier.table_bill.error.amount' | 'cashier.table_bill.error.tip' | 'cashier.cash_received_too_low';
      readonly message?: string;
    };

export function validateTableTenderDraft(
  amount: string,
  tip: string,
  received: string,
  method: string,
  currency: string,
  locale: string,
): TableTenderDraftResult {
  const amountMinor = parseCurrencyAmountMinor(amount, currency, locale);
  const tipMinor = parseCurrencyAmountMinor(tip || '0', currency, locale);
  const receivedMinor =
    method === PaymentMethod.Cash ? parseCurrencyAmountMinor(received, currency, locale) : undefined;
  if (amountMinor === null || amountMinor <= 0) return { error: 'cashier.table_bill.error.amount' };
  if (tipMinor === null) return { error: 'cashier.table_bill.error.tip' };
  if (method === PaymentMethod.Cash && (receivedMinor == null || receivedMinor < amountMinor + tipMinor)) {
    return { error: 'cashier.cash_received_too_low' };
  }

  const parsed = billTenderSchema.safeParse({
    amount: amountMinor / 100,
    tip: inputFromMinor(tipMinor),
    paymentMethod: method,
    cashReceived: receivedMinor == null ? undefined : inputFromMinor(receivedMinor),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (issue?.path[0] === 'cashReceived') return { error: 'cashier.cash_received_too_low' };
    if (issue?.path[0] === 'tip') return { error: 'cashier.table_bill.error.tip' };
    return { error: 'cashier.table_bill.error.amount', message: issue?.message };
  }
  return { data: parsed.data, tipMinor };
}
