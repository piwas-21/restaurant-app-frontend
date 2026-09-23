import { OrderType, type OrderDto } from '@/types/order';
import type { CashierNewSaleDraftLine } from '@/lib/cashierNewSaleDraft';
import type { CashierNewSaleContact } from '@/lib/cashierNewSaleContact';
import { getErrorMessage } from '@/utils/apiClient';
import { createStaffCounterOrder, quoteStaffCounterOrder } from '@/services/staffCounterOrderService';
import { resolveDineInSession } from './newSaleSession';
import { buildCounterSaleRequest, parseTableNumber } from './newSaleRequest';

/**
 * One Review & collect pass, in the order the plan mandates (§5.3.5–6): resolve the dine-in
 * visit, QUOTE so the server price is the authority, then CREATE exactly once under one
 * `clientOperationId` with an explicit kitchen policy. Nothing here persists client-side —
 * the caller owns the draft.
 *
 * Outcomes, deliberately distinct:
 *   - `blocked`  — a local rule refused before any server call (table number, open visit).
 *   - `refused`  — the server or the network refused; `error` carries the server sentence or
 *                  an i18n key. A refused create may already have minted the operation id; the
 *                  caller persists it so a retry of the SAME ticket replays instead of minting.
 *   - `committed`— the order exists exactly once for this operation id; `orderId` hands it to
 *                  the collection route.
 */
export interface ReviewOutcome {
  status: 'committed' | 'refused' | 'blocked';
  error?: string;
  /** The server-priced quote, when the quote call answered — authoritative for the ticket. */
  quote?: OrderDto;
  /** The operation id this pass used; present from the first create attempt onwards. */
  operationId?: string;
  orderId?: string;
}

export async function reviewCounterSale(input: {
  channel: OrderType;
  lines: readonly CashierNewSaleDraftLine[];
  notes: string;
  tableNumber: string;
  contact?: CashierNewSaleContact;
  storedOperationId?: string;
  loyaltyEnabled?: boolean;
}): Promise<ReviewOutcome> {
  const tableNumber = input.channel === OrderType.DineIn ? parseTableNumber(input.tableNumber) : null;
  if (input.channel === OrderType.DineIn && tableNumber === null) {
    return { status: 'blocked', error: 'cashier.new_sale.invalid_table' };
  }

  let serviceSessionId: string | undefined;
  if (input.channel === OrderType.DineIn && tableNumber !== null) {
    try {
      const resolved = await resolveDineInSession(tableNumber);
      if (!resolved) return { status: 'blocked', error: 'cashier.new_sale.no_open_session' };
      serviceSessionId = resolved;
    } catch (err) {
      return { status: 'refused', error: getErrorMessage(err) ?? 'cashier.new_sale.review_failed' };
    }
  }

  const request = buildCounterSaleRequest({
    channel: input.channel,
    lines: input.lines,
    notes: input.notes,
    tableNumber: tableNumber ?? undefined,
    serviceSessionId,
    contact: input.contact,
    loyaltyEnabled: input.loyaltyEnabled,
  });
  // Minted on the first create attempt and reused for every retry of THIS ticket; any draft
  // mutation drops it, so a timeout after commit replays the same order instead of minting a
  // second one — and a changed ticket never replays under a stale key (the server fingerprints
  // the payload and would refuse).
  const operationId = input.storedOperationId ?? crypto.randomUUID();

  let quote: OrderDto;
  try {
    quote = await quoteStaffCounterOrder(request);
  } catch (err) {
    // Quote refused: nothing was created and no operation was consumed. The sentence is the
    // server's — an unavailable product or a channel rule is exactly what the cashier needs.
    return { status: 'refused', operationId, error: getErrorMessage(err) ?? 'cashier.new_sale.review_failed' };
  }

  try {
    const created = await createStaffCounterOrder({
      ...request,
      clientOperationId: operationId,
      releaseToKitchen: true,
    });
    return { status: 'committed', quote, operationId, orderId: created.id };
  } catch (err) {
    // Create refused after a good quote: the ticket may still show the authoritative total,
    // and the operation id travels back so a retry of the SAME ticket replays, never re-mints.
    return { status: 'refused', quote, operationId, error: getErrorMessage(err) ?? 'cashier.new_sale.review_failed' };
  }
}
