'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  GuestAccountCheckoutStatus,
  GuestAccountPaymentAttemptDescriptor,
  GuestAccountPaymentOperation,
  GuestPaymentReceipt,
} from '@/types/guestAccountPayments';
import type {
  GuestPaymentAttemptSummary,
  GuestPaymentReceiptSummary,
  GuestPaymentRecoveryOptions,
} from '@/types/guestPaymentRecovery';
import type { GuestPaymentErrorKey } from '@/lib/guestPaymentError';
import { guestAccountPaymentService } from '@/services/guestAccountPaymentService';
import {
  readGuestAccountPaymentAttempts,
  removeGuestAccountPaymentAttempt,
  saveGuestAccountPaymentAttempt,
  withCheckoutAttempt,
  withReceiptExpiry,
} from '@/services/guestAccountPaymentStorage';
import { recoverActivePayment, recoverReceiptOnly, summarizeDescriptor } from './guestPaymentRecoveryHelpers';
import { chooseGuestPaymentRecovery, recoverReturnedReceipt } from './guestPaymentRecoverySelection';

export function useGuestPaymentRecovery({
  activeIdentity,
  recoveryIdentity,
  returnAttemptId,
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

  const publishDescriptor = useCallback((descriptor: GuestAccountPaymentAttemptDescriptor | null) => {
    descriptorRef.current = descriptor;
    setAttempt(descriptor ? summarizeDescriptor(descriptor) : null);
  }, []);

  const fetchReceipt = useCallback(
    async (
      descriptor: GuestAccountPaymentAttemptDescriptor,
      attemptId: string,
    ): Promise<GuestPaymentReceipt | null> => {
      if (!descriptor.receiptCredential) return null;
      if (
        descriptor.receiptExpiresAt &&
        descriptor.receiptTerminalState &&
        Date.parse(descriptor.receiptExpiresAt) <= Date.now()
      ) {
        removeGuestAccountPaymentAttempt(descriptor.serviceSessionId, descriptor.operationId);
        if (
          descriptorRef.current?.serviceSessionId === descriptor.serviceSessionId &&
          descriptorRef.current.operationId === descriptor.operationId
        )
          publishDescriptor(null);
        setReceipts((current) => current.filter((entry) => entry.attemptId !== attemptId));
        return null;
      }
      const receipt = await guestAccountPaymentService.getReceipt(attemptId, descriptor.receiptCredential, descriptor);
      const identified =
        descriptor.attemptId === null ? withCheckoutAttempt(descriptor, receipt.attemptId) : descriptor;
      const updated = withReceiptExpiry(
        identified,
        receipt.receiptExpiresAt,
        receipt.state,
        receipt.reconciliationRequired,
      );
      const saved = saveGuestAccountPaymentAttempt(updated);
      if (!saved) setStorageUnavailable(true);
      const current = descriptorRef.current;
      if (
        saved &&
        current?.serviceSessionId === descriptor.serviceSessionId &&
        current.operationId === descriptor.operationId
      )
        publishDescriptor(updated);
      setReceipts((current) => [
        ...current.filter((entry) => entry.attemptId !== attemptId),
        { attemptId, operationId: descriptor.operationId, receipt },
      ]);
      return receipt;
    },
    [publishDescriptor, setStorageUnavailable],
  );

  const recoverSavedPayment = useCallback(async () => {
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
      saveUpdatedDescriptor: (descriptor) => {
        if (!saveGuestAccountPaymentAttempt(descriptor)) return false;
        publishDescriptor(descriptor);
        return true;
      },
    });
  }, [activeIdentity, fetchReceipt, publishDescriptor, recoveryIdentity, returnAttemptId]);

  useEffect(() => {
    setIsLoading(true);
    void recoverSavedPayment();
    return () => {
      recoveryGeneration.current += 1;
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
