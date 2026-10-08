import type { TableGuestVisitIdentity } from '@/types/tableGuestVisit';
import type {
  GuestAccountCheckoutStatus,
  GuestAccountPaymentAttemptDescriptor,
  GuestAccountPaymentOperation,
} from '@/types/guestAccountPayments';
import type { GuestPaymentErrorKey } from '@/lib/guestPaymentError';
import { isTerminalGuestPayment, safeStripeCheckoutUrl } from '@/lib/guestAccountPaymentRules';
import { guestAccountPaymentService } from '@/services/guestAccountPaymentService';
import {
  createReceiptCredential,
  saveGuestAccountPaymentAttempt,
  withCheckoutAttempt,
  withReceiptCredential,
  withReservation,
  withStartRequested,
} from '@/services/guestAccountPaymentStorage';
import type { GuestPaymentRecoveryTarget } from './guestPaymentRecoveryHelpers';

export interface GuestPaymentStartOptions {
  readonly activeIdentity: TableGuestVisitIdentity | null;
  readonly newPaymentsEnabled: boolean;
  readonly canCreatePayment: boolean;
  readonly isRecoveryPolling: boolean;
  readonly descriptorRef: { current: GuestAccountPaymentAttemptDescriptor | null };
  readonly runExclusive: <T>(operation: () => Promise<T>, blocked: T) => Promise<T>;
  readonly publishDescriptor: (descriptor: GuestAccountPaymentAttemptDescriptor | null) => void;
  readonly setOperation: (operation: GuestAccountPaymentOperation | null) => void;
  readonly setCheckout: (checkout: GuestAccountCheckoutStatus | null) => void;
  readonly setError: (error: GuestPaymentErrorKey) => void;
  readonly setStorageUnavailable: (unavailable: boolean) => void;
  readonly refreshAccount: () => Promise<unknown>;
  readonly onAccountUpdated: () => void;
  readonly recoverSavedPayment: (target?: GuestPaymentRecoveryTarget) => Promise<void>;
  readonly isCurrentIdentity: (identity: TableGuestVisitIdentity) => boolean;
}

export interface StartCheckoutOutcome {
  readonly success: boolean;
  readonly openUrl: string | null;
  readonly recover: boolean;
  readonly attemptId: string | null;
}

const FAILED_START: StartCheckoutOutcome = { success: false, openUrl: null, recover: false, attemptId: null };

export async function resumeExistingCheckout(
  descriptor: GuestAccountPaymentAttemptDescriptor,
  identity: TableGuestVisitIdentity,
  context: GuestPaymentStartOptions,
): Promise<StartCheckoutOutcome> {
  const status = await guestAccountPaymentService.getCheckoutStatus(identity, descriptor).then(
    (checkoutStatus) => checkoutStatus,
    () => null,
  );
  if (!context.isCurrentIdentity(identity)) return FAILED_START;
  if (status && isTerminalGuestPayment(status.state) && !status.reconciliationRequired)
    return { success: true, openUrl: null, recover: true, attemptId: status.attemptId };
  if (status) {
    context.setCheckout(status);
    return {
      success: true,
      openUrl: status.reconciliationRequired ? null : safeStripeCheckoutUrl(status.checkoutUrl),
      recover: false,
      attemptId: null,
    };
  }
  // A failed status lookup falls through to the same idempotent request, which recovers a lost start response.
  return postOriginalStart(descriptor, identity, context);
}

export async function startNewCheckout(
  descriptor: GuestAccountPaymentAttemptDescriptor,
  identity: TableGuestVisitIdentity,
  context: GuestPaymentStartOptions,
): Promise<StartCheckoutOutcome> {
  if (!context.newPaymentsEnabled || !context.canCreatePayment) return FAILED_START;
  let operation = await guestAccountPaymentService.getOperation(identity, descriptor);
  if (!context.isCurrentIdentity(identity)) return FAILED_START;
  if (isTerminalGuestPayment(operation.state)) return recoveredOutcome(descriptor.attemptId);
  context.setOperation(operation);

  let ready = descriptor;
  if (operation.state === 'Quoted') {
    ready = persistReceiptCapability(ready, context);
    operation = await reserveQuotedOperation(operation, identity, ready);
    if (!context.isCurrentIdentity(identity)) return FAILED_START;
    if (isTerminalGuestPayment(operation.state)) return recoveredOutcome(descriptor.attemptId);
    context.setOperation(operation);
  }
  if (operation.state !== 'Reserved') return FAILED_START;

  ready = persistReceiptCapability(ready, context);
  ready = persistReservedVersion(ready, operation, context);
  return postOriginalStart(ready, identity, context);
}

