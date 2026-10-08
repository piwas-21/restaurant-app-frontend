'use client';

import { useCallback, useEffect, useState } from 'react';
import type { TableGuestVisitIdentity } from '@/types/tableGuestVisit';
import type { GuestAccountPaymentAccount } from '@/types/guestAccountPayments';
import type { GuestPaymentErrorKey } from '@/lib/guestPaymentError';
import { guestPaymentErrorMessage } from '@/lib/guestPaymentError';
import { guestAccountPaymentService } from '@/services/guestAccountPaymentService';

interface GuestPaymentAccountStateOptions {
  readonly activeIdentity: TableGuestVisitIdentity | null;
  readonly canCreatePayment: boolean;
  readonly setError: (error: GuestPaymentErrorKey) => void;
}

export function useGuestPaymentAccountState({
  activeIdentity,
  canCreatePayment,
  setError,
}: GuestPaymentAccountStateOptions) {
  const [account, setAccount] = useState<GuestAccountPaymentAccount | null>(null);
  const [isAccountLoading, setIsAccountLoading] = useState(false);

  const refreshAccount = useCallback(
    async (
      identity: TableGuestVisitIdentity | null = activeIdentity,
      isCurrent: () => boolean = () => true,
      clearErrorOnSuccess = true,
    ) => {
      if (!canCreatePayment || !identity) return null;
      setIsAccountLoading(true);
      try {
        const result = await guestAccountPaymentService.getAccount(identity);
        if (!isCurrent()) return null;
        setAccount(result);
        if (clearErrorOnSuccess) setError('');
        return result;
      } catch (error) {
        if (isCurrent()) setError(guestPaymentErrorMessage(error, 'load'));
        return null;
      } finally {
        if (isCurrent()) setIsAccountLoading(false);
      }
    },
    [activeIdentity, canCreatePayment, setError],
  );

  useEffect(() => {
    if (!canCreatePayment || !activeIdentity) {
      setAccount(null);
      return;
    }
    let current = true;
    void refreshAccount(activeIdentity, () => current, false);
    return () => {
      current = false;
    };
  }, [activeIdentity, canCreatePayment, refreshAccount]);

  return { account, isAccountLoading, refreshAccount };
}
