import type { TableGuestVisitIdentity } from '@/types/tableGuestVisit';
import type {
  GuestAccountCheckoutStatus,
  GuestAccountPaymentAttemptDescriptor,
  GuestAccountPaymentOperation,
  GuestPaymentReceipt,
} from '@/types/guestAccountPayments';
import { createGuestPaymentContribution } from '@/lib/guestAccountPaymentResponse';
import { guestAccountPaymentService } from '@/services/guestAccountPaymentService';
import { withCheckoutAttempt, withQuotedOperation } from '@/services/guestAccountPaymentStorage';
import type { GuestPaymentAttemptSummary } from '@/types/guestPaymentRecovery';
import { guestPaymentErrorMessage } from '@/lib/guestPaymentError';
import type { GuestPaymentErrorKey } from '@/lib/guestPaymentError';
import { isTerminalGuestPayment, isUnfinishedGuestPaymentQuote } from '@/lib/guestAccountPaymentRules';
import { GUEST_PAYMENT_RETURNED_CHECKOUT_POLL_DELAYS_CONFIG_MS } from '@/lib/config';

interface ReturnedCheckoutRead {
  readonly checkout: GuestAccountCheckoutStatus;
  readonly descriptor: GuestAccountPaymentAttemptDescriptor;
  readonly receipt: GuestPaymentReceipt | null;
  readonly operation: GuestAccountPaymentOperation | null;
}

export function latestForSession(
  attempts: readonly GuestAccountPaymentAttemptDescriptor[],
  serviceSessionId: string | undefined,
  participantFingerprint: string | null,
): GuestAccountPaymentAttemptDescriptor | null {
  if (!serviceSessionId || !participantFingerprint) return null;
  return (
    attempts
      .filter(
        (value) =>
          value.serviceSessionId === serviceSessionId && value.participantFingerprint === participantFingerprint,
      )
      .sort((first, second) => second.createdAt - first.createdAt)[0] ?? null
  );
}

export function latestPendingStart(
  attempts: readonly GuestAccountPaymentAttemptDescriptor[],
  serviceSessionId: string | undefined,
  participantFingerprint: string | null,
): GuestAccountPaymentAttemptDescriptor | null {
  if (!serviceSessionId || !participantFingerprint) return null;
  return (
    attempts
      .filter(
        (value) =>
          value.serviceSessionId === serviceSessionId &&
          value.participantFingerprint === participantFingerprint &&
          value.startRequestedAt !== null,
      )
      .sort((first, second) => second.createdAt - first.createdAt)[0] ?? null
  );
}

export async function recoverReceiptOnly(
  descriptor: GuestAccountPaymentAttemptDescriptor,
  returnAttemptId: string | null,
  fetchReceipt: (
    descriptor: GuestAccountPaymentAttemptDescriptor,
    attemptId: string,
    isCurrent?: () => boolean,
    signal?: AbortSignal,
  ) => Promise<GuestPaymentReceipt | null>,
  setReturnReceiptUnavailable: (value: boolean) => void,
  signal?: AbortSignal,
  isCurrent: () => boolean = () => true,
): Promise<void> {
  const attemptId = returnAttemptId ?? descriptor.attemptId;
  const canReportReceiptAvailability = Boolean(returnAttemptId || attemptId);
  if (
    !attemptId ||
    !descriptor.receiptCredential ||
    !descriptor.contribution ||
    (returnAttemptId !== null && descriptor.attemptId !== null && descriptor.attemptId !== returnAttemptId)
  ) {
    if (isCurrent() && !signal?.aborted) setReturnReceiptUnavailable(canReportReceiptAvailability);
    return;
  }
  let receiptAvailable = false;
  try {
    const receipt = signal
      ? await fetchReceipt(descriptor, attemptId, isCurrent, signal)
      : await fetchReceipt(descriptor, attemptId, isCurrent);
    if (!isCurrent() || signal?.aborted) return;
    receiptAvailable = receipt !== null;
  } catch (_error) {
    // Receipt capabilities collapse provider/auth details to the same unavailable status.
  }
  if (isCurrent() && !signal?.aborted)
    setReturnReceiptUnavailable(Boolean(canReportReceiptAvailability && !receiptAvailable));
}

