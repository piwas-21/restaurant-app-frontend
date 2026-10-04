import type { AccountPaymentOperation } from '@/types/accountPayments';
import {
  ACCOUNT_PAYMENT_MAX_SELECTED_UNITS,
  isPositiveAccountPaymentInteger,
  normalizeAccountPaymentUuid,
  type PendingAccountPayment,
} from './pendingAccountPayment';

function itemUnitKey(orderIdValue: string, itemIdValue: string, ordinal: number): string | null {
  const orderId = normalizeAccountPaymentUuid(orderIdValue);
  const itemId = normalizeAccountPaymentUuid(itemIdValue);
  if (!orderId || !itemId || !isPositiveAccountPaymentInteger(ordinal)) return null;
  return `${orderId}:${itemId}:${ordinal}`;
}

function requestedItemKeys(pending: PendingAccountPayment): Set<string> | null {
  if (pending.kind !== 'payment' || pending.request.mode !== 'Items') return null;
  const selected = pending.request.selectedUnits;
  if (
    !Array.isArray(selected) ||
    selected.length === 0 ||
    selected.length > ACCOUNT_PAYMENT_MAX_SELECTED_UNITS ||
    pending.request.amountMinor !== undefined ||
    pending.request.equalSharePlanId !== undefined ||
    pending.request.equalShareOrdinal !== undefined
  )
    return null;

  const requested = new Set<string>();
  for (const unit of selected) {
    const key = itemUnitKey(unit.orderId, unit.orderItemId, unit.ordinal);
    if (!key || requested.has(key)) return null;
    requested.add(key);
  }
  return requested;
}

function allocationUnitKeys(
  allocation: AccountPaymentOperation['allocations'][number],
  maxUnits: number,
): string[] | null {
  const orderId = normalizeAccountPaymentUuid(allocation.orderId);
  const itemId = normalizeAccountPaymentUuid(allocation.orderItemId);
  if (
    !orderId ||
    !itemId ||
    !isPositiveAccountPaymentInteger(allocation.startOrdinal) ||
    !isPositiveAccountPaymentInteger(allocation.unitCount) ||
    allocation.unitCount > maxUnits ||
    !isPositiveAccountPaymentInteger(allocation.minorPerUnit) ||
    !isPositiveAccountPaymentInteger(allocation.amountMinor) ||
    BigInt(allocation.amountMinor) !== BigInt(allocation.unitCount) * BigInt(allocation.minorPerUnit)
  )
    return null;

  const lastOrdinal = allocation.startOrdinal + allocation.unitCount - 1;
  if (!Number.isSafeInteger(lastOrdinal)) return null;
  const keys: string[] = [];
  for (let ordinal = allocation.startOrdinal; ordinal <= lastOrdinal; ordinal += 1) {
    keys.push(`${orderId}:${itemId}:${ordinal}`);
  }
  return keys;
}

export function matchesRequestedItemScope(pending: PendingAccountPayment, operation: AccountPaymentOperation): boolean {
  const requested = requestedItemKeys(pending);
  if (!requested || !Array.isArray(operation.allocations) || operation.allocations.length === 0) return false;

  const allocated = new Set<string>();
  let amountMinor = BigInt(0);
  for (const allocation of operation.allocations) {
    const keys = allocationUnitKeys(allocation, requested.size - allocated.size);
    if (!keys) return false;
    for (const key of keys) {
      if (allocated.has(key)) return false;
      allocated.add(key);
    }
    amountMinor += BigInt(allocation.amountMinor);
  }
  return (
    allocated.size === requested.size &&
    [...requested].every((key) => allocated.has(key)) &&
    amountMinor === BigInt(operation.amountMinor)
  );
}

export function hasConsistentFrozenAmount(operation: AccountPaymentOperation): boolean {
  if (!Array.isArray(operation.allocations) || operation.allocations.length === 0) return false;
  let amountMinor = BigInt(0);
  for (const allocation of operation.allocations) {
    if (
      !normalizeAccountPaymentUuid(allocation.orderId) ||
      (allocation.orderItemId !== null && !normalizeAccountPaymentUuid(allocation.orderItemId)) ||
      !isPositiveAccountPaymentInteger(allocation.startOrdinal) ||
      !isPositiveAccountPaymentInteger(allocation.unitCount) ||
      !isPositiveAccountPaymentInteger(allocation.minorPerUnit) ||
      !isPositiveAccountPaymentInteger(allocation.amountMinor) ||
      BigInt(allocation.amountMinor) !== BigInt(allocation.unitCount) * BigInt(allocation.minorPerUnit) ||
      !Number.isSafeInteger(allocation.startOrdinal + allocation.unitCount - 1)
    )
      return false;
    amountMinor += BigInt(allocation.amountMinor);
  }
  return amountMinor === BigInt(operation.amountMinor);
}
