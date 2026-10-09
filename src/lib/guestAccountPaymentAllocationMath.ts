import type { AccountPaymentAllocation, AccountPaymentUnitSelection } from '@/types/accountPayments';

export function amountAllocations(
  available: readonly AccountPaymentAllocation[],
  amount: number,
): AccountPaymentAllocation[] | null {
  const availableTotal = totalGuestPaymentAllocations(available);
  if (!isPositive(amount) || availableTotal === null || amount > availableTotal) return null;
  const result: AccountPaymentAllocation[] = [];
  let left = amount;
  for (const segment of available) {
    if (left === 0) break;
    if (segment.minorPerUnit <= 0 || segment.unitCount <= 0) return null;
    const fullUnits = Math.min(segment.unitCount, Math.floor(left / segment.minorPerUnit));
    if (fullUnits > 0) {
      const fullAmount = fullUnits * segment.minorPerUnit;
      result.push({ ...segment, unitCount: fullUnits, amountMinor: fullAmount });
      left -= fullAmount;
    }
    if (fullUnits < segment.unitCount && left > 0) {
      result.push({
        ...segment,
        startOrdinal: segment.startOrdinal + fullUnits,
        unitCount: 1,
        minorPerUnit: left,
        amountMinor: left,
      });
      left = 0;
    }
  }
  return left === 0 ? result : null;
}

export function subtractAllocations(
  due: readonly AccountPaymentAllocation[],
  reductions: readonly AccountPaymentAllocation[],
): AccountPaymentAllocation[] {
  const result: AccountPaymentAllocation[] = [];
  for (const segment of due) {
    const matches = reductions
      .filter(
        (value) =>
          value.orderId === segment.orderId &&
          value.orderItemId === segment.orderItemId &&
          value.startOrdinal < segment.startOrdinal + segment.unitCount &&
          value.startOrdinal + value.unitCount > segment.startOrdinal,
      )
      .sort((first, second) => first.startOrdinal - second.startOrdinal);
    const boundaries = [
      ...new Set([
        segment.startOrdinal,
        segment.startOrdinal + segment.unitCount,
        ...matches.flatMap((reduction) => [
          Math.max(segment.startOrdinal, reduction.startOrdinal),
          Math.min(segment.startOrdinal + segment.unitCount, reduction.startOrdinal + reduction.unitCount),
        ]),
      ]),
    ].sort((first, second) => first - second);
    for (let index = 0; index < boundaries.length - 1; index += 1) {
      const start = boundaries[index];
      const end = boundaries[index + 1];
      const reductionsPerUnit = matches
        .filter((reduction) => reduction.startOrdinal <= start && reduction.startOrdinal + reduction.unitCount > start)
        .reduce((sum, reduction) => sum + reduction.minorPerUnit, 0);
      const minorPerUnit = segment.minorPerUnit - reductionsPerUnit;
      if (minorPerUnit > 0) result.push(sliceAllocation(segment, start, end, minorPerUnit));
    }
  }
  return result;
}

export function isCoveredBy(
  available: readonly AccountPaymentAllocation[],
  selected: readonly AccountPaymentAllocation[],
): boolean {
  return selected.every((requested) => {
    const start = requested.startOrdinal;
    const end = start + requested.unitCount;
    const covered = [...available]
      .filter(
        (segment) =>
          segment.orderId === requested.orderId &&
          segment.orderItemId === requested.orderItemId &&
          segment.startOrdinal < end &&
          segment.startOrdinal + segment.unitCount > start,
      )
      .sort((first, second) => first.startOrdinal - second.startOrdinal);
    let cursor = start;
    let amount = 0;
    for (const segment of covered) {
      if (segment.startOrdinal > cursor || segment.minorPerUnit < requested.minorPerUnit) return false;
      const overlapEnd = Math.min(end, segment.startOrdinal + segment.unitCount);
      const overlapStart = Math.max(cursor, segment.startOrdinal);
      amount += (overlapEnd - overlapStart) * requested.minorPerUnit;
      cursor = overlapEnd;
    }
    return cursor === end && amount === requested.amountMinor;
  });
}

export function sameGuestPaymentAllocations(
  first: readonly AccountPaymentAllocation[],
  second: readonly AccountPaymentAllocation[],
): boolean {
  if (first.length !== second.length) return false;
  const normalize = (values: readonly AccountPaymentAllocation[]) =>
    [...values]
      .sort(compareAllocation)
      .map((value) =>
        [
          value.orderId.toLowerCase(),
          value.orderItemId?.toLowerCase() ?? null,
          value.startOrdinal,
          value.unitCount,
          value.minorPerUnit,
          value.amountMinor,
        ].join(':'),
      );
  const expected = normalize(first);
  const actual = normalize(second);
  return expected.every((value, index) => value === actual[index]);
}

export function totalGuestPaymentAllocations(allocations: readonly AccountPaymentAllocation[]): number | null {
  let total = 0;
  for (const allocation of allocations) {
    total += allocation.amountMinor;
    if (!Number.isSafeInteger(total)) return null;
  }
  return total;
}

export function hasDuplicateUnits(units: readonly AccountPaymentUnitSelection[]): boolean {
  const values = units.map((unit) => `${unit.orderId.toLowerCase()}:${unit.orderItemId.toLowerCase()}:${unit.ordinal}`);
  return new Set(values).size !== values.length;
}

export function compareAllocation(first: AccountPaymentAllocation, second: AccountPaymentAllocation): number {
  return (
    first.orderId.localeCompare(second.orderId) ||
    (first.orderItemId ?? '').localeCompare(second.orderItemId ?? '') ||
    first.startOrdinal - second.startOrdinal
  );
}

function sliceAllocation(
  source: AccountPaymentAllocation,
  start: number,
  end: number,
  minorPerUnit = source.minorPerUnit,
): AccountPaymentAllocation {
  const unitCount = end - start;
  return { ...source, startOrdinal: start, unitCount, minorPerUnit, amountMinor: minorPerUnit * unitCount };
}

function isPositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}
