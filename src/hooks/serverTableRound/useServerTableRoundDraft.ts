'use client';

import { useCallback, useEffect, useState } from 'react';
import { useOptionalAuth } from '@/components/AuthContext';
import type { OrderDto } from '@/types/order';
import type { OrderItem } from '@/components/catalog/orderItems';
import type { StaffCustomerSelection } from '@/types/staffCustomer';
import { useModuleEnabled } from '@/contexts/ModulesContext';
import {
  clearServerTableRoundDraft,
  persistServerTableRoundDraft,
  readServerTableRoundDraft,
} from '@/lib/serverTableRoundDraft';

export type RoundOperationState = 'idle' | 'committed' | 'failed' | 'unknown';

export function useServerTableRoundDraft(
  tableId: string,
  sessionId: string | null,
  sessionMatchesQuery: boolean,
  sessionResolved: boolean,
) {
  const loyaltyEnabled = useModuleEnabled('loyalty');
  const auth = useOptionalAuth();
  const staffUserId = auth?.user?.email;
  const [items, setItems] = useState<OrderItem[]>([]);
  const [notes, setNotes] = useState('');
  const [customer, setCustomer] = useState<StaffCustomerSelection | undefined>();
  const [operationId, setOperationId] = useState<string | undefined>();
  const [quote, setQuote] = useState<OrderDto | null>(null);
  const [createdOrder, setCreatedOrder] = useState<OrderDto | null>(null);
  const [operationState, setOperationState] = useState<RoundOperationState>('idle');
  const [draftRecovered, setDraftRecovered] = useState(false);

  useEffect(() => {
    if (!sessionId || !sessionMatchesQuery) {
      setItems([]);
      setNotes('');
      setCustomer(undefined);
      setOperationId(undefined);
      setQuote(null);
      setDraftRecovered(false);
      // A null session is also the first render while the floor snapshot is loading.
      // Clear only after the floor reader has delivered an authoritative answer.
      if (sessionResolved) clearServerTableRoundDraft();
      return;
    }
    const stored = readServerTableRoundDraft(tableId, sessionId, staffUserId);
    setItems(stored?.items ?? []);
    setNotes(stored?.notes ?? '');
    setCustomer(stored?.customer);
    setOperationId(stored?.clientOperationId);
    setDraftRecovered(Boolean(stored));
    setQuote(null);
    setCreatedOrder(null);
    setOperationState(stored?.clientOperationId ? 'unknown' : 'idle');
  }, [sessionId, sessionMatchesQuery, sessionResolved, staffUserId, tableId]);

  useEffect(() => {
    if (!sessionId || !sessionMatchesQuery) return;
    if (!items.length && !notes.trim() && !operationId && !customer) {
      clearServerTableRoundDraft();
      return;
    }
    persistServerTableRoundDraft(
      {
        tableId,
        serviceSessionId: sessionId,
        items,
        notes,
        customer,
        clientOperationId: operationId,
      },
      staffUserId,
    );
  }, [customer, items, notes, operationId, sessionId, sessionMatchesQuery, staffUserId, tableId]);

  const mutate = useCallback((change: (current: OrderItem[]) => OrderItem[]) => {
    setItems(change);
    setOperationId(undefined);
    setQuote(null);
    setCreatedOrder(null);
    setOperationState('idle');
  }, []);
  const updateNotes = useCallback((value: string) => {
    setNotes(value);
    setOperationId(undefined);
    setQuote(null);
    setCreatedOrder(null);
    setOperationState('idle');
  }, []);
  const updateCustomer = useCallback((value: StaffCustomerSelection | undefined) => {
    setCustomer(value);
    setOperationId(undefined);
    setQuote(null);
    setCreatedOrder(null);
    setOperationState('idle');
  }, []);
  const discardDraft = useCallback(() => {
    setItems([]);
    setNotes('');
    setCustomer(undefined);
    setOperationId(undefined);
    setQuote(null);
    setCreatedOrder(null);
    setOperationState('idle');
    setDraftRecovered(false);
    clearServerTableRoundDraft();
  }, []);
  const markCommitted = useCallback((order: OrderDto) => {
    setCreatedOrder(order);
    setOperationState('committed');
    setItems([]);
    setNotes('');
    setCustomer(undefined);
    setOperationId(undefined);
    setDraftRecovered(false);
    clearServerTableRoundDraft();
  }, []);
  return {
    items,
    notes,
    customer,
    loyaltyEnabled,
    operationId,
    quote,
    createdOrder,
    operationState,
    draftRecovered,
    setItems,
    setOperationId,
    setQuote,
    setOperationState,
    setDraftRecovered,
    setNotes: updateNotes,
    setCustomer: updateCustomer,
    mutate,
    discardDraft,
    markCommitted,
  };
}
