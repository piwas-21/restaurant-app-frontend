'use client';

import { useCallback } from 'react';
import type { TableGuestVisitIdentity } from '@/types/tableGuestVisit';
import type { GuestAccountPaymentAttemptDescriptor } from '@/types/guestAccountPayments';
import { guestPaymentErrorMessage } from '@/lib/guestPaymentError';
import { fingerprintGuestParticipant } from '@/lib/guestParticipantFingerprint';
import type { GuestPaymentRecoveryTarget } from './guestPaymentRecoveryHelpers';
import {
  startOrResume,
  type GuestPaymentStartOptions,
  type StartCheckoutOutcome,
} from './guestPaymentStartActionHelpers';

export function useGuestPaymentStartAction(options: GuestPaymentStartOptions) {
  const startOrResumeCheckout = useCallback(async () => {
    const descriptor = options.descriptorRef.current;
    const identity = options.activeIdentity;
    if (!descriptor || !identity || !canStartForIdentity(descriptor, options)) return false;

    const participantFingerprint = await fingerprintGuestParticipant(identity.participantToken);
    if (!options.isCurrentIdentity(identity) || descriptor.participantFingerprint !== participantFingerprint)
      return false;

    const outcome = await runStart(descriptor, identity, options);
    if (!options.isCurrentIdentity(identity) || !outcome.success) return false;
    if (outcome.recover) {
      await options.recoverSavedPayment(recoveryTarget(descriptor, outcome));
      if (!options.isCurrentIdentity(identity)) return false;
    } else if (options.newPaymentsEnabled) {
      await options.refreshAccount();
      if (!options.isCurrentIdentity(identity)) return false;
      options.onAccountUpdated();
    }

    if (outcome.openUrl) {
      const { navigateExternal } = await import('@/lib/navigateExternal');
      if (!options.isCurrentIdentity(identity)) return false;
      navigateExternal(outcome.openUrl);
    }
    return true;
  }, [options]);

  return { startOrResumeCheckout };
}

function canStartForIdentity(
  descriptor: GuestAccountPaymentAttemptDescriptor | null,
  options: GuestPaymentStartOptions,
): descriptor is GuestAccountPaymentAttemptDescriptor {
  return Boolean(
    descriptor &&
    !options.isRecoveryPolling &&
    options.activeIdentity &&
    options.isCurrentIdentity(options.activeIdentity) &&
    descriptor.serviceSessionId === options.activeIdentity.serviceSessionId &&
    descriptor.contribution &&
    descriptor.participantFingerprint &&
    (descriptor.startRequestedAt !== null || (options.newPaymentsEnabled && options.canCreatePayment)),
  );
}

async function runStart(
  descriptor: GuestAccountPaymentAttemptDescriptor,
  identity: TableGuestVisitIdentity,
  options: GuestPaymentStartOptions,
): Promise<StartCheckoutOutcome> {
  return options.runExclusive(
    async () => {
      if (!options.isCurrentIdentity(identity))
        return { success: false, openUrl: null, recover: false, attemptId: null };
      options.setError('');
      try {
        return await startOrResume(descriptor, identity, descriptor.startRequestedAt !== null, options);
      } catch (error) {
        if (options.isCurrentIdentity(identity)) options.setError(guestPaymentErrorMessage(error, 'action'));
        return { success: false, openUrl: null, recover: false, attemptId: null };
      }
    },
    { success: false, openUrl: null, recover: false, attemptId: null },
  );
}

function recoveryTarget(
  descriptor: GuestAccountPaymentAttemptDescriptor,
  outcome: StartCheckoutOutcome,
): GuestPaymentRecoveryTarget {
  return { attemptId: outcome.attemptId, operationId: descriptor.operationId, poll: true };
}
