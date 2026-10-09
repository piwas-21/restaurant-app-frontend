import type { AccountPaymentAllocation } from '@/types/accountPayments';

export const GUEST_PAYMENT_GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATES = new Set([
  'Quoted',
  'Reserved',
  'Starting',
  'Processing',
  'Captured',
  'CancelRequested',
  'Released',
  'Failed',
  'ReconciliationRequired',
]);

export function isGuestPaymentRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isGuestPaymentId(value: unknown): value is string {
  return typeof value === 'string' && GUEST_PAYMENT_GUID.test(value);
}

export function sameGuestPaymentId(value: unknown, expected: string): boolean {
  return isGuestPaymentId(value) && value.toLowerCase() === expected.toLowerCase();
}

export function isGuestPaymentState(value: unknown): boolean {
  return typeof value === 'string' && STATES.has(value);
}

export function isGuestPaymentCurrency(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Z]{3}$/i.test(value);
}

export function sameGuestPaymentCurrency(first: string, second: string): boolean {
  return first.toUpperCase() === second.toUpperCase();
}

export function isGuestPaymentPositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

export function isGuestPaymentNonnegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function isGuestPaymentDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

export function isGuestPaymentOptionalDate(value: unknown): boolean {
  return value === null || value === undefined || isGuestPaymentDate(value);
}

export function validGuestPaymentAllocations(
  value: unknown,
  allowEmpty = false,
): value is readonly AccountPaymentAllocation[] {
  if (!Array.isArray(value) || (!allowEmpty && value.length < 1) || value.length > 2000) return false;
  return (
    value.every(
      (entry) =>
        isGuestPaymentRecord(entry) &&
        isGuestPaymentId(entry.orderId) &&
        (entry.orderItemId === null || isGuestPaymentId(entry.orderItemId)) &&
        isGuestPaymentPositive(entry.startOrdinal) &&
        isGuestPaymentPositive(entry.unitCount) &&
        isGuestPaymentNonnegative(entry.minorPerUnit) &&
        isGuestPaymentPositive(entry.amountMinor) &&
        Number.isSafeInteger(entry.startOrdinal + entry.unitCount - 1) &&
        entry.amountMinor === entry.minorPerUnit * entry.unitCount &&
        (entry.orderItemId !== null || (entry.startOrdinal === 1 && entry.unitCount === 1)),
    ) && hasDisjointRanges(value as readonly AccountPaymentAllocation[])
  );
}

export function totalValidAllocations(allocations: readonly AccountPaymentAllocation[]): number | null {
  let total = 0;
  for (const allocation of allocations) {
    total += allocation.amountMinor;
    if (!Number.isSafeInteger(total)) return null;
  }
  return total;
}

function hasDisjointRanges(allocations: readonly AccountPaymentAllocation[]): boolean {
  const sorted = [...allocations].sort(
    (first, second) =>
      first.orderId.localeCompare(second.orderId) ||
      (first.orderItemId ?? '').localeCompare(second.orderItemId ?? '') ||
      first.startOrdinal - second.startOrdinal,
  );
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    if (
      previous.orderId.toLowerCase() === current.orderId.toLowerCase() &&
      (previous.orderItemId ?? '').toLowerCase() === (current.orderItemId ?? '').toLowerCase() &&
      current.startOrdinal < previous.startOrdinal + previous.unitCount
    )
      return false;
  }
  return true;
}
