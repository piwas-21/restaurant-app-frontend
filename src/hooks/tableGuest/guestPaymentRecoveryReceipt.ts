import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { GuestAccountPaymentAttemptDescriptor, GuestPaymentReceipt } from '@/types/guestAccountPayments';
import type { GuestPaymentReceiptSummary } from '@/types/guestPaymentRecovery';
import { guestAccountPaymentService } from '@/services/guestAccountPaymentService';
import {
  removeGuestAccountPaymentAttempt,
  saveGuestAccountPaymentAttempt,
  withCheckoutAttempt,
  withReceiptExpiry,
} from '@/services/guestAccountPaymentStorage';

interface GuestPaymentReceiptRecoveryCallbacks {
  readonly descriptorRef: MutableRefObject<GuestAccountPaymentAttemptDescriptor | null>;
  readonly publishDescriptor: (descriptor: GuestAccountPaymentAttemptDescriptor | null) => void;
  readonly setStorageUnavailable: (value: boolean) => void;
  readonly setReceipts: Dispatch<SetStateAction<readonly GuestPaymentReceiptSummary[]>>;
}

export async function fetchGuestPaymentReceipt(
  descriptor: GuestAccountPaymentAttemptDescriptor,
  attemptId: string,
  callbacks: GuestPaymentReceiptRecoveryCallbacks,
  isCurrent: () => boolean = () => true,
  signal?: AbortSignal,
  deferTerminalPublication = false,
): Promise<GuestPaymentReceipt | null> {
  if (!isCurrent() || signal?.aborted || !descriptor.receiptCredential) return null;
  if (
    descriptor.receiptExpiresAt &&
    descriptor.receiptTerminalState &&
    Date.parse(descriptor.receiptExpiresAt) <= Date.now()
  ) {
    removeGuestAccountPaymentAttempt(descriptor.serviceSessionId, descriptor.operationId);
    const current = callbacks.descriptorRef.current;
    if (current?.serviceSessionId === descriptor.serviceSessionId && current.operationId === descriptor.operationId)
      callbacks.publishDescriptor(null);
    callbacks.setReceipts((receipts) => receipts.filter((entry) => entry.attemptId !== attemptId));
    return null;
  }

  const receipt = signal
    ? await guestAccountPaymentService.getReceipt(attemptId, descriptor.receiptCredential, descriptor, signal)
    : await guestAccountPaymentService.getReceipt(attemptId, descriptor.receiptCredential, descriptor);
  if (!isCurrent() || signal?.aborted) return null;
  const identified = descriptor.attemptId === null ? withCheckoutAttempt(descriptor, receipt.attemptId) : descriptor;
  const updated = withReceiptExpiry(
    identified,
    receipt.receiptExpiresAt,
    receipt.state,
    receipt.reconciliationRequired,
  );
  const saved = saveGuestAccountPaymentAttempt(updated);
  if (!saved) callbacks.setStorageUnavailable(true);
  const current = callbacks.descriptorRef.current;
  if (
    saved &&
    current?.serviceSessionId === descriptor.serviceSessionId &&
    current.operationId === descriptor.operationId
  )
    callbacks.publishDescriptor(updated);
  if (!shouldDeferTerminalReceipt(receipt, deferTerminalPublication))
    callbacks.setReceipts((receipts) => [
      ...receipts.filter((entry) => entry.attemptId !== attemptId),
      { attemptId, operationId: descriptor.operationId, receipt },
    ]);
  return receipt;
}

function shouldDeferTerminalReceipt(receipt: GuestPaymentReceipt, deferTerminalPublication: boolean): boolean {
  return (
    deferTerminalPublication &&
    !receipt.reconciliationRequired &&
    receipt.state !== 'ReconciliationRequired' &&
    ['Captured', 'Released', 'Failed'].includes(receipt.state)
  );
}
