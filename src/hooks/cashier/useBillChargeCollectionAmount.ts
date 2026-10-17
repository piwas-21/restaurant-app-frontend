import { useEffect, useRef } from 'react';
import { parseCurrencyAmountMinor } from '@/lib/accountPaymentMoney';
import { orderCurrency } from '@/lib/cashierMoney';
import { inputFromMinor, orderTenderTotalMinor } from '@/lib/orderPaymentMoney';
import type { OrderDto } from '@/types/order';

interface Props {
  readonly order: OrderDto;
  readonly disabled: boolean;
  readonly amount: string;
  readonly received: string;
  readonly tip: string;
  readonly method: string;
  readonly locale: string;
  readonly setAmount: (value: string) => void;
  readonly setReceived: (value: string) => void;
  readonly clearTransient: () => void;
}

/** Follow a saved fee when the draft was the full balance; preserve deliberate partial/cash entries. */
export function useBillChargeCollectionAmount({
  order,
  disabled,
  amount,
  received,
  tip,
  method,
  locale,
  setAmount,
  setReceived,
  clearTransient,
}: Props) {
  const previous = useRef(order);
  useEffect(() => {
    const prior = previous.current;
    if (order.id !== prior.id) {
      previous.current = order;
      return;
    }
    if (disabled) return;
    previous.current = order;
    if ((order.billChargeAmount ?? 0) <= (prior.billChargeAmount ?? 0)) return;
    const currency = orderCurrency(order);
    if (currency !== orderCurrency(prior)) return;
    const oldDue = Math.round(prior.remainingAmount * 100);
    if (parseCurrencyAmountMinor(amount, currency, locale) === oldDue) {
      const next = inputFromMinor(Math.round(order.remainingAmount * 100));
      setAmount(next);
      const oldTender = orderTenderTotalMinor(amount, tip, currency, locale);
      if (method === 'Cash' && parseCurrencyAmountMinor(received, currency, locale) === oldTender)
        setReceived(inputFromMinor(orderTenderTotalMinor(next, tip, currency, locale) ?? 0));
    }
    clearTransient();
  }, [amount, clearTransient, disabled, locale, method, order, received, setAmount, setReceived, tip]);
}