export function selectRecoveryAttempt(
  attempts: readonly GuestAccountPaymentAttemptDescriptor[],
  returnAttemptId: string | null,
  serviceSessionId: string | undefined,
  participantFingerprint: string | null,
): GuestAccountPaymentAttemptDescriptor | null {
  if (returnAttemptId) {
    const returned = attempts.find(
      (value) =>
        value.attemptId === returnAttemptId &&
        value.serviceSessionId === serviceSessionId &&
        value.participantFingerprint === participantFingerprint,
    );
    if (returned) return returned;
    return latestPendingStart(attempts, serviceSessionId, participantFingerprint);
  }
  return latestForSession(attempts, serviceSessionId, participantFingerprint);
}

export function selectReceiptRecoveryAttempt(
  attempts: readonly GuestAccountPaymentAttemptDescriptor[],
  returnAttemptId: string,
  serviceSessionId: string | undefined,
  allowedFingerprints: readonly (string | null)[],
  identityAvailable: boolean,
): GuestAccountPaymentAttemptDescriptor | null {
  const allowed = new Set(allowedFingerprints.filter((value): value is string => value !== null));
  const exact = attempts.find(
    (value) =>
      value.attemptId === returnAttemptId && (!serviceSessionId || value.serviceSessionId === serviceSessionId),
  );
  if (exact) {
    if (!identityAvailable) return exact;
    return typeof exact.participantFingerprint === 'string' && allowed.has(exact.participantFingerprint) ? exact : null;
  }
  if (identityAvailable && allowed.size === 0) return null;
  if (serviceSessionId && allowed.size === 0) return null;
  const candidates = attempts.filter(
    (value) =>
      (!serviceSessionId || value.serviceSessionId === serviceSessionId) &&
      value.participantFingerprint &&
      (allowed.size === 0 || allowed.has(value.participantFingerprint)) &&
      value.startRequestedAt !== null &&
      value.attemptId === null &&
      value.receiptCredential &&
      value.contribution,
  );
  return candidates.length === 1 ? candidates[0] : null;
}

export type GuestPaymentRecoveryFetchReceipt = (
  descriptor: GuestAccountPaymentAttemptDescriptor,
  attemptId: string,
  isCurrent?: () => boolean,
  signal?: AbortSignal,
  deferTerminalPublication?: boolean,
) => Promise<GuestPaymentReceipt | null>;

interface ActiveRecoveryCallbacks {
  readonly isCurrent: () => boolean;
  readonly signal?: AbortSignal;
  readonly setOperation: (operation: GuestAccountPaymentOperation) => void;
  readonly setCheckout: (checkout: GuestAccountCheckoutStatus) => void;
  readonly setError: (error: GuestPaymentErrorKey) => void;
  readonly setReturnReceiptUnavailable: (value: boolean) => void;
  readonly setIsLoading: (value: boolean) => void;
  readonly setIsRecoveryPolling: (value: boolean) => void;
  readonly pollAfterInitialRead?: boolean;
  readonly pollWithoutReturnHint?: boolean;
  readonly fetchReceipt: GuestPaymentRecoveryFetchReceipt;
  readonly publishReceipt: (operationId: string, receipt: GuestPaymentReceipt) => void;
  readonly saveUpdatedDescriptor: (descriptor: GuestAccountPaymentAttemptDescriptor) => boolean;
  readonly setStorageUnavailable: (value: boolean) => void;
  readonly onReturnedPaymentSettled?: (
    identity: TableGuestVisitIdentity,
    isCurrent: () => boolean,
    signal?: AbortSignal,
  ) => Promise<boolean>;
  readonly runExclusive: <T>(operation: () => Promise<T>, blocked: T) => Promise<T>;
  readonly waitForNextPoll: (delayMs: number) => Promise<boolean>;
}

export interface GuestPaymentRecoveryTarget {
  readonly attemptId: string | null;
  readonly operationId: string;
  readonly poll?: boolean;
}

