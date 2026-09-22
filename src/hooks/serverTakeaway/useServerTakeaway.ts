'use client';
import { useCallback, useEffect, useState } from 'react';
import { OrderType, type OrderDto } from '@/types/order';
import type { CustomizationResult, ProductCustomizationDetail } from '@/components/catalog/productCustomizationTypes';
import type { Product } from '@/services/serverService';
import { getProductById } from '@/services/menuService';
import { addCustomizedItem, type OrderItem } from '@/components/catalog/orderItems';
import { decideProductTap } from '@/components/catalog/productTap';
import { getErrorMessage } from '@/utils/apiClient';
import {
  clearServerTakeawayDraft,
  persistServerTakeawayDraft,
  readServerTakeawayDraft,
} from '@/lib/serverTakeawayDraft';
import { reviewServerTakeaway } from './serverTakeawayReview';
import { useServerTakeawayCatalog } from './useServerTakeawayCatalog';
type ReviewPhase = 'idle' | 'reviewing';
type OperationState = 'idle' | 'committed' | 'failed';
const EMPTY_ITEMS: OrderItem[] = [];
export function useServerTakeaway() {
  const catalog = useServerTakeawayCatalog();
  const [items, setItems] = useState<OrderItem[]>(EMPTY_ITEMS);
  const [notes, setNotes] = useState('');
  const [clientOperationId, setClientOperationId] = useState<string | undefined>();
  const [hydrated, setHydrated] = useState(false);
  const [draftRecovered, setDraftRecovered] = useState(false);
  const [phase, setPhase] = useState<ReviewPhase>('idle');
  const [operationState, setOperationState] = useState<OperationState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<OrderDto | null>(null);
  const [createdOrder, setCreatedOrder] = useState<OrderDto | null>(null);
  const [lastOperationId, setLastOperationId] = useState<string | undefined>();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [tapPendingId, setTapPendingId] = useState<string | null>(null);
  const [lastRemoved, setLastRemoved] = useState<{ item: OrderItem; index: number } | null>(null);
  useEffect(() => {
    const stored = readServerTakeawayDraft();
    if (stored) {
      setItems(stored.items);
      setNotes(stored.notes ?? '');
      setClientOperationId(stored.clientOperationId);
      setDraftRecovered(true);
    }
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    if (items.length === 0 && notes.trim() === '') {
      clearServerTakeawayDraft();
      return;
    }
    persistServerTakeawayDraft({ items, notes, clientOperationId });
  }, [clientOperationId, hydrated, items, notes]);
  const mutate = useCallback((change: (current: OrderItem[]) => OrderItem[]) => {
    setItems(change);
    setClientOperationId(undefined);
    setQuote(null);
    setCreatedOrder(null);
    setOperationState('idle');
    setError(null);
  }, []);
  const updateNotes = useCallback((value: string) => {
    setNotes(value);
    setClientOperationId(undefined);
    setQuote(null);
    setCreatedOrder(null);
    setOperationState('idle');
    setError(null);
  }, []);
  const tapProduct = useCallback(
    async (product: Product) => {
      if (tapPendingId !== null || phase !== 'idle') return;
      setTapPendingId(product.id);
      setError(null);
      try {
        const response = (await getProductById(product.id, undefined, OrderType.Takeaway)) as {
          success?: boolean;
          data?: ProductCustomizationDetail;
        };
        if (!response.success || !response.data || response.data.availability?.canOrder === false) {
          setError('server.takeaway.product_unavailable');
          return;
        }
        const decision = decideProductTap(response.data);
        if (decision.kind === 'sheet') setSelectedProduct(product);
        else mutate((current) => addCustomizedItem(current, product, decision.result));
      } catch (error: unknown) {
        setError(getErrorMessage(error) ?? 'server.takeaway.product_unavailable');
      } finally {
        setTapPendingId(null);
      }
    },
    [mutate, phase, tapPendingId],
  );
  const confirmCustomization = useCallback(
    (result: CustomizationResult) => {
      const product = selectedProduct;
      if (!product) return;
      setSelectedProduct(null);
      mutate((current) => addCustomizedItem(current, product, result));
    },
    [mutate, selectedProduct],
  );
  const setItemQuantity = useCallback(
    (index: number, quantity: number) =>
      mutate((current) =>
        quantity <= 0
          ? current.filter((_, itemIndex) => itemIndex !== index)
          : current.map((item, itemIndex) => (itemIndex === index ? { ...item, quantity } : item)),
      ),
    [mutate],
  );
  const removeItem = useCallback(
    (index: number) => {
      const item = items[index];
      if (!item) return;
      setLastRemoved({ item, index });
      mutate((current) => current.filter((_, itemIndex) => itemIndex !== index));
    },
    [items, mutate],
  );
  const undoRemove = useCallback(() => {
    if (!lastRemoved) return;
    const removal = lastRemoved;
    setLastRemoved(null);
    mutate((current) => {
      const next = [...current];
      next.splice(Math.min(removal.index, next.length), 0, removal.item);
      return next;
    });
  }, [lastRemoved, mutate]);
  const discardDraft = useCallback(() => {
    setItems([]);
    setNotes('');
    setClientOperationId(undefined);
    setQuote(null);
    setCreatedOrder(null);
    setLastOperationId(undefined);
    setError(null);
    setOperationState('idle');
    setDraftRecovered(false);
    clearServerTakeawayDraft();
  }, []);
  const review = useCallback(async () => {
    if (items.length === 0 || phase !== 'idle') return;
    setPhase('reviewing');
    setError(null);
    // Persist before create so recovery replays an unknown commit outcome instead of duplicating it.
    const operationId = clientOperationId ?? crypto.randomUUID();
    setClientOperationId(operationId);
    setLastOperationId(operationId);
    persistServerTakeawayDraft({ items, notes, clientOperationId: operationId });
    const outcome = await reviewServerTakeaway({ items, notes, storedOperationId: operationId });
    setClientOperationId(outcome.operationId);
    setLastOperationId(outcome.operationId);
    if (outcome.quote) setQuote(outcome.quote);
    if (outcome.status === 'committed' && outcome.order) {
      setCreatedOrder(outcome.order);
      setOperationState('committed');
      setItems([]);
      setNotes('');
      setQuote(null);
      setClientOperationId(undefined);
      setDraftRecovered(false);
      clearServerTakeawayDraft();
    } else {
      setOperationState('failed');
      setError(outcome.error ?? 'server.takeaway.review_failed');
    }
    setPhase('idle');
  }, [clientOperationId, items, notes, phase]);
  const ticketTotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  return {
    ...catalog,
    catalogError: catalog.error,
    items,
    notes,
    setNotes: updateNotes,
    ticketTotal,
    quote,
    createdOrder,
    lastOperationId,
    phase,
    operationState,
    error,
    draftRecovered,
    selectedProduct,
    tapPendingId,
    lastRemoved,
    tapProduct,
    confirmCustomization,
    closeCustomization: () => setSelectedProduct(null),
    setItemQuantity,
    removeItem,
    undoRemove,
    review,
    discardDraft,
    resumeDraft: () => setDraftRecovered(false),
  };
}
