'use client';

// May this restaurant's checkout page offer online payment? (SOFRA-PAYMENTS-PLAN §5 S8)
import { useState, useEffect } from 'react';
import { getOnlinePaymentAvailability } from '@/services/paymentService';

/**
 * Asks the backend once per mount and starts at **false**.
 *
 * Starting false rather than at an `undefined` "not known yet" is the load-bearing part: the
 * option must never be rendered during the in-flight window, because the whole fleet answers no
 * and a flicker of a payment method that then vanishes is worse than a beat of not seeing it. The
 * service already fails closed, so there is no path from here to a wrong `true`.
 *
 * Not cached across mounts on purpose. The answer is a per-instance constant, but this is one
 * cheap DB-less call on a page the diner reaches once per order, and a module-level cache would
 * outlive a tenant's provisioning finishing mid-session.
 */
export function useOnlinePaymentAvailability(): boolean {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let active = true;

    void getOnlinePaymentAvailability().then((result) => {
      // Guarded against a resolve after unmount — /checkout/review redirects away on its own
      // prereq guard, so this genuinely races on a customer who arrives without an order type.
      if (active) setAvailable(result);
    });

    return () => {
      active = false;
    };
  }, []);

  return available;
}
