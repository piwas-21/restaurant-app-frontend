import type { TableGuestVisitIdentity } from '@/types/tableGuestVisit';
import type { GuestAccountPaymentAttemptDescriptor, GuestPaymentReceipt } from '@/types/guestAccountPayments';
import { fingerprintGuestParticipant } from '@/lib/guestParticipantFingerprint';
import { recoverReceiptOnly, selectReceiptRecoveryAttempt, selectRecoveryAttempt } from './guestPaymentRecoveryHelpers';

export async function chooseGuestPaymentRecovery(
  attempts: readonly GuestAccountPaymentAttemptDescriptor[],
  returnAttemptId: string | null,
  activeIdentity: TableGuestVisitIdentity | null,
  recoveryIdentity: TableGuestVisitIdentity | null,
): Promise<{
  readonly selected: GuestAccountPaymentAttemptDescriptor | null;
  readonly receiptDescriptor: GuestAccountPaymentAttemptDescriptor | null;
}> {
  const serviceSessionId = activeIdentity?.serviceSessionId ?? recoveryIdentity?.serviceSessionId;
  const [activeFingerprint, recoveryFingerprint] = await Promise.all([
    activeIdentity ? fingerprintGuestParticipant(activeIdentity.participantToken) : Promise.resolve(null),
    recoveryIdentity ? fingerprintGuestParticipant(recoveryIdentity.participantToken) : Promise.resolve(null),
  ]);
  const receiptDescriptor = returnAttemptId
    ? selectReceiptRecoveryAttempt(attempts, returnAttemptId, serviceSessionId, [
        activeFingerprint,
        recoveryFingerprint,
      ])
    : null;
  const selected = selectRecoveryAttempt(
    attempts,
    returnAttemptId,
    serviceSessionId,
    activeIdentity ? activeFingerprint : recoveryFingerprint,
  );
  return { selected, receiptDescriptor };
}

export async function recoverReturnedReceipt(
  returnAttemptId: string | null,
  receiptDescriptor: GuestAccountPaymentAttemptDescriptor | null,
  selected: GuestAccountPaymentAttemptDescriptor | null,
  fetchReceipt: (
    descriptor: GuestAccountPaymentAttemptDescriptor,
    attemptId: string,
  ) => Promise<GuestPaymentReceipt | null>,
  setUnavailable: (value: boolean) => void,
): Promise<void> {
  if (!returnAttemptId) return;
  if (receiptDescriptor && selected !== receiptDescriptor) {
    await recoverReceiptOnly(receiptDescriptor, returnAttemptId, fetchReceipt, setUnavailable);
  } else if (!selected) {
    setUnavailable(true);
  }
}
