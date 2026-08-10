'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { useCheckoutReturn } from '@/hooks/checkout/useCheckoutReturn';
import CheckoutReturnPanel from './CheckoutReturnPanel';

/**
 * The return trip from Stripe (SOFRA-PAYMENTS-PLAN §5 S9): settle the payment, then say what
 * happened.
 *
 * Its own component rather than a branch inside the confirmation page, for one reason worth
 * stating: `useCheckoutReturn` performs a **write** — it is the primary settle trigger — and
 * mounting it only on this route is what keeps that write off every ordinary confirmation visit.
 * A hook cannot be called conditionally, so the condition has to be a component boundary.
 */
export default function CheckoutReturnView({ sessionId }: Readonly<{ sessionId: string }>) {
  const searchParams = useSearchParams();
  const checkoutReturn = useCheckoutReturn(sessionId);

  return <CheckoutReturnPanel {...checkoutReturn} orderId={searchParams.get('orderId')} />;
}
