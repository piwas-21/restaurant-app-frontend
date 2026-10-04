'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
import { serverTableRoundScopeKey } from './useServerTableRoundScopeState';

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
  const [hydratedScope, setHydratedScope] = useState<string | null>(null);
  const hydratedScopeRef = useRef<string | null>(null);
  const draftScope = serverTableRoundScopeKey(tableId, sessionId, sessionMatchesQuery, staffUserId);

  useEffect(() => {
    if (!draftScope || !sessionId || !sessionMatchesQuery) {
      hydratedScopeRef.current = null;
      setHydratedScope(null);
      setItems([]);
      setNotes('');
      setCustomer(undefined);
      setOperationId(undefined);
      setQuote(null);
      setCreatedOrder(null);
      setOperationState('idle');
      setDraftRecovered(false);
      // A null session is also the first render while the floor snapshot is loading.
      // Clear only after the floor reader has delivered an authoritative answer.
      if (sessionResolved) clearServerTableRoundDraft();
      return;
    }
    // Floor refreshes toggle sessionResolved without changing the active visit. Hydrate once for
    // each table/session/staff scope so a refresh cannot overwrite a product tap still being saved.
    if (hydratedScopeRef.current === draftScope) return;
    hydratedScopeRef.current = draftScope;
    const stored = readServerTableRoundDraft(tableId, sessionId, staffUserId);
    setItems(stored?.items ?? []);
    setNotes(stored?.notes ?? '');
    setCustomer(stored?.customer);
    setOperationId(stored?.clientOperationId);
    setDraftRecovered(Boolean(stored));
    setQuote(null);
    setCreatedOrder(null);
    setOperationState(stored?.clientOperationId ? 'unknown' : 'idle');
    setHydratedScope(draftScope);
  }, [draftScope, sessionId, sessionMatchesQuery, sessionResolved, staffUserId, tableId]);

  useEffect(() => {
    if (!draftScope || hydratedScope !== draftScope || !sessionId || !sessionMatchesQuery) return;
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
  }, [
    customer,
    draftScope,
    hydratedScope,
    items,
    notes,
    operationId,
    sessionId,
    sessionMatchesQuery,
    staffUserId,
    tableId,
  ]);

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
    isReady: Boolean(draftScope && hydratedScope === draftScope),
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
