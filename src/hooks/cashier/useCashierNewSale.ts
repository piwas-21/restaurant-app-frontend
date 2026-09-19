'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { OrderDto } from '@/types/order';
import { useEnabledOrderTypes } from '@/hooks/checkout/useEnabledOrderTypes';
import type { CustomizationResult } from '@/components/catalog/productCustomizationTypes';
import { getProductById } from '@/services/menuService';
import type { Product } from '@/services/serverService';
import { clearCashierNewSaleDraft } from '@/lib/cashierNewSaleDraft';
import { reviewCounterSale } from './newSaleReview';
import { decideTap } from './newSaleProduct';
import { useNewSaleDraft } from './useNewSaleDraft';

/**
 * The New sale state machine (cashier POS redesign plan §5.3): the persistent draft plus the
 * tap-to-add / customize flow and the Review & collect pass. The draft itself, its line
 * actions and its persistence live in `useNewSaleDraft`; the quote→create order of operations
 * lives in `newSaleReview`.
 */

type ReviewPhase = 'idle' | 'reviewing';

interface UseCashierNewSaleOptions {
  /** Called with the created order id, exactly once, after a committed create. */
  onCreated: (orderId: string) => void;
}

export function useCashierNewSale({ onCreated }: UseCashierNewSaleOptions) {
  const { enabled, loading: channelsLoading } = useEnabledOrderTypes();
  const draft = useNewSaleDraft(enabled, channelsLoading);
  const { state } = draft;

  const [phase, setPhase] = useState<ReviewPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<OrderDto | null>(null);
  const [sheetProduct, setSheetProduct] = useState<Product | null>(null);
  const [tapPendingId, setTapPendingId] = useState<string | null>(null);

  const tapProduct = useCallback(
    async (product: Product) => {
      if (tapPendingId !== null || phase !== 'idle') return;
      setTapPendingId(product.id);
      setError(null);
      try {
        // The guest sheet's own detail service decides "simple" — one source for the question.
        const response = (await getProductById(product.id)) as {
          success: boolean;
          data?: Parameters<typeof decideTap>[0];
        };
        const detail = response.success ? response.data : undefined;
        if (!detail) {
          setError('cashier.new_sale.product_unavailable');
          return;
        }
        const decision = decideTap(detail);
        if (decision.kind === 'sheet') setSheetProduct(product);
        else draft.addLine(product, decision.result);
      } catch (_error) {
        setError('cashier.new_sale.product_unavailable');
      } finally {
        setTapPendingId(null);
      }
    },
    [draft, phase, tapPendingId],
  );

  const confirmCustomization = useCallback(
    (result: CustomizationResult) => {
      const product = sheetProduct;
      if (!product) return;
      setSheetProduct(null);
      draft.addLine(product, result);
    },
    [draft, sheetProduct],
  );

  const review = useCallback(async () => {
    if (!state.channel || state.lines.length === 0 || phase !== 'idle') return;
    setError(null);
    setPhase('reviewing');
    const outcome = await reviewCounterSale({
      channel: state.channel,
      lines: state.lines,
      notes: state.notes,
      tableNumber: state.tableNumber,
      storedOperationId: state.clientOperationId,
    });

    // Remember the operation id this pass used so a retry of the SAME ticket replays it; any
    // draft mutation has already dropped it from the state, so this write only survives while
    // the ticket is unchanged.
    if (outcome.operationId && outcome.operationId !== state.clientOperationId) {
      draft.setOperationId(outcome.operationId);
    }
    if (outcome.quote) setQuote(outcome.quote);

    if (outcome.status === 'committed') {
      // Empty the in-memory ticket first so the persist effect that follows clears the stored
      // draft (and stays cleared), instead of rewriting the sold ticket on the next write.
      draft.reset();
      clearCashierNewSaleDraft();
      setPhase('idle');
      onCreated(outcome.orderId as string);
      return;
    }
    setPhase('idle');
    setError(outcome.error ?? null);
  }, [draft, onCreated, phase, state]);

  // A quoted price belongs to the exact ticket it quoted. Any content change — channel, lines,
  // notes, table — invalidates it, so the next review quotes again (plan §5.3.5: a channel
  // change reprices against server rules, never silently).
  const contentKey = useMemo(
    () => JSON.stringify([state.channel, state.lines, state.notes, state.tableNumber]),
    [state.channel, state.lines, state.notes, state.tableNumber],
  );
  const lastContentKeyRef = useRef(contentKey);
  useEffect(() => {
    if (lastContentKeyRef.current === contentKey) return;
    lastContentKeyRef.current = contentKey;
    setQuote(null);
  }, [contentKey]);

  const ticketTotal = useMemo(
    () => state.lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0),
    [state.lines],
  );

  return {
    channel: state.channel,
    channelsEnabled: enabled,
    channelsLoading,
    lines: state.lines,
    notes: state.notes,
    tableNumber: state.tableNumber,
    ticketTotal,
    quote,
    phase,
    error,
    sheetProduct,
    tapPendingId,
    lastRemoved: draft.lastRemoved,
    setChannel: draft.setChannel,
    setNotes: draft.setNotes,
    setTableNumber: draft.setTableNumber,
    setLineQuantity: draft.setLineQuantity,
    removeLine: draft.removeLine,
    undoRemove: draft.undoRemove,
    tapProduct,
    confirmCustomization,
    closeSheet: () => setSheetProduct(null),
    review,
  };
}

export default useCashierNewSale;
