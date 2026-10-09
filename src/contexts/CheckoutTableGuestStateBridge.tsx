'use client';

import type { ReactNode } from 'react';
import { CheckoutTableGuestStateProvider } from '@/contexts/CheckoutTableGuestStateContext';
import { useTableGuestVisit } from '@/contexts/TableGuestVisitContext';

export default function CheckoutTableGuestStateBridge({ children }: Readonly<{ children: ReactNode }>) {
  const visit = useTableGuestVisit();
  return (
    <CheckoutTableGuestStateProvider
      value={{
        phase: visit.phase,
        // Until storage hydration finishes, the provider cannot prove that an operation descriptor is absent.
        hasPendingRound:
          visit.pendingRound !== null || visit.pendingRoundStatus === 'unknown' || visit.phase === 'loading',
        hasAcknowledgement: visit.lastRoundAcknowledgement !== null,
      }}
    >
      {children}
    </CheckoutTableGuestStateProvider>
  );
}
