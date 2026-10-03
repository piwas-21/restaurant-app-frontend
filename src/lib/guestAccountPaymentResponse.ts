import type { AccountPaymentAllocation, AccountPaymentState } from '@/types/accountPayments';
import type {
  GuestAccountPaymentAccount,
  GuestAccountPaymentAttemptDescriptor,
  GuestAccountPaymentOperation,
  GuestAccountPaymentQuoteDescriptor,
} from '@/types/guestAccountPayments';
import { guestPaymentSnapshotFingerprint } from './guestAccountPaymentFingerprint';
import { sameGuestPaymentAllocations } from './guestAccountPaymentAllocationMath';
import { expectedGuestPaymentAllocations } from './guestAccountPaymentScope';
import { compareOrdinalStrings } from './compareOrdinalStrings';
import {
  isGuestPaymentCurrency,
  isGuestPaymentDate,
  isGuestPaymentOptionalDate,
  isGuestPaymentPositive,
  isGuestPaymentRecord,
  isGuestPaymentState,
  sameGuestPaymentCurrency,
  sameGuestPaymentId,
  totalValidAllocations,
  validGuestPaymentAllocations,
} from './guestAccountPaymentResponsePrimitives';

export { validateAccountResponse } from './guestAccountPaymentAccountResponse';
export { validateCheckoutResponse, validateReceiptResponse } from './guestAccountPaymentCheckoutResponse';

const STATES: readonly AccountPaymentState[] = [
  'Quoted',
  'Reserved',
  'Starting',
  'Processing',
  'Captured',
  'CancelRequested',
  'Released',
  'Failed',
  'ReconciliationRequired',
];

export async function validatePaymentOperation(
  value: unknown,
  descriptor: GuestAccountPaymentAttemptDescriptor,
  states: readonly AccountPaymentState[] = STATES,
  expectedAccount?: GuestAccountPaymentAccount,
): Promise<GuestAccountPaymentOperation> {
  if (!isGuestPaymentRecord(value)) return mismatch();
  const operation = value as unknown as GuestAccountPaymentOperation;
  const currency = descriptor.contribution?.currency ?? expectedAccount?.currency;
  if (
    !sameGuestPaymentId(operation.serviceSessionId, descriptor.serviceSessionId) ||
    !sameGuestPaymentId(operation.operationId, descriptor.operationId) ||
    !isGuestPaymentState(operation.state) ||
    !states.includes(operation.state) ||
    !isGuestPaymentPositive(operation.version) ||
    operation.expectedAccountRevision !== descriptor.quote.expectedAccountRevision ||
    operation.mode !== descriptor.quote.mode ||
    operation.paymentMethod !== 'OnlinePayment' ||
    !isGuestPaymentPositive(operation.amountMinor) ||
    !isGuestPaymentCurrency(operation.currency) ||
    (currency !== undefined && !sameGuestPaymentCurrency(operation.currency, currency)) ||
    !isGuestPaymentDate(operation.quoteExpiresAt) ||
    !sameNullableId(operation.equalSharePlanId, descriptor.quote.equalSharePlanId ?? null) ||
    operation.equalShareOrdinal !== (descriptor.quote.equalShareOrdinal ?? null) ||
    !isGuestPaymentOptionalDate(operation.reservedAt) ||
    !isGuestPaymentOptionalDate(operation.reservationExpiresAt) ||
    (operation.state === 'Reserved' && (!operation.reservedAt || !operation.reservationExpiresAt)) ||
    !validGuestPaymentAllocations(operation.allocations) ||
    totalValidAllocations(operation.allocations) !== operation.amountMinor ||
    !matchesRequestedScope(operation.allocations, descriptor.quote)
  )
    return mismatch();
  if (expectedAccount) {
    const expected = expectedGuestPaymentAllocations(expectedAccount, descriptor.quote);
    if (!expected || !sameGuestPaymentAllocations(expected, operation.allocations)) return mismatch();
  }
  const fingerprint = await guestPaymentSnapshotFingerprint(operation);
  if (!fingerprint || (descriptor.contribution && fingerprint !== descriptor.contribution.snapshotFingerprint))
    return mismatch();
  if (
    descriptor.contribution &&
    (descriptor.contribution.amountMinor !== operation.amountMinor ||
      !sameGuestPaymentCurrency(descriptor.contribution.currency, operation.currency))
  )
    return mismatch();
  return operation;
}

export async function createGuestPaymentContribution(
  operation: GuestAccountPaymentOperation,
): Promise<NonNullable<GuestAccountPaymentAttemptDescriptor['contribution']>> {
  const snapshotFingerprint = await guestPaymentSnapshotFingerprint(operation);
  if (!snapshotFingerprint) return mismatch();
  return { amountMinor: operation.amountMinor, currency: operation.currency, snapshotFingerprint };
}

function matchesRequestedScope(
  allocations: readonly AccountPaymentAllocation[],
  quote: GuestAccountPaymentQuoteDescriptor,
): boolean {
  if (quote.mode === 'Amount') return totalValidAllocations(allocations) === quote.amountMinor;
  if (quote.mode !== 'Items') return true;
  const expected =
    quote.selectedUnits?.map(
      (unit) => `${unit.orderId.toLowerCase()}:${unit.orderItemId.toLowerCase()}:${unit.ordinal}`,
    ) ?? [];
  if (expected.length === 0) return false;
  const received: string[] = [];
  for (const allocation of allocations) {
    if (!allocation.orderItemId) return false;
    // Reject an oversized range before expanding it. The quote's selected unit list is bounded,
    // so this also bounds work on a malformed but otherwise numerically safe server response.
    if (allocation.unitCount > expected.length - received.length) return false;
    for (let index = 0; index < allocation.unitCount; index += 1) {
      received.push(
        `${allocation.orderId.toLowerCase()}:${allocation.orderItemId.toLowerCase()}:${allocation.startOrdinal + index}`,
      );
    }
  }
  return sameStrings(expected, received);
}

function sameNullableId(value: unknown, expected: string | null): boolean {
  return value === null || value === undefined
    ? expected === null
    : expected !== null && sameGuestPaymentId(value, expected);
}

function sameStrings(first: readonly string[], second: readonly string[]): boolean {
  if (first.length !== second.length) return false;
  const expected = [...first].sort(compareOrdinalStrings);
  const actual = [...second].sort(compareOrdinalStrings);
  return expected.every((value, index) => value === actual[index]);
}

function mismatch(): never {
  throw new Error('The saved guest payment does not match the original reviewed contribution.');
}
