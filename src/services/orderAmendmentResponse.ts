import type { OrderDto, OrderItemDto } from '@/types/order';
import type {
  OrderAmendmentChangeSnapshot,
  OrderAmendmentCommitResult,
  OrderAmendmentHistory,
  OrderAmendmentOperationLookup,
  OrderAmendmentQuote,
} from '@/types/orderAmendment';
import { amendmentItemIdentity } from '@/lib/orderAmendmentItemIdentity';

export function normalizeAmendmentQuote(quote: OrderAmendmentQuote): OrderAmendmentQuote {
  return {
    ...quote,
    sourceOrder: normalizeAmendmentOrder(quote.sourceOrder),
    supplementOrder: quote.supplementOrder ? normalizeAmendmentOrder(quote.supplementOrder) : quote.supplementOrder,
    changes: quote.changes.map(normalizeAmendmentChange),
  };
}

export function normalizeAmendmentCommit(result: OrderAmendmentCommitResult): OrderAmendmentCommitResult {
  return {
    ...result,
    supplementOrder: result.supplementOrder ? normalizeAmendmentOrder(result.supplementOrder) : result.supplementOrder,
  };
}

export function normalizeAmendmentLookup(lookup: OrderAmendmentOperationLookup): OrderAmendmentOperationLookup {
  return {
    ...lookup,
    result: lookup.result ? normalizeAmendmentCommit(lookup.result) : lookup.result,
  };
}

export function normalizeAmendmentHistory(history: OrderAmendmentHistory[]): OrderAmendmentHistory[] {
  return history.map((record) => ({
    ...record,
    supplementOrder: record.supplementOrder ? normalizeAmendmentOrder(record.supplementOrder) : record.supplementOrder,
    changes: record.changes.map(normalizeAmendmentChange),
  }));
}

function normalizeAmendmentOrder(order: OrderDto): OrderDto {
  const wire = order as unknown as Record<string, unknown>;
  const items = Array.isArray(wire.items) ? wire.items : Array.isArray(wire.Items) ? wire.Items : [];
  return { ...order, items: items.map((item) => normalizeAmendmentItem(item as OrderItemDto)) };
}

function normalizeAmendmentChange(change: OrderAmendmentChangeSnapshot): OrderAmendmentChangeSnapshot {
  return {
    ...change,
    previous: normalizeAmendmentItem(change.previous),
    current: change.current ? normalizeAmendmentItem(change.current) : change.current,
  };
}

function normalizeAmendmentItem(item: OrderItemDto): OrderItemDto {
  const wire = item as unknown as Record<string, unknown>;
  const { productId, menuId } = amendmentItemIdentity(item);
  const rawChildren = Array.isArray(wire.sideItems)
    ? wire.sideItems
    : Array.isArray(wire.SideItems)
      ? wire.SideItems
      : null;
  return {
    ...item,
    productId,
    menuId: menuId || undefined,
    ...(rawChildren ? { sideItems: rawChildren.map((child) => normalizeAmendmentItem(child as OrderItemDto)) } : {}),
  };
}
