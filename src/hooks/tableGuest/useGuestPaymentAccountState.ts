'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { TableGuestVisitIdentity } from '@/types/tableGuestVisit';
import type { GuestAccountPaymentAccount } from '@/types/guestAccountPayments';
import type { GuestPaymentErrorKey } from '@/lib/guestPaymentError';
import { guestPaymentErrorMessage } from '@/lib/guestPaymentError';
import { guestAccountPaymentService } from '@/services/guestAccountPaymentService';

export const GUEST_ACCOUNT_READ_TIMEOUT_MS = 15_000;

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
  const requestVersion = useRef(0);
  const requestController = useRef<AbortController | null>(null);
  const activeIdentityKey = paymentIdentityKey(activeIdentity);
  const activeIdentityRef = useRef(activeIdentity);
  const activeIdentityKeyRef = useRef(activeIdentityKey);
  activeIdentityRef.current = activeIdentity;
  activeIdentityKeyRef.current = activeIdentityKey;

  const refreshAccount = useCallback(
    async (
      identity: TableGuestVisitIdentity | null = activeIdentityRef.current,
      isCurrent: () => boolean = () => true,
      clearErrorOnSuccess = true,
      parentSignal?: AbortSignal,
    ) => {
      if (!canCreatePayment || !identity || parentSignal?.aborted) return null;
      const version = ++requestVersion.current;
      requestController.current?.abort();
      const controller = new AbortController();
      requestController.current = controller;
      const identityKey = paymentIdentityKey(identity);
      const ownsRequest = () =>
        requestVersion.current === version && activeIdentityKeyRef.current === identityKey && isCurrent();
      const abortFromParent = () => controller.abort();
      parentSignal?.addEventListener('abort', abortFromParent, { once: true });
      const timeout = setTimeout(() => {
        if (ownsRequest()) {
          setError('load');
          setIsAccountLoading(false);
        }
        controller.abort();
      }, GUEST_ACCOUNT_READ_TIMEOUT_MS);
      setIsAccountLoading(true);
      try {
        const result = await guestAccountPaymentService.getAccount(identity, controller.signal);
        if (!ownsRequest() || controller.signal.aborted) return null;
        setAccount(result);
        if (clearErrorOnSuccess) setError('');
        return result;
      } catch (error) {
        if (ownsRequest() && !controller.signal.aborted) setError(guestPaymentErrorMessage(error, 'load'));
        return null;
      } finally {
        clearTimeout(timeout);
        parentSignal?.removeEventListener('abort', abortFromParent);
        if (ownsRequest()) setIsAccountLoading(false);
        if (requestController.current === controller) requestController.current = null;
      }
    },
    [canCreatePayment, setError],
  );

  useEffect(() => {
    const identity = activeIdentityRef.current;
    if (!canCreatePayment || !identity) {
      requestVersion.current += 1;
      requestController.current?.abort();
      requestController.current = null;
      setAccount(null);
      setIsAccountLoading(false);
      return;
    }
    let current = true;
    void refreshAccount(identity, () => current, false);
    return () => {
      current = false;
      requestVersion.current += 1;
      requestController.current?.abort();
      requestController.current = null;
    };
  }, [activeIdentityKey, canCreatePayment, refreshAccount]);

  return { account, isAccountLoading, refreshAccount };
}

function paymentIdentityKey(identity: TableGuestVisitIdentity | null): string | null {
  return identity ? `${identity.serviceSessionId}:${identity.participantToken}` : null;
}