export async function recoverActivePayment(
  descriptor: GuestAccountPaymentAttemptDescriptor,
  identity: TableGuestVisitIdentity,
  returnAttemptId: string | null,
  callbacks: ActiveRecoveryCallbacks,
): Promise<void> {
  try {
    const operation = callbacks.signal
      ? await guestAccountPaymentService.getOperation(identity, descriptor, callbacks.signal)
      : await guestAccountPaymentService.getOperation(identity, descriptor);
    if (!callbacks.isCurrent() || callbacks.signal?.aborted) return;
    if (!descriptor.contribution) {
      if (operation.state !== 'Quoted' || descriptor.startRequestedAt !== null) throw new Error('unsafe-recovery');
      const contribution = await createGuestPaymentContribution(operation);
      if (!isActiveRecovery(callbacks)) return;
      const next = withQuotedOperation(descriptor, operation.version, contribution);
      if (!saveUpdated(next, callbacks)) return;
      descriptor = next;
    }
    // A captured operation can be observed from another tab before this tab has a
    // local start marker. Resolve its checkout if possible, but never invent a
    // receipt capability or publish terminal success without the receipt proof.
    const hasStartedCheckout = requiresCheckoutLookup(descriptor) || operation.state === 'Captured';
    const shouldWithholdUnmatchedTerminal = hasStartedCheckout && isTerminalGuestPayment(operation.state);
    if (!shouldWithholdUnmatchedTerminal) callbacks.setOperation(operation);
    if (hasStartedCheckout) {
      await recoverStartedPayment(descriptor, identity, returnAttemptId, operation, callbacks);
    } else if (returnAttemptId) {
      callbacks.setReturnReceiptUnavailable(true);
    }
  } catch (error) {
    markActiveRecoveryFailed(error, descriptor, returnAttemptId, callbacks);
  } finally {
    if (callbacks.isCurrent()) callbacks.setIsLoading(false);
  }
}

function requiresCheckoutLookup(descriptor: GuestAccountPaymentAttemptDescriptor): boolean {
  return descriptor.startRequestedAt !== null || descriptor.attemptId !== null;
}

async function recoverStartedPayment(
  descriptor: GuestAccountPaymentAttemptDescriptor,
  identity: TableGuestVisitIdentity,
  returnAttemptId: string | null,
  initialOperation: GuestAccountPaymentOperation,
  callbacks: ActiveRecoveryCallbacks,
): Promise<void> {
  const checkout = await readStartedCheckout(identity, descriptor, callbacks);
  if (!isActiveRecovery(callbacks)) return;
  const currentDescriptor = saveDiscoveredAttempt(descriptor, checkout, callbacks);
  if (!currentDescriptor) return;
  if (hasReturnAttemptMismatch(returnAttemptId, checkout)) {
    callbacks.setReturnReceiptUnavailable(true);
    return;
  }
  const receipt = await readInitialReceipt(currentDescriptor, checkout, callbacks);
  if (!isActiveRecovery(callbacks)) return;
  const currentOperation = await publishInitialCheckout(
    checkout,
    receipt,
    initialOperation,
    identity,
    currentDescriptor,
    callbacks,
  );
  await completeInitialCheckoutRead(
    checkout,
    receipt,
    currentOperation,
    identity,
    returnAttemptId,
    currentDescriptor,
    callbacks,
  );
}

async function readStartedCheckout(
  identity: TableGuestVisitIdentity,
  descriptor: GuestAccountPaymentAttemptDescriptor,
  callbacks: ActiveRecoveryCallbacks,
): Promise<GuestAccountCheckoutStatus> {
  return callbacks.signal
    ? guestAccountPaymentService.getCheckoutStatus(identity, descriptor, callbacks.signal)
    : guestAccountPaymentService.getCheckoutStatus(identity, descriptor);
}

function isActiveRecovery(callbacks: ActiveRecoveryCallbacks): boolean {
  return callbacks.isCurrent() && !callbacks.signal?.aborted;
}

function saveDiscoveredAttempt(
  descriptor: GuestAccountPaymentAttemptDescriptor,
  checkout: GuestAccountCheckoutStatus,
  callbacks: ActiveRecoveryCallbacks,
): GuestAccountPaymentAttemptDescriptor | null {
  if (checkout.attemptId === descriptor.attemptId) return descriptor;
  const next = withCheckoutAttempt(descriptor, checkout.attemptId);
  return saveUpdated(next, callbacks) ? next : null;
}

function hasReturnAttemptMismatch(returnAttemptId: string | null, checkout: GuestAccountCheckoutStatus): boolean {
  return Boolean(returnAttemptId && checkout.attemptId !== returnAttemptId);
}

