import type { TableGuestVisitIdentity } from '@/types/tableGuestVisit';
import type {
  GuestAccountCheckoutStatus,
  GuestAccountPaymentAttemptDescriptor,
  GuestAccountPaymentOperation,
  GuestPaymentReceipt,
} from '@/types/guestAccountPayments';
import type { GuestPaymentErrorKey } from '@/lib/guestPaymentError';
import type { GuestPaymentRecoveryTarget } from './guestPaymentRecoveryHelpers';
import {
  recoverActivePayment,
  recoverReceiptOnly,
  type GuestPaymentRecoveryFetchReceipt,
} from './guestPaymentRecoveryHelpers';
import { chooseGuestPaymentRecovery, recoverReturnedReceipt } from './guestPaymentRecoverySelection';
import { readGuestAccountPaymentAttempts } from '@/services/guestAccountPaymentStorage';

interface RecoveryCoordinatorOptions {
  readonly target?: GuestPaymentRecoveryTarget;
  readonly attemptId: string | null;
  readonly activeIdentity: TableGuestVisitIdentity | null;
  readonly recoveryIdentity: TableGuestVisitIdentity | null;
  readonly signal: AbortSignal;
  readonly isCurrent: () => boolean;
  readonly publishDescriptor: (descriptor: GuestAccountPaymentAttemptDescriptor | null) => void;
  readonly publishReceipt: (operationId: string, receipt: GuestPaymentReceipt) => void;
  readonly fetchReceipt: GuestPaymentRecoveryFetchReceipt;
  readonly setOperation: (operation: GuestAccountPaymentOperation | null) => void;
  readonly setCheckout: (checkout: GuestAccountCheckoutStatus | null) => void;
  readonly setIsLoading: (value: boolean) => void;
  readonly setIsRecoveryPolling: (value: boolean) => void;
  readonly setError: (value: GuestPaymentErrorKey) => void;
  readonly setReturnReceiptUnavailable: (value: boolean) => void;
  readonly setStorageUnavailable: (value: boolean) => void;
  readonly onReturnedPaymentSettled: (
    identity: TableGuestVisitIdentity,
    isCurrent: () => boolean,
    signal?: AbortSignal,
  ) => Promise<boolean>;
  readonly runExclusive: <T>(operation: () => Promise<T>, blocked: T) => Promise<T>;
  readonly saveUpdatedDescriptor: (descriptor: GuestAccountPaymentAttemptDescriptor) => boolean;
  readonly waitForNextPoll: (delayMs: number) => Promise<boolean>;
}

export async function recoverStoredPayment(options: RecoveryCoordinatorOptions): Promise<void> {
  const stored = readGuestAccountPaymentAttempts();
  if (stored.kind === 'unavailable') {
    options.setStorageUnavailable(true);
    options.setIsLoading(false);
    return;
  }
  options.setStorageUnavailable(false);
  if (stored.kind === 'empty') {
    options.publishDescriptor(null);
    options.setIsLoading(false);
    options.setReturnReceiptUnavailable(Boolean(options.attemptId));
    return;
  }

  const attempts = options.target
    ? stored.attempts.filter((descriptor) => descriptor.operationId === options.target?.operationId)
    : stored.attempts;
  const selection = await chooseGuestPaymentRecovery(
    attempts,
    options.attemptId,
    options.activeIdentity,
    options.recoveryIdentity,
  );
  if (!isCurrent(options)) return;

  await recoverReturnedReceipt(
    options.attemptId,
    selection.receiptDescriptor,
    selection.selected,
    options.fetchReceipt,
    options.setReturnReceiptUnavailable,
    options.signal,
    options.isCurrent,
  );
  if (!isCurrent(options)) return;
  await recoverSelectedPayment(options, selection.selected, selection.receiptDescriptor);
}

async function recoverSelectedPayment(
  options: RecoveryCoordinatorOptions,
  selected: GuestAccountPaymentAttemptDescriptor | null,
  receiptDescriptor: GuestAccountPaymentAttemptDescriptor | null,
): Promise<void> {
  if (!selected) {
    options.publishDescriptor(!options.activeIdentity ? receiptDescriptor : null);
    options.setOperation(null);
    options.setCheckout(null);
    options.setIsLoading(false);
    return;
  }

  const selectedReturnAttemptId = selected === receiptDescriptor ? options.attemptId : null;
  options.publishDescriptor(selected);
  if (!options.attemptId || (selected === receiptDescriptor && options.activeIdentity !== null))
    options.setReturnReceiptUnavailable(false);
  if (selected.serviceSessionId !== options.activeIdentity?.serviceSessionId) {
    await recoverReceiptOnly(
      selected,
      selectedReturnAttemptId,
      options.fetchReceipt,
      options.setReturnReceiptUnavailable,
      options.signal,
      options.isCurrent,
    );
    if (isCurrent(options)) options.setIsLoading(false);
    return;
  }

  await recoverActivePayment(selected, options.activeIdentity, selectedReturnAttemptId, {
    isCurrent: options.isCurrent,
    signal: options.signal,
    setOperation: options.setOperation,
    setCheckout: options.setCheckout,
    setError: options.setError,
    setReturnReceiptUnavailable: options.setReturnReceiptUnavailable,
    setIsLoading: options.setIsLoading,
    setIsRecoveryPolling: options.setIsRecoveryPolling,
    pollAfterInitialRead: options.target?.poll ?? true,
    pollWithoutReturnHint: options.target !== undefined && options.target.poll !== false,
    fetchReceipt: options.fetchReceipt,
    publishReceipt: options.publishReceipt,
    setStorageUnavailable: options.setStorageUnavailable,
    onReturnedPaymentSettled: options.onReturnedPaymentSettled,
    saveUpdatedDescriptor: options.saveUpdatedDescriptor,
    runExclusive: options.runExclusive,
    waitForNextPoll: options.waitForNextPoll,
  });
}

function isCurrent(options: RecoveryCoordinatorOptions): boolean {
  return options.isCurrent() && !options.signal.aborted;
}
