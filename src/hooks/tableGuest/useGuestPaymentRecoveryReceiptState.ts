'use client';

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { GuestAccountPaymentAttemptDescriptor, GuestPaymentReceipt } from '@/types/guestAccountPayments';
import type { GuestPaymentReceiptSummary } from '@/types/guestPaymentRecovery';
import { fetchGuestPaymentReceipt } from './guestPaymentRecoveryReceipt';

interface GuestPaymentRecoveryReceiptStateOptions {
  readonly descriptorRef: MutableRefObject<GuestAccountPaymentAttemptDescriptor | null>;
  readonly publishDescriptor: (descriptor: GuestAccountPaymentAttemptDescriptor | null) => void;
  readonly setStorageUnavailable: (value: boolean) => void;
  readonly setReceipts: Dispatch<SetStateAction<readonly GuestPaymentReceiptSummary[]>>;
}

export function useGuestPaymentRecoveryReceiptState({
  descriptorRef,
  publishDescriptor,
  setStorageUnavailable,
  setReceipts,
}: GuestPaymentRecoveryReceiptStateOptions) {
  const publishReceipt = useCallback(
    (operationId: string, receipt: GuestPaymentReceipt) => {
      setReceipts((receipts) => [
        ...receipts.filter((entry) => entry.attemptId !== receipt.attemptId),
        { attemptId: receipt.attemptId, operationId, receipt },
      ]);
    },
    [setReceipts],
  );

  const fetchReceipt = useCallback(
    (
      descriptor: GuestAccountPaymentAttemptDescriptor,
      attemptId: string,
      isCurrent: () => boolean = () => true,
      signal?: AbortSignal,
      deferTerminalPublication = false,
    ) =>
      fetchGuestPaymentReceipt(
        descriptor,
        attemptId,
        { descriptorRef, publishDescriptor, setStorageUnavailable, setReceipts },
        isCurrent,
        signal,
        deferTerminalPublication,
      ),
    [descriptorRef, publishDescriptor, setReceipts, setStorageUnavailable],
  );

  return { publishReceipt, fetchReceipt };
}