async function readInitialReceipt(
  descriptor: GuestAccountPaymentAttemptDescriptor,
  checkout: GuestAccountCheckoutStatus,
  callbacks: ActiveRecoveryCallbacks,
): Promise<GuestPaymentReceipt | null> {
  if (!descriptor.receiptCredential) return null;
  return callbacks.fetchReceipt(descriptor, checkout.attemptId, callbacks.isCurrent, callbacks.signal, true);
}

async function publishInitialCheckout(
  checkout: GuestAccountCheckoutStatus,
  receipt: GuestPaymentReceipt | null,
  initialOperation: GuestAccountPaymentOperation,
  identity: TableGuestVisitIdentity,
  descriptor: GuestAccountPaymentAttemptDescriptor,
  callbacks: ActiveRecoveryCallbacks,
): Promise<GuestAccountPaymentOperation | null> {
  const operation = isTerminalGuestPayment(initialOperation.state) ? null : initialOperation;
  if (!isPublishableTerminalCheckout(checkout)) {
    callbacks.setCheckout(checkout);
    return operation;
  }
  if (!descriptor.receiptCredential) callbacks.setReturnReceiptUnavailable(true);
  return confirmReturnedTerminalCheckout(checkout, receipt, identity, descriptor, callbacks);
}

function isPublishableTerminalCheckout(checkout: GuestAccountCheckoutStatus): boolean {
  return isTerminalGuestPayment(checkout.state) && !checkout.reconciliationRequired;
}

async function completeInitialCheckoutRead(
  checkout: GuestAccountCheckoutStatus,
  receipt: GuestPaymentReceipt | null,
  operation: GuestAccountPaymentOperation | null,
  identity: TableGuestVisitIdentity,
  returnAttemptId: string | null,
  descriptor: GuestAccountPaymentAttemptDescriptor,
  callbacks: ActiveRecoveryCallbacks,
): Promise<void> {
  const shouldPoll = Boolean(descriptor.receiptCredential) && shouldPollAfterInitialRead(returnAttemptId, callbacks);
  callbacks.setIsRecoveryPolling(shouldPoll);
  callbacks.setIsLoading(false);
  if (!shouldPoll) {
    markUnmatchedTerminalReturn(checkout, receipt, operation, identity, returnAttemptId, descriptor, callbacks);
    return;
  }
  try {
    await pollReturnedCheckout(
      identity,
      returnAttemptId ?? checkout.attemptId,
      checkout,
      descriptor,
      receipt,
      operation,
      callbacks,
    );
  } finally {
    if (callbacks.isCurrent()) callbacks.setIsRecoveryPolling(false);
  }
}

function shouldPollAfterInitialRead(returnAttemptId: string | null, callbacks: ActiveRecoveryCallbacks): boolean {
  return (
    callbacks.pollAfterInitialRead !== false && (Boolean(returnAttemptId) || callbacks.pollWithoutReturnHint === true)
  );
}

function markUnmatchedTerminalReturn(
  checkout: GuestAccountCheckoutStatus,
  receipt: GuestPaymentReceipt | null,
  operation: GuestAccountPaymentOperation | null,
  identity: TableGuestVisitIdentity,
  returnAttemptId: string | null,
  descriptor: GuestAccountPaymentAttemptDescriptor,
  callbacks: ActiveRecoveryCallbacks,
): void {
  if (
    returnAttemptId &&
    isPublishableTerminalCheckout(checkout) &&
    !isFinalReturnedCheckout(checkout, receipt, operation, identity, descriptor)
  )
    callbacks.setReturnReceiptUnavailable(true);
}

async function pollReturnedCheckout(
  identity: TableGuestVisitIdentity,
  targetAttemptId: string | null,
  initialCheckout: GuestAccountCheckoutStatus,
  initialDescriptor: GuestAccountPaymentAttemptDescriptor,
  initialReceipt: GuestPaymentReceipt | null,
  initialOperation: GuestAccountPaymentOperation | null,
  callbacks: ActiveRecoveryCallbacks,
): Promise<void> {
  let checkout = initialCheckout;
  let descriptor = initialDescriptor;
  let receipt = initialReceipt;
  let operation = initialOperation;
  for (const delayMs of GUEST_PAYMENT_RETURNED_CHECKOUT_POLL_DELAYS_CONFIG_MS) {
    if (!targetAttemptId || isFinalReturnedCheckout(checkout, receipt, operation, identity, descriptor)) return;
    if (!(await callbacks.waitForNextPoll(delayMs)) || !callbacks.isCurrent()) return;

    const refreshed = await callbacks.runExclusive(
      () => readReturnedCheckout(identity, targetAttemptId, descriptor, operation, callbacks),
      null,
    );

    if (!callbacks.isCurrent()) return;
    if (refreshed === null) continue;
    checkout = refreshed.checkout;
    descriptor = refreshed.descriptor;
    receipt = refreshed.receipt;
    operation = refreshed.operation;
    if (checkout.attemptId !== targetAttemptId) return;
  }
  if (
    targetAttemptId &&
    isTerminalGuestPayment(checkout.state) &&
    !isFinalReturnedCheckout(checkout, receipt, operation, identity, descriptor)
  )
    callbacks.setReturnReceiptUnavailable(true);
}

