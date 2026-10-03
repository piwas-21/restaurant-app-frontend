import type { AccountPaymentAllocation, AccountPaymentUnitSelection } from '@/types/accountPayments';

export function accountAllocationKey(allocation: AccountPaymentAllocation): string {
  return `${allocation.orderId}:${allocation.orderItemId ?? 'charge'}:${allocation.startOrdinal}`;
}

/** Expand only the reviewed contribution, keeping large account quantities compact. */
export function selectAccountPaymentUnits(
  available: readonly AccountPaymentAllocation[],
  quantities: Readonly<Record<string, number>>,
  maximumSelectedUnits: number,
): AccountPaymentUnitSelection[] | null {
  if (!Number.isSafeInteger(maximumSelectedUnits) || maximumSelectedUnits < 1) return null;
  const selected: AccountPaymentUnitSelection[] = [];
  const known = new Set<string>();
  for (const allocation of available) {
    const key = accountAllocationKey(allocation);
    if (known.has(key)) return null;
    known.add(key);
    const quantity = quantities[key] ?? 0;
    const units = expandSelectedAllocation(allocation, quantity, maximumSelectedUnits - selected.length);
    if (units === null) return null;
    selected.push(...units);
  }
  if (Object.entries(quantities).some(([key, quantity]) => !known.has(key) && quantity !== 0)) return null;
  const identities = new Set(selected.map((unit) => `${unit.orderId}:${unit.orderItemId}:${unit.ordinal}`));
  return identities.size === selected.length && selected.length > 0 ? selected : null;
}

function expandSelectedAllocation(
  allocation: AccountPaymentAllocation,
  quantity: number,
  remainingLimit: number,
): AccountPaymentUnitSelection[] | null {
  if (!Number.isSafeInteger(quantity) || quantity < 0 || quantity > allocation.unitCount || quantity > remainingLimit)
    return null;
  if (quantity === 0) return [];
  if (!allocation.orderItemId || !Number.isSafeInteger(allocation.startOrdinal) || allocation.startOrdinal < 1)
    return null;
  const end = allocation.startOrdinal + quantity - 1;
  if (!Number.isSafeInteger(end)) return null;
  const orderItemId = allocation.orderItemId;
  return Array.from({ length: quantity }, (_, offset) => ({
    orderId: allocation.orderId,
    orderItemId,
    ordinal: allocation.startOrdinal + offset,
  }));
}
