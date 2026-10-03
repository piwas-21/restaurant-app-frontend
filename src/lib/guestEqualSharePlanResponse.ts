import type { GuestEqualSharePlan } from '@/types/guestAccountPayments';
import {
  isGuestPaymentCurrency,
  isGuestPaymentDate,
  isGuestPaymentId,
  isGuestPaymentPositive,
  isGuestPaymentRecord,
  sameGuestPaymentId,
  totalValidAllocations,
  validGuestPaymentAllocations,
} from './guestAccountPaymentResponsePrimitives';

export function validateGuestEqualSharePlan(
  value: unknown,
  serviceSessionId: string,
  operationId: string,
  expected?: { readonly accountRevision: number; readonly shareCount: number },
): GuestEqualSharePlan {
  if (!isGuestPaymentRecord(value)) return mismatch();
  const plan = value as unknown as GuestEqualSharePlan;
  if (
    !sameGuestPaymentId(plan.serviceSessionId, serviceSessionId) ||
    !sameGuestPaymentId(plan.operationId, operationId) ||
    !isGuestPaymentId(plan.planId) ||
    !isGuestPaymentPositive(plan.accountRevision) ||
    !isGuestPaymentPositive(plan.totalMinor) ||
    !isGuestPaymentPositive(plan.shareCount) ||
    plan.shareCount < 2 ||
    !isGuestPaymentCurrency(plan.currency) ||
    !isGuestPaymentDate(plan.createdAt) ||
    (plan.invalidatedAt !== null && !isGuestPaymentDate(plan.invalidatedAt)) ||
    !validGuestPaymentAllocations(plan.scope) ||
    totalValidAllocations(plan.scope) !== plan.totalMinor ||
    (expected !== undefined &&
      (plan.accountRevision !== expected.accountRevision || plan.shareCount !== expected.shareCount))
  )
    return mismatch();
  return plan;
}

function mismatch(): never {
  throw new Error('The saved equal-share plan does not match the original request.');
}
