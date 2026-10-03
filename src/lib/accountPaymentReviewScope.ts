import type { AccountPaymentOperation } from '@/types/accountPayments';
import type { TableServiceSessionDto } from '@/types/order';

export interface FrozenAllocationLine {
  readonly orderNumber: string;
  readonly itemName: string | null;
  readonly startOrdinal: number;
  readonly endOrdinal: number;
  readonly amountMinor: number;
}

type PaymentAllocation = AccountPaymentOperation['allocations'][number];
type SourceAccountItem = NonNullable<TableServiceSessionDto['bill']['accountItems']>[number];

function nonBlank(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function allocationEndOrdinal(allocation: PaymentAllocation): number | null {
  if (
    typeof allocation.orderId !== 'string' ||
    allocation.orderId.length === 0 ||
    !Number.isSafeInteger(allocation.startOrdinal) ||
    allocation.startOrdinal < 1 ||
    !Number.isSafeInteger(allocation.unitCount) ||
    allocation.unitCount < 1 ||
    !Number.isSafeInteger(allocation.minorPerUnit) ||
    allocation.minorPerUnit < 1 ||
    !Number.isSafeInteger(allocation.amountMinor) ||
    allocation.amountMinor < 1 ||
    BigInt(allocation.amountMinor) !== BigInt(allocation.minorPerUnit) * BigInt(allocation.unitCount)
  )
    return null;
  const endOrdinal = allocation.startOrdinal + allocation.unitCount - 1;
  return Number.isSafeInteger(endOrdinal) ? endOrdinal : null;
}

function sharedChargeLine(
  allocation: PaymentAllocation,
  endOrdinal: number,
  orders: Map<string, string>,
): FrozenAllocationLine | null {
  const orderNumber = nonBlank(orders.get(allocation.orderId));
  return orderNumber
    ? {
        orderNumber,
        itemName: null,
        startOrdinal: allocation.startOrdinal,
        endOrdinal,
        amountMinor: allocation.amountMinor,
      }
    : null;
}

function sourceItemLine(
  allocation: PaymentAllocation,
  endOrdinal: number,
  items: Map<string, SourceAccountItem>,
): FrozenAllocationLine | null {
  const source = items.get(`${allocation.orderId}:${allocation.orderItemId}`);
  if (!source) return null;
  const snapshot = source.itemSnapshot;
  const itemName = nonBlank(snapshot.productName) ?? nonBlank(snapshot.menuName);
  const orderNumber = nonBlank(source.orderNumber);
  if (
    source.orderId !== allocation.orderId ||
    source.orderItemId !== allocation.orderItemId ||
    snapshot.id !== allocation.orderItemId ||
    !itemName ||
    !orderNumber ||
    !Number.isSafeInteger(source.unitCount) ||
    source.unitCount < 1 ||
    endOrdinal > source.unitCount
  )
    return null;

  const variation = nonBlank(snapshot.variationName);
  return {
    orderNumber,
    itemName: variation ? `${itemName} · ${variation}` : itemName,
    startOrdinal: allocation.startOrdinal,
    endOrdinal,
    amountMinor: allocation.amountMinor,
  };
}

function frozenAllocationLine(
  allocation: PaymentAllocation,
  items: Map<string, SourceAccountItem>,
  orders: Map<string, string>,
): FrozenAllocationLine | null {
  const endOrdinal = allocationEndOrdinal(allocation);
  if (endOrdinal === null) return null;
  if (allocation.orderItemId === null) return sharedChargeLine(allocation, endOrdinal, orders);
  return sourceItemLine(allocation, endOrdinal, items);
}

export function mapFrozenAccountPaymentAllocations(
  operation: AccountPaymentOperation,
  session: TableServiceSessionDto,
): { readonly complete: boolean; readonly lines: readonly FrozenAllocationLine[] } {
  const items = new Map(
    (session.bill.accountItems ?? []).map((entry) => [`${entry.orderId}:${entry.orderItemId}`, entry]),
  );
  const orders = new Map(session.bill.orders.map((order) => [order.id, order.orderNumber]));
  const mapped = operation.allocations.map((allocation) => frozenAllocationLine(allocation, items, orders));
  const lines = mapped.filter((line): line is FrozenAllocationLine => line !== null);
  const totalMinor = lines.reduce((total, line) => total + BigInt(line.amountMinor), BigInt(0));
  const validOperationTotal = Number.isSafeInteger(operation.amountMinor) && operation.amountMinor > 0;
  const totalMatches = validOperationTotal && totalMinor === BigInt(operation.amountMinor);
  return {
    complete: lines.length > 0 && lines.length === operation.allocations.length && totalMatches,
    lines,
  };
}
