'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  GuestAccountCheckoutStatus,
  GuestAccountPaymentAttemptDescriptor,
  GuestAccountPaymentOperation,
} from '@/types/guestAccountPayments';
import type {
  GuestPaymentAttemptSummary,
  GuestPaymentReceiptSummary,
  GuestPaymentRecoveryOptions,
} from '@/types/guestPaymentRecovery';
import type { GuestPaymentErrorKey } from '@/lib/guestPaymentError';
import { saveGuestAccountPaymentAttempt } from '@/services/guestAccountPaymentStorage';
import { GUEST_PAYMENT_RECOVERY_MAX_DURATION_CONFIG_MS } from '@/lib/config';
import {
  summarizeDescriptor,
  waitForRecoveryPoll,
  type GuestPaymentRecoveryTarget,
} from './guestPaymentRecoveryHelpers';
import { recoverStoredPayment } from './guestPaymentRecoveryCoordinator';
import { useGuestPaymentRecoveryReceiptState } from './useGuestPaymentRecoveryReceiptState';

export const GUEST_PAYMENT_RECOVERY_MAX_DURATION_MS = GUEST_PAYMENT_RECOVERY_MAX_DURATION_CONFIG_MS;

export function useGuestPaymentRecovery({
  activeIdentity,
  recoveryIdentity,
  returnAttemptId,
  runExclusive,
  onReturnedPaymentSettled,
}: GuestPaymentRecoveryOptions) {
  const descriptorRef = useRef<GuestAccountPaymentAttemptDescriptor | null>(null);
  const [attempt, setAttempt] = useState<GuestPaymentAttemptSummary | null>(null);
  const [operation, setOperation] = useState<GuestAccountPaymentOperation | null>(null);
  const [checkout, setCheckout] = useState<GuestAccountCheckoutStatus | null>(null);
  const [receipts, setReceipts] = useState<readonly GuestPaymentReceiptSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecoveryPolling, setIsRecoveryPolling] = useState(false);
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const [returnReceiptUnavailable, setReturnReceiptUnavailable] = useState(false);
  const [error, setError] = useState<GuestPaymentErrorKey>('');
  const recoveryGeneration = useRef(0);
  const recoveryAbortController = useRef<AbortController | null>(null);

  const publishDescriptor = useCallback((descriptor: GuestAccountPaymentAttemptDescriptor | null) => {
    descriptorRef.current = descriptor;
    setAttempt(descriptor ? summarizeDescriptor(descriptor) : null);
  }, []);

  const { publishReceipt, fetchReceipt } = useGuestPaymentRecoveryReceiptState({
    descriptorRef,
    publishDescriptor,
    setStorageUnavailable,
    setReceipts,
  });

  const recoverSavedPayment = useCallback(
    async (target?: GuestPaymentRecoveryTarget) => {
      const recoveryAttemptId = target === undefined ? returnAttemptId : target.attemptId;
      setIsLoading(true);
      setIsRecoveryPolling(false);
      recoveryAbortController.current?.abort();
      const abortController = new AbortController();
      recoveryAbortController.current = abortController;
      const generation = ++recoveryGeneration.current;
      const isCurrent = () => recoveryGeneration.current === generation;
      const deadlineTimer = setTimeout(() => {
        if (isCurrent()) {
          setError('load');
          setReturnReceiptUnavailable(Boolean(recoveryAttemptId));
          setIsLoading(false);
        }
        abortController.abort();
      }, GUEST_PAYMENT_RECOVERY_MAX_DURATION_MS);
      try {
        setOperation(null);
        setCheckout(null);
        setReceipts([]);
        setError('');
        setReturnReceiptUnavailable(false);
        await recoverStoredPayment({
          target,
          attemptId: recoveryAttemptId,
          activeIdentity,
          recoveryIdentity,
          signal: abortController.signal,
          isCurrent,
          publishDescriptor,
          publishReceipt,
          fetchReceipt,
          setOperation,
          setCheckout,
          setError,
          setReturnReceiptUnavailable,
          setIsLoading,
          setIsRecoveryPolling,
          setStorageUnavailable,
          onReturnedPaymentSettled,
          runExclusive,
          saveUpdatedDescriptor: (descriptor) => {
            if (!saveGuestAccountPaymentAttempt(descriptor)) return false;
            publishDescriptor(descriptor);
            return true;
          },
          waitForNextPoll: (delayMs) => waitForRecoveryPoll(delayMs, abortController.signal),
        });
      } finally {
        clearTimeout(deadlineTimer);
        if (recoveryAbortController.current === abortController) recoveryAbortController.current = null;
      }
    },
    [
      activeIdentity,
      fetchReceipt,
      onReturnedPaymentSettled,
      publishDescriptor,
      publishReceipt,
      recoveryIdentity,
      returnAttemptId,
      runExclusive,
    ],
  );

  const stopRecoveryPolling = useCallback(() => {
    if (!isRecoveryPolling) return false;
    recoveryGeneration.current += 1;
    recoveryAbortController.current?.abort();
    setIsRecoveryPolling(false);
    return true;
  }, [isRecoveryPolling]);

  useEffect(() => {
    setIsLoading(true);
    void recoverSavedPayment();
    return () => {
      recoveryGeneration.current += 1;
      recoveryAbortController.current?.abort();
    };
  }, [recoverSavedPayment]);
  return {
    descriptorRef,
    attempt,
    operation,
    setOperation,
    checkout,
    setCheckout,
    receipts,
    isLoading,
    isRecoveryPolling,
    storageUnavailable,
    returnReceiptUnavailable,
    error,
    setError,
    publishDescriptor,
    fetchReceipt,
    recoverSavedPayment,
    stopRecoveryPolling,
  };
}