async function readReturnedCheckout(
  identity: TableGuestVisitIdentity,
  returnAttemptId: string,
  descriptor: GuestAccountPaymentAttemptDescriptor,
  previousOperation: GuestAccountPaymentOperation | null,
  callbacks: ActiveRecoveryCallbacks,
): Promise<ReturnedCheckoutRead | null> {
  try {
    const checkout = callbacks.signal
      ? await guestAccountPaymentService.getCheckoutStatus(identity, descriptor, callbacks.signal)
      : await guestAccountPaymentService.getCheckoutStatus(identity, descriptor);
    if (!callbacks.isCurrent() || callbacks.signal?.aborted) return null;
    const updatedDescriptor =
      checkout.attemptId === descriptor.attemptId ? descriptor : withCheckoutAttempt(descriptor, checkout.attemptId);
    if (updatedDescriptor !== descriptor && !saveUpdated(updatedDescriptor, callbacks)) return null;
    if (checkout.attemptId !== returnAttemptId) {
      callbacks.setReturnReceiptUnavailable(true);
      return { checkout, descriptor: updatedDescriptor, receipt: null, operation: previousOperation };
    }
    const receipt = await fetchRecoveryReceipt(updatedDescriptor, checkout.attemptId, callbacks);
    if (!callbacks.isCurrent() || callbacks.signal?.aborted) return null;
    const operation =
      isTerminalGuestPayment(checkout.state) && !checkout.reconciliationRequired
        ? await confirmReturnedTerminalCheckout(checkout, receipt, identity, updatedDescriptor, callbacks)
        : previousOperation;
    if (!isTerminalGuestPayment(checkout.state) || checkout.reconciliationRequired) callbacks.setCheckout(checkout);
    return { checkout, descriptor: updatedDescriptor, receipt, operation };
  } catch (error) {
    if (callbacks.isCurrent() && !callbacks.signal?.aborted)
      callbacks.setError(guestPaymentErrorMessage(error, 'load'));
    return null;
  }
}

function fetchRecoveryReceipt(
  descriptor: GuestAccountPaymentAttemptDescriptor,
  attemptId: string,
  callbacks: ActiveRecoveryCallbacks,
): Promise<GuestPaymentReceipt | null> {
  if (!descriptor.receiptCredential) return Promise.resolve(null);
  return callbacks.signal
    ? callbacks.fetchReceipt(descriptor, attemptId, callbacks.isCurrent, callbacks.signal, true)
    : callbacks.fetchReceipt(descriptor, attemptId, callbacks.isCurrent, undefined, true);
}

async function confirmReturnedTerminalCheckout(
  checkout: GuestAccountCheckoutStatus,
  receipt: GuestPaymentReceipt | null,
  identity: TableGuestVisitIdentity,
  descriptor: GuestAccountPaymentAttemptDescriptor,
  callbacks: ActiveRecoveryCallbacks,
): Promise<GuestAccountPaymentOperation | null> {
  if (!receipt || !matchesTerminalReceipt(checkout, receipt)) return null;
  let operation: GuestAccountPaymentOperation;
  try {
    operation = callbacks.signal
      ? await guestAccountPaymentService.getOperation(identity, descriptor, callbacks.signal)
      : await guestAccountPaymentService.getOperation(identity, descriptor);
  } catch (_error) {
    if (callbacks.isCurrent() && !callbacks.signal?.aborted) callbacks.setError('load');
    return null;
  }
  if (
    !callbacks.isCurrent() ||
    callbacks.signal?.aborted ||
    !matchesTerminalOperation(operation, checkout, identity, descriptor)
  )
    return null;
  callbacks.publishReceipt(descriptor.operationId, receipt);
  callbacks.setOperation(operation);
  callbacks.setCheckout(checkout);
  callbacks.setReturnReceiptUnavailable(false);
  if (callbacks.onReturnedPaymentSettled) {
    try {
      await callbacks.onReturnedPaymentSettled(identity, callbacks.isCurrent, callbacks.signal);
    } catch (_error) {
      if (callbacks.isCurrent() && !callbacks.signal?.aborted) callbacks.setError('load');
    }
  }
  return callbacks.isCurrent() ? operation : null;
}

