'use client';

import { useEffect, useState } from 'react';
import { getCashierTenantContext } from '@/services/cashierService';

export interface CashierTenantTimeZoneState {
  readonly timeZone?: string;
  readonly isLoading: boolean;
  readonly hasError: boolean;
}

/** Reads the server timezone used to label order instants in cashier workspaces. */
export function useCashierTenantTimeZoneState(): CashierTenantTimeZoneState {
  const [state, setState] = useState<CashierTenantTimeZoneState>({ isLoading: true, hasError: false });

  useEffect(() => {
    let alive = true;
    void getCashierTenantContext()
      .then((context) => {
        if (!alive) return;
        const timeZone = context?.timeZone;
        setState({
          timeZone,
          isLoading: false,
          hasError: !timeZone,
        });
      })
      .catch(() => {
        if (alive) setState({ isLoading: false, hasError: true });
      });
    return () => {
      alive = false;
    };
  }, []);

  return state;
}

/** Backwards-compatible string facade for read-only cashier surfaces. */
export function useCashierTenantTimeZone(): string | undefined {
  return useCashierTenantTimeZoneState().timeZone;
}
