'use client';

import { useCallback, useRef, useState } from 'react';
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
import type { GuestPaymentRecoveryTarget } from './guestPaymentRecoveryHelpers';

interface CheckoutActionOptions {
  readonly activeIdentity: TableGuestVisitIdentity | null;
  readonly returnAttemptId: string | null;
  readonly descriptorRef: { current: GuestAccountPaymentAttemptDescriptor | null };
  readonly operation: GuestAccountPaymentOperation | null;
  readonly checkout: GuestAccountCheckoutStatus | null;
  readonly isRecoveryPolling: boolean;
  readonly stopRecoveryPolling: () => boolean;
  readonly waitForWorkIdle: () => Promise<void>;
  readonly runExclusive: <T>(operation: () => Promise<T>, blocked: T) => Promise<T>;
  readonly publishDescriptor: (descriptor: GuestAccountPaymentAttemptDescriptor | null) => void;
  readonly recoverSavedPayment: (target?: GuestPaymentRecoveryTarget) => Promise<void>;
  readonly isCurrentIdentity: (identity: TableGuestVisitIdentity) => boolean;
  readonly setOperation: (operation: GuestAccountPaymentOperation | null) => void;
  readonly setError: (error: GuestPaymentErrorKey) => void;
  readonly setStorageUnavailable: (unavailable: boolean) => void;
  readonly refreshAccount: () => Promise<unknown>;
  readonly onAccountUpdated: () => void;
}

export function useGuestPaymentCheckoutActions(options: CheckoutActionOptions) {
  const cancellationInProgress = useRef(false);
  const cancellationGeneration = useRef(0);
  const [isCancellationWorking, setIsCancellationWorking] = useState(false);
  const refreshPaymentStatus = useCallback(async () => {
    const descriptor = options.descriptorRef.current;
    const identity = options.activeIdentity;
    let receiptAttemptId = options.returnAttemptId;
    if (descriptor) receiptAttemptId = descriptor.attemptId ?? (identity ? null : options.returnAttemptId);
    if (options.isRecoveryPolling) return false;
    if (!identity && descriptor && receiptAttemptId && descriptor.receiptCredential) {
      return options.runExclusive(async () => {
        options.setError('');
        try {
          await options.recoverSavedPayment({
            attemptId: receiptAttemptId,
            operationId: descriptor.operationId,
            poll: false,
          });
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
      !options.isCurrentIdentity(identity) ||
      descriptor.serviceSessionId !== identity.serviceSessionId
    )
      return false;
    try {
      await options.recoverSavedPayment({
        attemptId: receiptAttemptId,
        operationId: descriptor.operationId,
        poll: false,
      });
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
      options.isRecoveryPolling ||
      descriptor.startRequestedAt !== null ||
      !['Quoted', 'Reserved'].includes(operation.state)
    )
      return false;
    return options.runExclusive(async () => {
      if (!options.isCurrentIdentity(identity)) return false;
      options.setError('');
      try {
        const result = await guestAccountPaymentService.release(identity, descriptor, operation.version);
        if (!options.isCurrentIdentity(identity)) return false;
        options.setOperation(result);
        if (result.state !== 'Released') return false;
        if (!removeGuestAccountPaymentAttempt(descriptor.serviceSessionId, descriptor.operationId)) {
          options.setStorageUnavailable(true);
          return false;
        }
        options.publishDescriptor(null);
        await options.refreshAccount();
        if (!options.isCurrentIdentity(identity)) return false;
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
    if (
      cancellationInProgress.current ||
      !descriptor ||
      !identity ||
      !options.isCurrentIdentity(identity) ||
      descriptor.serviceSessionId !== identity.serviceSessionId ||
      !currentCheckout
    )
      return false;
    cancellationInProgress.current = true;
    const generation = ++cancellationGeneration.current;
    setIsCancellationWorking(true);
    let actionError: GuestPaymentErrorKey | null = null;
    try {
      if (options.stopRecoveryPolling()) await options.waitForWorkIdle();
      if (!options.isCurrentIdentity(identity)) return false;
      options.setError('');
      const accepted = await options.runExclusive(async () => {
        if (!options.isCurrentIdentity(identity)) return false;
        try {
          await guestAccountPaymentService.requestCancellation(identity, descriptor, currentCheckout.version);
          return options.isCurrentIdentity(identity);
        } catch (error) {
          actionError = guestPaymentErrorMessage(error, 'action');
          return false;
        }
      }, false);
      if (!options.isCurrentIdentity(identity)) return false;
      await options.recoverSavedPayment({
        attemptId: currentCheckout.attemptId,
        operationId: descriptor.operationId,
        poll: true,
      });
      if (actionError && options.isCurrentIdentity(identity)) options.setError(actionError);
      return accepted && options.isCurrentIdentity(identity);
    } finally {
      finishCancellation(generation, cancellationGeneration, cancellationInProgress, setIsCancellationWorking);
    }
  }, [options]);

  return { refreshPaymentStatus, releaseBeforeStart, requestCancellation, isCancellationWorking };
}

function finishCancellation(
  generation: number,
  currentGeneration: { readonly current: number },
  cancellationInProgress: { current: boolean },
  setIsCancellationWorking: (value: boolean) => void,
): void {
  if (currentGeneration.current !== generation) return;
  cancellationInProgress.current = false;
  setIsCancellationWorking(false);
}
