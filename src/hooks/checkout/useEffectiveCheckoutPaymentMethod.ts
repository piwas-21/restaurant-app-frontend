'use client';

import { useEffect, useState } from 'react';
import { normalizePaymentMethodForOrderType } from '@/config/paymentMethods';
import { OrderType, PaymentMethod } from '@/types/order';

export default function useEffectiveCheckoutPaymentMethod(orderType: OrderType | null) {
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>(PaymentMethod.Cash);
  const effectivePaymentMethod = normalizePaymentMethodForOrderType(selectedPaymentMethod, orderType);

  useEffect(() => {
    if (effectivePaymentMethod !== selectedPaymentMethod) setSelectedPaymentMethod(effectivePaymentMethod);
  }, [effectivePaymentMethod, selectedPaymentMethod]);

  return { selectedPaymentMethod, effectivePaymentMethod, setSelectedPaymentMethod };
}
