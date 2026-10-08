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
import { fetchGuestPaymentReceipt } from './guestPaymentRecoveryReceipt';

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

  const fetchReceipt = useCallback(
    (descriptor: GuestAccountPaymentAttemptDescriptor, attemptId: string, isCurrent: () => boolean = () => true) =>
      fetchGuestPaymentReceipt(
        descriptor,
        attemptId,
        { descriptorRef, publishDescriptor, setStorageUnavailable, setReceipts },
        isCurrent,
      ),
    [publishDescriptor, setStorageUnavailable],
  );

  const recoverSavedPayment = useCallback(async () => {
    recoveryAbortController.current?.abort();
    const abortController = new AbortController();
    recoveryAbortController.current = abortController;
    const generation = ++recoveryGeneration.current;
    const isCurrent = () => recoveryGeneration.current === generation;
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
    if (!isCurrent()) return;

    await recoverReturnedReceipt(
      returnAttemptId,
      receiptDescriptor,
      selected,
      fetchReceipt,
      setReturnReceiptUnavailable,
    );
    if (!isCurrent()) return;

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
      await recoverReceiptOnly(selected, selectedReturnAttemptId, fetchReceipt, setReturnReceiptUnavailable);
      if (isCurrent()) setIsLoading(false);
      return;
    }

    await recoverActivePayment(selected, activeIdentity, selectedReturnAttemptId, {
      isCurrent,
      setOperation,
      setCheckout,
      setError,
      setReturnReceiptUnavailable,
      setIsLoading,
      fetchReceipt,
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
  }, [
    activeIdentity,
    fetchReceipt,
    onReturnedPaymentSettled,
    publishDescriptor,
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
