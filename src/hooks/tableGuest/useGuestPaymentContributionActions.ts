'use client';

import { useCallback } from 'react';
import type { TableGuestVisitIdentity } from '@/types/tableGuestVisit';
import type {
  GuestAccountPaymentAttemptDescriptor,
  GuestAccountPaymentAccount,
  GuestAccountPaymentQuoteDescriptor,
} from '@/types/guestAccountPayments';
import type { GuestPaymentErrorKey } from '@/lib/guestPaymentError';
import { guestPaymentErrorMessage } from '@/lib/guestPaymentError';
import { createPaymentOperationId } from '@/lib/guestAccountPaymentRules';
import { expectedGuestPaymentAllocations } from '@/lib/guestAccountPaymentScope';
import { totalGuestPaymentAllocations } from '@/lib/guestAccountPaymentAllocationMath';
import { fingerprintGuestParticipant } from '@/lib/guestParticipantFingerprint';
import { guestAccountPaymentService } from '@/services/guestAccountPaymentService';
import {
  createGuestAccountPaymentDescriptor,
  saveGuestAccountPaymentAttempt,
  withQuotedOperation,
} from '@/services/guestAccountPaymentStorage';
import { useGuestPaymentQuoteRecoveryAction } from './useGuestPaymentQuoteRecoveryAction';

interface ContributionActionOptions {
  readonly activeIdentity: TableGuestVisitIdentity | null;
  readonly newPaymentsEnabled: boolean;
  readonly canCreatePayment: boolean;
  readonly isRecoveryLoading: boolean;
  readonly account: GuestAccountPaymentAccount | null;
  readonly canReplaceAttempt: boolean;
  readonly descriptorRef: { current: GuestAccountPaymentAttemptDescriptor | null };
  readonly runExclusive: <T>(operation: () => Promise<T>, blocked: T) => Promise<T>;
  readonly refreshAccount: () => Promise<GuestAccountPaymentAccount | null>;
  readonly publishDescriptor: (descriptor: GuestAccountPaymentAttemptDescriptor | null) => void;
  readonly setOperation: (
    operation: import('@/types/guestAccountPayments').GuestAccountPaymentOperation | null,
  ) => void;
  readonly setError: (error: GuestPaymentErrorKey) => void;
  readonly setStorageUnavailable: (unavailable: boolean) => void;
}

export type GuestPaymentQuoteChoice = Omit<GuestAccountPaymentQuoteDescriptor, 'expectedAccountRevision'>;

export function useGuestPaymentContributionActions(options: ContributionActionOptions) {
  const {
    activeIdentity,
    newPaymentsEnabled,
    canCreatePayment,
    account,
    canReplaceAttempt,
    descriptorRef,
    runExclusive,
    refreshAccount,
    publishDescriptor,
    setOperation,
    setError,
    setStorageUnavailable,
  } = options;
  const quoteRecovery = useGuestPaymentQuoteRecoveryAction(options);

  const reviewContribution = useCallback(
    async (quote: GuestPaymentQuoteChoice) => {
      if (
        !newPaymentsEnabled ||
        !canCreatePayment ||
        !activeIdentity ||
        (descriptorRef.current !== null && !canReplaceAttempt)
      )
        return false;
      return runExclusive(async () => {
        setError('');
        let descriptor: GuestAccountPaymentAttemptDescriptor | null = null;
        try {
          const operationId = createPaymentOperationId();
          const currentAccount = account ?? (await refreshAccount());
          if (!operationId || !currentAccount || !isEligibleQuote(quote, currentAccount))
            throw new Error('unavailable');
          const participantFingerprint = await fingerprintGuestParticipant(activeIdentity.participantToken);
          if (!participantFingerprint) throw new Error('identity');
          descriptor = createGuestAccountPaymentDescriptor(
            activeIdentity.serviceSessionId,
            operationId,
            {
              ...quote,
              expectedAccountRevision: currentAccount.accountRevision,
            },
            participantFingerprint,
          );
          if (!saveGuestAccountPaymentAttempt(descriptor)) {
            setStorageUnavailable(true);
            throw new Error('storage');
          }
          publishDescriptor(descriptor);
          const result = await guestAccountPaymentService.createQuote(
            activeIdentity,
            { operationId, ...descriptor.quote },
            descriptor,
            currentAccount,
          );
          const next = withQuotedOperation(descriptor, result.operation.version, result.contribution);
          if (!saveGuestAccountPaymentAttempt(next)) {
            setStorageUnavailable(true);
            setOperation(result.operation);
            throw new Error('storage');
          }
          publishDescriptor(next);
          setOperation(result.operation);
          return true;
        } catch (error) {
          setError(guestPaymentErrorMessage(error, 'action'));
          return false;
        }
      }, false);
    },
    [
      account,
      activeIdentity,
      canCreatePayment,
      canReplaceAttempt,
      descriptorRef,
      newPaymentsEnabled,
      publishDescriptor,
      refreshAccount,
      runExclusive,
      setError,
      setOperation,
      setStorageUnavailable,
    ],
  );

  return { reviewContribution, ...quoteRecovery };
}

function isEligibleQuote(
  quote: Omit<GuestAccountPaymentQuoteDescriptor, 'expectedAccountRevision'>,
  account: GuestAccountPaymentAccount,
): boolean {
  const limits = account.limits.online;
  if (!limits || limits.currency.toUpperCase() !== account.currency.toUpperCase()) return false;
  const scope = expectedGuestPaymentAllocations(account, {
    ...quote,
    expectedAccountRevision: account.accountRevision,
  });
  const amount = scope && totalGuestPaymentAllocations(scope);
  return (
    amount !== null &&
    amount >= limits.minimumAmountMinor &&
    amount <= limits.maximumAmountMinor &&
    amount <= account.availableMinor
  );
}