function isFinalReturnedCheckout(
  checkout: GuestAccountCheckoutStatus,
  receipt: GuestPaymentReceipt | null,
  operation: GuestAccountPaymentOperation | null,
  identity: TableGuestVisitIdentity,
  descriptor: GuestAccountPaymentAttemptDescriptor,
): boolean {
  if (checkout.state === 'ReconciliationRequired' || checkout.reconciliationRequired) return true;
  return (
    operation !== null &&
    matchesTerminalReceipt(checkout, receipt) &&
    matchesTerminalOperation(operation, checkout, identity, descriptor)
  );
}

function matchesTerminalReceipt(checkout: GuestAccountCheckoutStatus, receipt: GuestPaymentReceipt | null): boolean {
  return (
    receipt !== null &&
    receipt.attemptId.toLowerCase() === checkout.attemptId.toLowerCase() &&
    receipt.amountMinor === checkout.amountMinor &&
    receipt.currency.toUpperCase() === checkout.currency.toUpperCase() &&
    receipt.state === checkout.state &&
    receipt.receivedMinor === checkout.receivedMinor &&
    receipt.refundedMinor === checkout.refundedMinor &&
    receipt.reconciliationRequired === checkout.reconciliationRequired
  );
}

function matchesTerminalOperation(
  operation: GuestAccountPaymentOperation,
  checkout: GuestAccountCheckoutStatus,
  identity: TableGuestVisitIdentity,
  descriptor: GuestAccountPaymentAttemptDescriptor,
): boolean {
  return (
    operation.serviceSessionId === identity.serviceSessionId &&
    operation.operationId === descriptor.operationId &&
    operation.operationId === checkout.operationId &&
    operation.version === checkout.version &&
    operation.state === checkout.state &&
    isTerminalGuestPayment(operation.state)
  );
}

function saveUpdated(descriptor: GuestAccountPaymentAttemptDescriptor, callbacks: ActiveRecoveryCallbacks): boolean {
  const saved = callbacks.saveUpdatedDescriptor(descriptor);
  if (!saved) callbacks.setStorageUnavailable(true);
  return saved;
}

function markActiveRecoveryFailed(
  error: unknown,
  descriptor: GuestAccountPaymentAttemptDescriptor,
  returnAttemptId: string | null,
  callbacks: ActiveRecoveryCallbacks,
): void {
  if (!callbacks.isCurrent() || callbacks.signal?.aborted) return;
  callbacks.setError(guestPaymentErrorMessage(error, 'load'));
  if (returnAttemptId && descriptor.attemptId !== returnAttemptId) {
    callbacks.setReturnReceiptUnavailable(true);
  }
}

export function summarizeDescriptor(descriptor: GuestAccountPaymentAttemptDescriptor): GuestPaymentAttemptSummary {
  return {
    serviceSessionId: descriptor.serviceSessionId,
    operationId: descriptor.operationId,
    mode: descriptor.quote.mode,
    quotedVersion: descriptor.quotedVersion,
    reservedExpectedVersion: descriptor.reservedExpectedVersion,
    hasReceiptCredential: descriptor.receiptCredential !== null,
    unfinishedQuote: isUnfinishedGuestPaymentQuote(descriptor),
    startRequested: descriptor.startRequestedAt !== null,
    attemptId: descriptor.attemptId,
    createdAt: descriptor.createdAt,
  };
}

export function waitForRecoveryPoll(delayMs: number, signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(false);
  return new Promise((resolve) => {
    const finish = (continuePolling: boolean) => {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      resolve(continuePolling);
    };
    const onAbort = () => finish(false);
    const timer = setTimeout(() => finish(true), delayMs);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}