function recoveredOutcome(attemptId: string | null): StartCheckoutOutcome {
  return { success: true, openUrl: null, recover: true, attemptId };
}

async function reserveQuotedOperation(
  operation: GuestAccountPaymentOperation,
  identity: TableGuestVisitIdentity,
  descriptor: GuestAccountPaymentAttemptDescriptor,
): Promise<GuestAccountPaymentOperation> {
  if (operation.state !== 'Quoted') return operation;
  return guestAccountPaymentService.reserve(identity, descriptor, {
    expectedVersion: operation.version,
    expectedAccountRevision: descriptor.quote.expectedAccountRevision,
  });
}

function persistReceiptCapability(
  descriptor: GuestAccountPaymentAttemptDescriptor,
  context: GuestPaymentStartOptions,
): GuestAccountPaymentAttemptDescriptor {
  if (descriptor.receiptCredential) return descriptor;
  const receiptCredential = createReceiptCredential();
  if (!receiptCredential) throw new Error('secure-storage');
  const marked = withReceiptCredential(descriptor, receiptCredential);
  if (!saveGuestAccountPaymentAttempt(marked)) {
    context.setStorageUnavailable(true);
    throw new Error('storage');
  }
  context.publishDescriptor(marked);
  return marked;
}

function persistReservedVersion(
  descriptor: GuestAccountPaymentAttemptDescriptor,
  operation: GuestAccountPaymentOperation,
  context: GuestPaymentStartOptions,
): GuestAccountPaymentAttemptDescriptor {
  if (descriptor.reservedExpectedVersion !== null) return descriptor;
  const receiptCredential = descriptor.receiptCredential;
  if (!receiptCredential) throw new Error('recovery');
  const ready = withReservation(descriptor, operation.version, receiptCredential);
  if (!saveGuestAccountPaymentAttempt(ready)) {
    context.setStorageUnavailable(true);
    throw new Error('storage');
  }
  context.publishDescriptor(ready);
  return ready;
}

async function postOriginalStart(
  descriptor: GuestAccountPaymentAttemptDescriptor,
  identity: TableGuestVisitIdentity,
  context: GuestPaymentStartOptions,
): Promise<StartCheckoutOutcome> {
  if (!descriptor.receiptCredential || descriptor.reservedExpectedVersion === null) throw new Error('recovery');
  const marked = withStartRequested(descriptor);
  const reservedExpectedVersion = marked.reservedExpectedVersion;
  const receiptCredential = marked.receiptCredential;
  if (reservedExpectedVersion === null || !receiptCredential) throw new Error('recovery');
  if (!saveGuestAccountPaymentAttempt(marked)) {
    context.setStorageUnavailable(true);
    throw new Error('storage');
  }
  context.publishDescriptor(marked);
  if (!context.isCurrentIdentity(identity)) return FAILED_START;
  const result = await guestAccountPaymentService.startCheckout(
    identity,
    marked,
    reservedExpectedVersion,
    receiptCredential,
  );
  if (!context.isCurrentIdentity(identity)) return FAILED_START;
  const next = withCheckoutAttempt(marked, result.attemptId);
  if (saveGuestAccountPaymentAttempt(next)) context.publishDescriptor(next);
  else context.setStorageUnavailable(true);
  if (isTerminalGuestPayment(result.state) && !result.reconciliationRequired) return recoveredOutcome(result.attemptId);
  context.setCheckout(result);
  return {
    success: true,
    openUrl: result.reconciliationRequired ? null : safeStripeCheckoutUrl(result.checkoutUrl),
    recover: false,
    attemptId: null,
  };
}
