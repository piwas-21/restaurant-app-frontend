'use client';

import { useCallback } from 'react';
import type { TableGuestVisitIdentity } from '@/types/tableGuestVisit';
import type {
  GuestAccountCheckoutStatus,
  GuestAccountPaymentAttemptDescriptor,
  GuestAccountPaymentOperation,
} from '@/types/guestAccountPayments';
import type { GuestPaymentErrorKey } from '@/lib/guestPaymentError';
import { guestPaymentErrorMessage } from '@/lib/guestPaymentError';
import { guestAccountPaymentService } from '@/services/guestAccountPaymentService';
import { removeGuestAccountPaymentAttempt } from '@/services/guestAccountPaymentStorage';

interface CheckoutActionOptions {
  readonly activeIdentity: TableGuestVisitIdentity | null;
  readonly returnAttemptId: string | null;
  readonly descriptorRef: { current: GuestAccountPaymentAttemptDescriptor | null };
  readonly operation: GuestAccountPaymentOperation | null;
  readonly checkout: GuestAccountCheckoutStatus | null;
  readonly runExclusive: <T>(operation: () => Promise<T>, blocked: T) => Promise<T>;
  readonly publishDescriptor: (descriptor: GuestAccountPaymentAttemptDescriptor | null) => void;
  readonly fetchReceipt: (descriptor: GuestAccountPaymentAttemptDescriptor, attemptId: string) => Promise<unknown>;
  readonly recoverSavedPayment: () => Promise<void>;
  readonly setOperation: (operation: GuestAccountPaymentOperation | null) => void;
  readonly setCheckout: (checkout: GuestAccountCheckoutStatus | null) => void;
  readonly setError: (error: GuestPaymentErrorKey) => void;
  readonly setStorageUnavailable: (unavailable: boolean) => void;
  readonly refreshAccount: () => Promise<unknown>;
  readonly onAccountUpdated: () => void;
}

export function useGuestPaymentCheckoutActions(options: CheckoutActionOptions) {
  const refreshPaymentStatus = useCallback(async () => {
    const descriptor = options.descriptorRef.current;
    const receiptAttemptId = options.returnAttemptId ?? descriptor?.attemptId ?? null;
    const identity = options.activeIdentity;
    if (!identity && descriptor && receiptAttemptId && descriptor.receiptCredential) {
      return options.runExclusive(async () => {
        options.setError('');
        try {
          await options.recoverSavedPayment();
          return true;
        } catch (error) {
          options.setError(guestPaymentErrorMessage(error, 'load'));
          return false;
        }
      }, false);
    }
    if (
      !descriptor ||
      !identity ||
      descriptor.serviceSessionId !== identity.serviceSessionId ||
      (descriptor.startRequestedAt === null && descriptor.attemptId === null)
    )
      return false;
    try {
      await options.recoverSavedPayment();
      return true;
    } catch (error) {
      options.setError(guestPaymentErrorMessage(error, 'action'));
      return false;
    }
  }, [options]);

  const releaseBeforeStart = useCallback(async () => {
    const descriptor = options.descriptorRef.current;
    const identity = options.activeIdentity;
    const operation = options.operation;
    if (
      !descriptor ||
      !identity ||
      descriptor.serviceSessionId !== identity.serviceSessionId ||
      !operation ||
      descriptor.startRequestedAt !== null ||
      !['Quoted', 'Reserved'].includes(operation.state)
    )
      return false;
    return options.runExclusive(async () => {
      options.setError('');
      try {
        const result = await guestAccountPaymentService.release(identity, descriptor, operation.version);
        options.setOperation(result);
        if (result.state !== 'Released') return false;
        if (!removeGuestAccountPaymentAttempt(descriptor.serviceSessionId, descriptor.operationId)) {
          options.setStorageUnavailable(true);
          return false;
        }
        options.publishDescriptor(null);
        await options.refreshAccount();
        options.onAccountUpdated();
        return true;
      } catch (error) {
        options.setError(guestPaymentErrorMessage(error, 'action'));
        return false;
      }
    }, false);
  }, [options]);

  const requestCancellation = useCallback(async () => {
    const descriptor = options.descriptorRef.current;
    const identity = options.activeIdentity;
    const currentCheckout = options.checkout;
    if (!descriptor || !identity || descriptor.serviceSessionId !== identity.serviceSessionId || !currentCheckout)
      return false;
    return options.runExclusive(async () => {
      options.setError('');
      try {
        const result = await guestAccountPaymentService.requestCancellation(
          identity,
          descriptor,
          currentCheckout.version,
        );
        options.setCheckout(result);
        const currentOperation = await guestAccountPaymentService.getOperation(identity, descriptor);
        options.setOperation(currentOperation);
        const status = await guestAccountPaymentService.getCheckoutStatus(identity, descriptor);
        options.setCheckout(status);
        if (descriptor.receiptCredential) await options.fetchReceipt(descriptor, status.attemptId);
        return true;
      } catch (error) {
        options.setError(guestPaymentErrorMessage(error, 'action'));
        return false;
      }
    }, false);
  }, [options]);

  return { refreshPaymentStatus, releaseBeforeStart, requestCancellation };
}
