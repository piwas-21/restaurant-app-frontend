'use client';

import { useCallback } from 'react';
import type { TableGuestVisitIdentity } from '@/types/tableGuestVisit';
import type {
  GuestAccountCheckoutStatus,
  GuestAccountPaymentAttemptDescriptor,
  GuestAccountPaymentOperation,
} from '@/types/guestAccountPayments';
import type { GuestPaymentErrorKey } from '@/lib/guestPaymentError';
import { safeStripeCheckoutUrl } from '@/lib/guestAccountPaymentRules';
import { guestPaymentErrorMessage } from '@/lib/guestPaymentError';
import { fingerprintGuestParticipant } from '@/lib/guestParticipantFingerprint';
import { guestAccountPaymentService } from '@/services/guestAccountPaymentService';
import {
  createReceiptCredential,
  saveGuestAccountPaymentAttempt,
  withCheckoutAttempt,
  withReceiptCredential,
  withReservation,
  withStartRequested,
} from '@/services/guestAccountPaymentStorage';

interface GuestPaymentStartOptions {
  readonly activeIdentity: TableGuestVisitIdentity | null;
  readonly newPaymentsEnabled: boolean;
  readonly canCreatePayment: boolean;
  readonly descriptorRef: { current: GuestAccountPaymentAttemptDescriptor | null };
  readonly runExclusive: <T>(operation: () => Promise<T>, blocked: T) => Promise<T>;
  readonly publishDescriptor: (descriptor: GuestAccountPaymentAttemptDescriptor | null) => void;
  readonly fetchReceipt: (descriptor: GuestAccountPaymentAttemptDescriptor, attemptId: string) => Promise<unknown>;
  readonly setOperation: (operation: GuestAccountPaymentOperation | null) => void;
  readonly setCheckout: (checkout: GuestAccountCheckoutStatus | null) => void;
  readonly setError: (error: GuestPaymentErrorKey) => void;
  readonly setStorageUnavailable: (unavailable: boolean) => void;
  readonly refreshAccount: () => Promise<unknown>;
  readonly onAccountUpdated: () => void;
}

export function useGuestPaymentStartAction(options: GuestPaymentStartOptions) {
  const startOrResumeCheckout = useCallback(async () => {
    const descriptor = options.descriptorRef.current;
    const identity = options.activeIdentity;
    if (
      !descriptor ||
      !identity ||
      descriptor.serviceSessionId !== identity.serviceSessionId ||
      !descriptor.contribution ||
      !descriptor.participantFingerprint ||
      descriptor.participantFingerprint !== (await fingerprintGuestParticipant(identity.participantToken))
    )
      return false;
    const replay = descriptor.startRequestedAt !== null;
    if (!replay && (!options.newPaymentsEnabled || !options.canCreatePayment)) return false;
    return options.runExclusive(async () => {
      options.setError('');
      try {
        const result = await startOrResume(descriptor, identity, replay, options);
        if (result.openUrl) {
          const { navigateExternal } = await import('@/lib/navigateExternal');
          navigateExternal(result.openUrl);
        }
        if (options.newPaymentsEnabled) {
          await options.refreshAccount();
          options.onAccountUpdated();
        }
        return result.success;
      } catch (error) {
        options.setError(guestPaymentErrorMessage(error, 'action'));
        return false;
      }
    }, false);
  }, [options]);

  return { startOrResumeCheckout };
}

async function startOrResume(
  descriptor: GuestAccountPaymentAttemptDescriptor,
  identity: TableGuestVisitIdentity,
  replay: boolean,
  context: GuestPaymentStartOptions,
): Promise<{ readonly success: boolean; readonly openUrl: string | null }> {
  if (replay) {
    try {
      const status = await guestAccountPaymentService.getCheckoutStatus(identity, descriptor);
      context.setCheckout(status);
      if (descriptor.receiptCredential) await context.fetchReceipt(descriptor, status.attemptId);
      return { success: true, openUrl: safeStripeCheckoutUrl(status.checkoutUrl) };
    } catch (_error) {
      // A status-read failure permits only the identical idempotent POST below.
    }
    return postOriginalStart(descriptor, identity, context);
  }
  if (!context.newPaymentsEnabled || !context.canCreatePayment) return { success: false, openUrl: null };
  let operation = await guestAccountPaymentService.getOperation(identity, descriptor);
  context.setOperation(operation);

  let ready = descriptor;
  if (operation.state === 'Quoted') {
    ready = await persistReceiptCapability(ready, context);
    operation = await reserveQuotedOperation(operation, identity, ready);
    context.setOperation(operation);
  }
  if (operation.state !== 'Reserved') return { success: false, openUrl: null };

  ready = await persistReceiptCapability(ready, context);
  ready = await persistReservedVersion(ready, operation, context);
  return postOriginalStart(ready, identity, context);
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

async function persistReceiptCapability(
  descriptor: GuestAccountPaymentAttemptDescriptor,
  context: GuestPaymentStartOptions,
): Promise<GuestAccountPaymentAttemptDescriptor> {
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

async function persistReservedVersion(
  descriptor: GuestAccountPaymentAttemptDescriptor,
  operation: GuestAccountPaymentOperation,
  context: GuestPaymentStartOptions,
): Promise<GuestAccountPaymentAttemptDescriptor> {
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
): Promise<{ readonly success: boolean; readonly openUrl: string | null }> {
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
  const result = await guestAccountPaymentService.startCheckout(
    identity,
    marked,
    reservedExpectedVersion,
    receiptCredential,
  );
  const next = withCheckoutAttempt(marked, result.attemptId);
  const nextSaved = saveGuestAccountPaymentAttempt(next);
  if (nextSaved) {
    context.publishDescriptor(next);
  } else {
    context.setStorageUnavailable(true);
  }
  context.setCheckout(result);
  if (result.state === 'Captured') await context.fetchReceipt(nextSaved ? next : marked, result.attemptId);
  return { success: true, openUrl: safeStripeCheckoutUrl(result.checkoutUrl) };
}
