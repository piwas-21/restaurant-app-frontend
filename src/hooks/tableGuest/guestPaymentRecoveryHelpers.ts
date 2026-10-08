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

const RETURNED_CHECKOUT_POLL_DELAYS_MS = [2_000, 4_000, 8_000, 16_000, 20_000, 25_000, 30_000] as const;

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
  ) => Promise<GuestPaymentReceipt | null>,
  setReturnReceiptUnavailable: (value: boolean) => void,
): Promise<void> {
  const attemptId = returnAttemptId ?? descriptor.attemptId;
  const canReportReceiptAvailability = Boolean(returnAttemptId || attemptId);
  if (
    !attemptId ||
    !descriptor.receiptCredential ||
    !descriptor.contribution ||
    (returnAttemptId !== null && descriptor.attemptId !== null && descriptor.attemptId !== returnAttemptId)
  ) {
    setReturnReceiptUnavailable(canReportReceiptAvailability);
    return;
  }
  let receiptAvailable = false;
  try {
    const receipt = await fetchReceipt(descriptor, attemptId);
    receiptAvailable = receipt !== null;
  } catch (_error) {
    // Receipt capabilities collapse provider/auth details to the same unavailable status.
  }
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

interface ActiveRecoveryCallbacks {
  readonly isCurrent: () => boolean;
  readonly setOperation: (operation: GuestAccountPaymentOperation) => void;
  readonly setCheckout: (checkout: GuestAccountCheckoutStatus) => void;
  readonly setError: (error: GuestPaymentErrorKey) => void;
  readonly setReturnReceiptUnavailable: (value: boolean) => void;
  readonly setIsLoading: (value: boolean) => void;
  readonly fetchReceipt: (
    descriptor: GuestAccountPaymentAttemptDescriptor,
    attemptId: string,
    isCurrent?: () => boolean,
  ) => Promise<GuestPaymentReceipt | null>;
  readonly saveUpdatedDescriptor: (descriptor: GuestAccountPaymentAttemptDescriptor) => boolean;
  readonly setStorageUnavailable: (value: boolean) => void;
  readonly runExclusive: <T>(operation: () => Promise<T>, blocked: T) => Promise<T>;
  readonly waitForNextPoll: (delayMs: number) => Promise<boolean>;
}

export async function recoverActivePayment(
  descriptor: GuestAccountPaymentAttemptDescriptor,
  identity: TableGuestVisitIdentity,
  returnAttemptId: string | null,
  callbacks: ActiveRecoveryCallbacks,
): Promise<void> {
  try {
    const operation = await guestAccountPaymentService.getOperation(identity, descriptor);
    if (!callbacks.isCurrent()) return;
    if (!descriptor.contribution) {
      if (operation.state !== 'Quoted' || descriptor.startRequestedAt !== null) throw new Error('unsafe-recovery');
      const contribution = await createGuestPaymentContribution(operation);
      const next = withQuotedOperation(descriptor, operation.version, contribution);
      if (!saveUpdated(next, callbacks)) return;
      descriptor = next;
    }
    callbacks.setOperation(operation);
    if (requiresCheckoutLookup(descriptor)) {
      await recoverStartedPayment(descriptor, identity, returnAttemptId, callbacks);
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
  callbacks: ActiveRecoveryCallbacks,
): Promise<void> {
  const checkout = await guestAccountPaymentService.getCheckoutStatus(identity, descriptor);
  if (!callbacks.isCurrent()) return;
  const next =
    checkout.attemptId === descriptor.attemptId ? descriptor : withCheckoutAttempt(descriptor, checkout.attemptId);
  if (next !== descriptor && !saveUpdated(next, callbacks)) return;
  if (returnAttemptId && checkout.attemptId !== returnAttemptId) {
    callbacks.setReturnReceiptUnavailable(true);
    return;
  }
  const receipt = next.receiptCredential
    ? await callbacks.fetchReceipt(next, checkout.attemptId, callbacks.isCurrent)
    : null;
  if (!callbacks.isCurrent()) return;
  if (canPublishCheckout(checkout, receipt, Boolean(returnAttemptId))) callbacks.setCheckout(checkout);
  callbacks.setIsLoading(false);

  await pollReturnedCheckout(identity, returnAttemptId, checkout, next, receipt, callbacks);
}

async function pollReturnedCheckout(
  identity: TableGuestVisitIdentity,
  returnAttemptId: string | null,
  initialCheckout: GuestAccountCheckoutStatus,
  initialDescriptor: GuestAccountPaymentAttemptDescriptor,
  initialReceipt: GuestPaymentReceipt | null,
  callbacks: ActiveRecoveryCallbacks,
): Promise<void> {
  let checkout = initialCheckout;
  let descriptor = initialDescriptor;
  let receipt = initialReceipt;
  for (const delayMs of RETURNED_CHECKOUT_POLL_DELAYS_MS) {
    if (!returnAttemptId || isFinalReturnedCheckout(checkout, receipt)) return;
    if (!(await callbacks.waitForNextPoll(delayMs)) || !callbacks.isCurrent()) return;

    const refreshed = await callbacks.runExclusive(async () => {
      const currentCheckout = await guestAccountPaymentService.getCheckoutStatus(identity, descriptor);
      if (!callbacks.isCurrent()) return null;
      const currentDescriptor =
        currentCheckout.attemptId === descriptor.attemptId
          ? descriptor
          : withCheckoutAttempt(descriptor, currentCheckout.attemptId);
      if (currentDescriptor !== descriptor && !saveUpdated(currentDescriptor, callbacks)) return null;
      if (currentCheckout.attemptId !== returnAttemptId) {
        callbacks.setReturnReceiptUnavailable(true);
        return { checkout: currentCheckout, descriptor: currentDescriptor, receipt: null };
      }
      const currentReceipt = currentDescriptor.receiptCredential
        ? await callbacks.fetchReceipt(currentDescriptor, currentCheckout.attemptId, callbacks.isCurrent)
        : null;
      if (!callbacks.isCurrent()) return null;
      if (canPublishCheckout(currentCheckout, currentReceipt, true)) callbacks.setCheckout(currentCheckout);
      return { checkout: currentCheckout, descriptor: currentDescriptor, receipt: currentReceipt };
    }, null);

    if (!callbacks.isCurrent()) return;
    if (refreshed === null) continue;
    checkout = refreshed.checkout;
    descriptor = refreshed.descriptor;
    receipt = refreshed.receipt;
    if (checkout.attemptId !== returnAttemptId) return;
  }
  if (isTerminalGuestPayment(checkout.state) && !isFinalReturnedCheckout(checkout, receipt))
    callbacks.setReturnReceiptUnavailable(true);
}

function canPublishCheckout(
  checkout: GuestAccountCheckoutStatus,
  receipt: GuestPaymentReceipt | null,
  isReturnedAttempt: boolean,
): boolean {
  return !isReturnedAttempt || !isTerminalGuestPayment(checkout.state) || isFinalReturnedCheckout(checkout, receipt);
}

function isFinalReturnedCheckout(checkout: GuestAccountCheckoutStatus, receipt: GuestPaymentReceipt | null): boolean {
  if (checkout.state === 'ReconciliationRequired' || checkout.reconciliationRequired) return true;
  if (!isTerminalGuestPayment(checkout.state)) return false;
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
  if (callbacks.isCurrent()) callbacks.setError(guestPaymentErrorMessage(error, 'load'));
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
