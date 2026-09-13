'use client';

import { useEffect, useState } from 'react';
import { getCashierTenantContext } from '@/services/cashierService';

/** Reads the server timezone used to label order instants in the Orders destination. */
export function useCashierTenantTimeZone(): string | undefined {
  const [timeZone, setTimeZone] = useState<string>();

  useEffect(() => {
    let alive = true;
    void getCashierTenantContext()
      .then((context) => {
        if (alive) setTimeZone(context?.timeZone);
      })
      .catch(() => {
        // UTC fallback in formatCashierDateTime is deterministic and does not guess device time.
      });
    return () => {
      alive = false;
    };
  }, []);

  return timeZone;
}
