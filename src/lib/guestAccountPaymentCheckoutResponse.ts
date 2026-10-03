import type {
  GuestAccountCheckoutStatus,
  GuestAccountPaymentAttemptDescriptor,
  GuestPaymentReceipt,
} from '@/types/guestAccountPayments';
import {
  isGuestPaymentDate,
  isGuestPaymentId,
  isGuestPaymentNonnegative,
  isGuestPaymentOptionalDate,
  isGuestPaymentPositive,
  isGuestPaymentRecord,
  isGuestPaymentState,
  sameGuestPaymentCurrency,
  sameGuestPaymentId,
} from './guestAccountPaymentResponsePrimitives';

export function validateCheckoutResponse(
  value: unknown,
  descriptor: GuestAccountPaymentAttemptDescriptor,
): GuestAccountCheckoutStatus {
  if (!isGuestPaymentRecord(value)) return mismatch();
  const checkout = value as unknown as GuestAccountCheckoutStatus;
  if (
    !isGuestPaymentId(checkout.attemptId) ||
    (descriptor.attemptId !== null && !sameGuestPaymentId(checkout.attemptId, descriptor.attemptId)) ||
    !sameGuestPaymentId(checkout.operationId, descriptor.operationId) ||
    !isGuestPaymentState(checkout.state) ||
    checkout.state === 'Quoted' ||
    checkout.state === 'Reserved' ||
    !isGuestPaymentPositive(checkout.version) ||
    !matchesFrozenMoney(checkout.amountMinor, checkout.currency, descriptor) ||
    !isGuestPaymentDate(checkout.expiresAt) ||
    typeof checkout.reconciliationRequired !== 'boolean' ||
    !isGuestPaymentNonnegative(checkout.receivedMinor) ||
    !isGuestPaymentNonnegative(checkout.refundedMinor) ||
    checkout.receivedMinor > checkout.amountMinor ||
    checkout.refundedMinor > checkout.receivedMinor ||
    !hasConsistentTerminalFinancialEvidence(
      checkout.state,
      checkout.receivedMinor,
      checkout.amountMinor,
      checkout.reconciliationRequired,
    ) ||
    (checkout.checkoutUrl !== null && typeof checkout.checkoutUrl !== 'string')
  )
    return mismatch();
  return checkout;
}

export function validateReceiptResponse(
  value: unknown,
  attemptId: string,
  descriptor: GuestAccountPaymentAttemptDescriptor,
): GuestPaymentReceipt {
  if (!isGuestPaymentRecord(value) || !isGuestPaymentId(attemptId)) return mismatch();
  const receipt = value as unknown as GuestPaymentReceipt;
  if (
    !sameGuestPaymentId(receipt.attemptId, attemptId) ||
    (descriptor.attemptId !== null && !sameGuestPaymentId(receipt.attemptId, descriptor.attemptId)) ||
    !matchesFrozenMoney(receipt.amountMinor, receipt.currency, descriptor) ||
    !isGuestPaymentState(receipt.state) ||
    receipt.state === 'Quoted' ||
    receipt.state === 'Reserved' ||
    !isGuestPaymentNonnegative(receipt.receivedMinor) ||
    !isGuestPaymentNonnegative(receipt.refundedMinor) ||
    receipt.receivedMinor > receipt.amountMinor ||
    receipt.refundedMinor > receipt.receivedMinor ||
    typeof receipt.reconciliationRequired !== 'boolean' ||
    !hasConsistentTerminalFinancialEvidence(
      receipt.state,
      receipt.receivedMinor,
      receipt.amountMinor,
      receipt.reconciliationRequired,
    ) ||
    !isGuestPaymentOptionalDate(receipt.completedAt) ||
    (receipt.receiptExpiresAt !== undefined && !isGuestPaymentOptionalDate(receipt.receiptExpiresAt))
  )
    return mismatch();
  return receipt;
}

function hasConsistentTerminalFinancialEvidence(
  state: GuestAccountCheckoutStatus['state'],
  receivedMinor: number,
  amountMinor: number,
  reconciliationRequired: boolean,
): boolean {
  if (reconciliationRequired) return true;
  if (state === 'Captured') return receivedMinor === amountMinor;
  if (state === 'Released' || state === 'Failed') return receivedMinor === 0;
  return true;
}

function matchesFrozenMoney(
  amount: number,
  currency: string,
  descriptor: GuestAccountPaymentAttemptDescriptor,
): boolean {
  return (
    isGuestPaymentPositive(amount) &&
    /^[A-Z]{3}$/.test(currency) &&
    !!descriptor.contribution &&
    descriptor.contribution.amountMinor === amount &&
    sameGuestPaymentCurrency(descriptor.contribution.currency, currency)
  );
}

function mismatch(): never {
  throw new Error('The saved guest checkout does not match the original reviewed contribution.');
}
