import type { GuestAccountPaymentAccount } from '@/types/guestAccountPayments';
import {
  isGuestPaymentCurrency,
  isGuestPaymentDate,
  isGuestPaymentId,
  isGuestPaymentNonnegative,
  isGuestPaymentPositive,
  isGuestPaymentRecord,
  isGuestPaymentState,
  sameGuestPaymentCurrency,
  sameGuestPaymentId,
  totalValidAllocations,
  validGuestPaymentAllocations,
} from './guestAccountPaymentResponsePrimitives';

export function validateAccountResponse(value: unknown, sessionId: string): GuestAccountPaymentAccount {
  if (!isGuestPaymentRecord(value) || !sameGuestPaymentId(value.serviceSessionId, sessionId) || !isAccountShape(value))
    return mismatch();
  return value as unknown as GuestAccountPaymentAccount;
}

function isAccountShape(value: Record<string, unknown>): boolean {
  if (
    !['Open', 'Closed'].includes(String(value.status)) ||
    !isGuestPaymentPositive(value.accountRevision) ||
    !isGuestPaymentCurrency(value.currency) ||
    !isGuestPaymentNonnegative(value.outstandingMinor) ||
    !isGuestPaymentNonnegative(value.reservedMinor) ||
    !isGuestPaymentNonnegative(value.availableMinor) ||
    !isGuestPaymentNonnegative(value.capturedAccountPaymentMinor) ||
    !validGuestPaymentAllocations(value.outstandingAllocations, true) ||
    !validGuestPaymentAllocations(value.availableAllocations, true) ||
    totalValidAllocations(value.outstandingAllocations) !== value.outstandingMinor ||
    totalValidAllocations(value.availableAllocations) !== value.availableMinor ||
    !isGuestPaymentRecord(value.limits) ||
    !isGuestPaymentPositive(value.limits.maximumSelectedUnits) ||
    !isGuestPaymentPositive(value.limits.maximumEqualShares) ||
    !Array.isArray(value.activeAttempts) ||
    !value.activeAttempts.every(isAccountAttemptSummary)
  )
    return false;
  if (value.limits.online !== null) {
    const limits = value.limits.online;
    if (
      !isGuestPaymentRecord(limits) ||
      !sameGuestPaymentCurrency(String(limits.currency), String(value.currency)) ||
      !isGuestPaymentPositive(limits.minimumAmountMinor) ||
      !isGuestPaymentPositive(limits.maximumAmountMinor) ||
      limits.minimumAmountMinor > limits.maximumAmountMinor
    )
      return false;
  }
  return isValidEqualShareSummary(value.activeEqualSharePlan, value.currency);
}

function isAccountAttemptSummary(value: unknown): boolean {
  return (
    isGuestPaymentRecord(value) &&
    (value.operationId === null || isGuestPaymentId(value.operationId)) &&
    isGuestPaymentState(value.state) &&
    isGuestPaymentPositive(value.version) &&
    ['Cash', 'CreditCard', 'OnlinePayment'].includes(String(value.paymentMethod)) &&
    isGuestPaymentPositive(value.amountMinor) &&
    isGuestPaymentCurrency(value.currency) &&
    (value.reservationExpiresAt === null || isGuestPaymentDate(value.reservationExpiresAt)) &&
    (value.equalSharePlanId === null || isGuestPaymentId(value.equalSharePlanId)) &&
    (value.equalShareOrdinal === null || isGuestPaymentPositive(value.equalShareOrdinal)) &&
    typeof value.isOwnOperation === 'boolean'
  );
}

function isValidEqualShareSummary(value: unknown, currency: unknown): boolean {
  if (value === null) return true;
  if (
    !isGuestPaymentRecord(value) ||
    !isGuestPaymentId(value.planId) ||
    !isGuestPaymentPositive(value.accountRevision) ||
    !isGuestPaymentPositive(value.totalMinor) ||
    !isGuestPaymentCurrency(value.currency) ||
    !sameGuestPaymentCurrency(value.currency, String(currency)) ||
    typeof value.isOwnPlan !== 'boolean' ||
    !Array.isArray(value.slots) ||
    value.slots.length < 2 ||
    !validGuestPaymentAllocations(value.scope) ||
    totalValidAllocations(value.scope) !== value.totalMinor
  )
    return false;
  return value.slots.every(
    (slot, index) =>
      isGuestPaymentRecord(slot) &&
      slot.ordinal === index + 1 &&
      isGuestPaymentPositive(slot.amountMinor) &&
      typeof slot.isAvailable === 'boolean' &&
      (slot.claimState === null || isGuestPaymentState(slot.claimState)),
  );
}

function mismatch(): never {
  throw new Error('The table account response does not match the requested visit.');
}
