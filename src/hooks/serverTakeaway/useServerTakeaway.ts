'use client';
import { useCallback, useEffect, useState } from 'react';
import type { OrderDto } from '@/types/order';
import { useServerTakeawayProduct } from './useServerTakeawayProduct';
import type { OrderItem } from '@/components/catalog/orderItems';
import {
  clearServerTakeawayDraft,
  persistServerTakeawayDraft,
  readServerTakeawayDraft,
} from '@/lib/serverTakeawayDraft';
import { reviewServerTakeaway } from './serverTakeawayReview';
import { useServerTakeawayCatalog } from './useServerTakeawayCatalog';
import type { StaffCustomerSelection } from '@/types/staffCustomer';
import { useModuleEnabled } from '@/contexts/ModulesContext';
import { useServerTakeawayTicketLines } from './useServerTakeawayTicketLines';
import { EMPTY_ITEMS, type ReviewPhase, type OperationState } from './serverTakeawayState';
export function useServerTakeaway() {
  const catalog = useServerTakeawayCatalog();
  const loyaltyEnabled = useModuleEnabled('loyalty');
  const [items, setItems] = useState<OrderItem[]>(EMPTY_ITEMS);
  const [billCharges, setBillCharges] = useState<import('@/types/billCharge').BillChargeInput[]>([]);
  const [notes, setNotes] = useState('');
  const [customer, setCustomer] = useState<StaffCustomerSelection | undefined>();
  const [clientOperationId, setClientOperationId] = useState<string | undefined>();
  const [hydrated, setHydrated] = useState(false);
  const [draftRecovered, setDraftRecovered] = useState(false);
  const [phase, setPhase] = useState<ReviewPhase>('idle');
  const [operationState, setOperationState] = useState<OperationState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<OrderDto | null>(null);
  const [createdOrder, setCreatedOrder] = useState<OrderDto | null>(null);
  const [lastOperationId, setLastOperationId] = useState<string | undefined>();
  useEffect(() => {
    const stored = readServerTakeawayDraft();
    if (stored) {
      setItems(stored.items);
      setNotes(stored.notes ?? '');
      setBillCharges(stored.billCharges ?? []);
      setCustomer(stored.customer);
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
    persistServerTakeawayDraft({ items, notes, billCharges, customer, clientOperationId });
  }, [billCharges, clientOperationId, customer, hydrated, items, notes]);
  const invalidate = useCallback(() => {
    setClientOperationId(undefined);
    setQuote(null);
    setCreatedOrder(null);
    setOperationState('idle');
    setError(null);
  }, []);
  const mutate = useCallback(
    (change: (current: OrderItem[]) => OrderItem[]) => {
      setItems(change);
      invalidate();
    },
    [invalidate],
  );
  const ticketLines = useServerTakeawayTicketLines(items, mutate);
  const updateNotes = useCallback(
    (value: string) => {
      setNotes(value);
      invalidate();
    },
    [invalidate],
  );
  const updateBillCharges = (values: import('@/types/billCharge').BillChargeInput[]) => {
    if (phase !== 'idle') return;
    setBillCharges(values);
    invalidate();
  };
  const updateCustomer = useCallback(
    (value: StaffCustomerSelection | undefined) => {
      setCustomer(value);
      invalidate();
    },
    [invalidate],
  );
  const { selectedProduct, tapPendingId, tapProduct, confirmCustomization, closeCustomization } =
    useServerTakeawayProduct(phase, mutate, setError);
  const discardDraft = useCallback(() => {
    setItems([]);
    setNotes('');
    setBillCharges([]);
    setCustomer(undefined);
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
    persistServerTakeawayDraft({ items, notes, billCharges, customer, clientOperationId: operationId });
    const outcome = await reviewServerTakeaway({
      items,
      notes,
      billCharges,
      customer,
      loyaltyEnabled,
      storedOperationId: operationId,
    });
    setClientOperationId(outcome.operationId);
    setLastOperationId(outcome.operationId);
    if (outcome.quote) setQuote(outcome.quote);
    if (outcome.status === 'committed' && outcome.order) {
      setCreatedOrder(outcome.order);
      setOperationState('committed');
      setItems([]);
      setNotes('');
      setBillCharges([]);
      setCustomer(undefined);
      setQuote(null);
      setClientOperationId(undefined);
      setDraftRecovered(false);
      clearServerTakeawayDraft();
    } else {
      setOperationState('failed');
      setError(outcome.error ?? 'server.takeaway.review_failed');
    }
    setPhase('idle');
  }, [billCharges, clientOperationId, customer, items, loyaltyEnabled, notes, phase]);
  const ticketTotal =
    items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0) +
    billCharges.reduce((sum, charge) => sum + charge.amount, 0);
  return {
    ...catalog,
    catalogError: catalog.error,
    items,
    notes,
    customer,
    billCharges,
    setBillCharges: updateBillCharges,
    setNotes: updateNotes,
    setCustomer: updateCustomer,
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
    tapProduct,
    confirmCustomization,
    closeCustomization,
    ...ticketLines,
    review,
    discardDraft,
    resumeDraft: () => setDraftRecovered(false),
  };
}
