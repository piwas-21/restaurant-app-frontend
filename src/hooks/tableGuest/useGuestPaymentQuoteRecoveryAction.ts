'use client';

import { useCallback } from 'react';
import type { TableGuestVisitIdentity } from '@/types/tableGuestVisit';
import type {
  GuestAccountPaymentAccount,
  GuestAccountPaymentAttemptDescriptor,
  GuestAccountPaymentOperation,
} from '@/types/guestAccountPayments';
import { guestPaymentErrorMessage, type GuestPaymentErrorKey } from '@/lib/guestPaymentError';
import { isUnfinishedGuestPaymentQuote } from '@/lib/guestAccountPaymentRules';
import { guestAccountPaymentService } from '@/services/guestAccountPaymentService';
import {
  removeGuestAccountPaymentAttempt,
  saveGuestAccountPaymentAttempt,
  withQuotedOperation,
} from '@/services/guestAccountPaymentStorage';

interface QuoteRecoveryActionOptions {
  readonly activeIdentity: TableGuestVisitIdentity | null;
  readonly newPaymentsEnabled: boolean;
  readonly canCreatePayment: boolean;
  readonly isRecoveryLoading: boolean;
  readonly account: GuestAccountPaymentAccount | null;
  readonly descriptorRef: { current: GuestAccountPaymentAttemptDescriptor | null };
  readonly runExclusive: <T>(operation: () => Promise<T>, blocked: T) => Promise<T>;
  readonly refreshAccount: () => Promise<GuestAccountPaymentAccount | null>;
  readonly publishDescriptor: (descriptor: GuestAccountPaymentAttemptDescriptor | null) => void;
  readonly setOperation: (operation: GuestAccountPaymentOperation | null) => void;
  readonly setError: (error: GuestPaymentErrorKey) => void;
  readonly setStorageUnavailable: (unavailable: boolean) => void;
}

export function useGuestPaymentQuoteRecoveryAction(options: QuoteRecoveryActionOptions) {
  const retryUnfinishedQuote = useCallback(async () => {
    const initial = options.descriptorRef.current;
    if (
      !isUnfinishedGuestPaymentQuote(initial) ||
      !options.activeIdentity ||
      options.isRecoveryLoading ||
      !options.newPaymentsEnabled ||
      !options.canCreatePayment
    )
      return false;
    return options.runExclusive(async () => {
      const descriptor = options.descriptorRef.current;
      if (
        !isUnfinishedGuestPaymentQuote(descriptor) ||
        descriptor.operationId !== initial.operationId ||
        !options.activeIdentity ||
        options.isRecoveryLoading
      )
        return false;
      options.setError('');
      try {
        const account = options.account ?? (await options.refreshAccount());
        if (!account) throw new Error('unavailable');
        const result = await guestAccountPaymentService.retryQuote(
          options.activeIdentity,
          descriptor,
          account.currency,
        );
        const next = withQuotedOperation(descriptor, result.operation.version, result.contribution);
        options.setOperation(result.operation);
        if (!saveGuestAccountPaymentAttempt(next)) {
          options.setStorageUnavailable(true);
          throw new Error('storage');
        }
        options.publishDescriptor(next);
        return true;
      } catch (error) {
        options.setError(guestPaymentErrorMessage(error, 'action'));
        return false;
      }
    }, false);
  }, [options]);

  const discardUnfinishedQuote = useCallback(async () => {
    const initial = options.descriptorRef.current;
    if (!isUnfinishedGuestPaymentQuote(initial) || options.isRecoveryLoading) return false;
    return options.runExclusive(async () => {
      const descriptor = options.descriptorRef.current;
      if (
        !isUnfinishedGuestPaymentQuote(descriptor) ||
        descriptor.operationId !== initial.operationId ||
        options.isRecoveryLoading
      )
        return false;
      if (!removeGuestAccountPaymentAttempt(descriptor.serviceSessionId, descriptor.operationId)) {
        options.setStorageUnavailable(true);
        return false;
      }
      options.publishDescriptor(null);
      options.setOperation(null);
      options.setError('');
      return true;
    }, false);
  }, [options]);

  return { retryUnfinishedQuote, discardUnfinishedQuote };
}
