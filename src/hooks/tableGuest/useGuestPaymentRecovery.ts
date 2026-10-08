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
import { readGuestAccountPaymentAttempts, saveGuestAccountPaymentAttempt } from '@/services/guestAccountPaymentStorage';
import {
  recoverActivePayment,
  recoverReceiptOnly,
  summarizeDescriptor,
  waitForRecoveryPoll,
} from './guestPaymentRecoveryHelpers';
import { chooseGuestPaymentRecovery, recoverReturnedReceipt } from './guestPaymentRecoverySelection';
import { useGuestPaymentRecoveryReceiptState } from './useGuestPaymentRecoveryReceiptState';

export const GUEST_PAYMENT_RECOVERY_MAX_DURATION_MS = 120_000;

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

  const recoverSavedPayment = useCallback(async () => {
    setIsLoading(true);
    recoveryAbortController.current?.abort();
    const abortController = new AbortController();
    recoveryAbortController.current = abortController;
    const generation = ++recoveryGeneration.current;
    const isCurrent = () => recoveryGeneration.current === generation;
    const deadlineTimer = setTimeout(() => {
      if (isCurrent()) {
        setError('load');
        setReturnReceiptUnavailable(Boolean(returnAttemptId));
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
      const stored = readGuestAccountPaymentAttempts();
      if (stored.kind === 'unavailable') {
        setStorageUnavailable(true);
        setIsLoading(false);
        return;
      }
      setStorageUnavailable(false);
      if (stored.kind === 'empty') {
        publishDescriptor(null);
        setIsLoading(false);
        setReturnReceiptUnavailable(Boolean(returnAttemptId));
        return;
      }

      const { selected, receiptDescriptor } = await chooseGuestPaymentRecovery(
        stored.attempts,
        returnAttemptId,
        activeIdentity,
        recoveryIdentity,
      );
      if (!isCurrent() || abortController.signal.aborted) return;

      await recoverReturnedReceipt(
        returnAttemptId,
        receiptDescriptor,
        selected,
        fetchReceipt,
        setReturnReceiptUnavailable,
        abortController.signal,
        isCurrent,
      );
      if (!isCurrent() || abortController.signal.aborted) return;

      if (!selected) {
        publishDescriptor(!activeIdentity ? receiptDescriptor : null);
        setOperation(null);
        setCheckout(null);
        setIsLoading(false);
        return;
      }

      const selectedReturnAttemptId = selected === receiptDescriptor ? returnAttemptId : null;
      publishDescriptor(selected);
      if (!returnAttemptId || (selected === receiptDescriptor && activeIdentity !== null))
        setReturnReceiptUnavailable(false);
      if (selected.serviceSessionId !== activeIdentity?.serviceSessionId) {
        await recoverReceiptOnly(
          selected,
          selectedReturnAttemptId,
          fetchReceipt,
          setReturnReceiptUnavailable,
          abortController.signal,
          isCurrent,
        );
        if (isCurrent()) setIsLoading(false);
        return;
      }

      await recoverActivePayment(selected, activeIdentity, selectedReturnAttemptId, {
        isCurrent,
        signal: abortController.signal,
        setOperation,
        setCheckout,
        setError,
        setReturnReceiptUnavailable,
        setIsLoading,
        fetchReceipt,
        publishReceipt,
        setStorageUnavailable,
        onReturnedPaymentSettled,
        saveUpdatedDescriptor: (descriptor) => {
          if (!saveGuestAccountPaymentAttempt(descriptor)) return false;
          publishDescriptor(descriptor);
          return true;
        },
        runExclusive,
        waitForNextPoll: (delayMs) => waitForRecoveryPoll(delayMs, abortController.signal),
      });
    } finally {
      clearTimeout(deadlineTimer);
      if (recoveryAbortController.current === abortController) recoveryAbortController.current = null;
    }
  }, [
    activeIdentity,
    fetchReceipt,
    onReturnedPaymentSettled,
    publishDescriptor,
    publishReceipt,
    recoveryIdentity,
    returnAttemptId,
    runExclusive,
  ]);

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
    storageUnavailable,
    returnReceiptUnavailable,
    error,
    setError,
    publishDescriptor,
    fetchReceipt,
    recoverSavedPayment,
  };
}
