import type { GuestAccountPaymentOperation } from '@/types/guestAccountPayments';
import { compareAllocation } from './guestAccountPaymentAllocationMath';
import { fingerprintText } from './guestParticipantFingerprint';

export async function guestPaymentSnapshotFingerprint(operation: GuestAccountPaymentOperation): Promise<string | null> {
  const allocations = [...operation.allocations].sort(compareAllocation).map((value) => ({
    orderId: value.orderId.toLowerCase(),
    orderItemId: value.orderItemId?.toLowerCase() ?? null,
    startOrdinal: value.startOrdinal,
    unitCount: value.unitCount,
    minorPerUnit: value.minorPerUnit,
    amountMinor: value.amountMinor,
  }));
  return fingerprintText(
    JSON.stringify({
      serviceSessionId: operation.serviceSessionId.toLowerCase(),
      operationId: operation.operationId.toLowerCase(),
      expectedAccountRevision: operation.expectedAccountRevision,
      mode: operation.mode,
      paymentMethod: operation.paymentMethod,
      amountMinor: operation.amountMinor,
      currency: operation.currency.toUpperCase(),
      quoteExpiresAt: operation.quoteExpiresAt,
      equalSharePlanId: operation.equalSharePlanId?.toLowerCase() ?? null,
      equalShareOrdinal: operation.equalShareOrdinal,
      allocations,
    }),
  );
}
