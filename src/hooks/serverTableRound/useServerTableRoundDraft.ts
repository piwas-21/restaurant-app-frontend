'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SetStateAction } from 'react';
import { useOptionalAuth } from '@/components/AuthContext';
import type { OrderDto } from '@/types/order';
import type { OrderItem } from '@/components/catalog/orderItems';
import type { StaffCustomerSelection } from '@/types/staffCustomer';
import { useModuleEnabled } from '@/contexts/ModulesContext';
import {
  clearServerTableRoundDraft,
  expireServerTableRoundDraft,
  persistServerTableRoundDraft,
  readServerTableRoundDraftStatus,
} from '@/lib/serverTableRoundDraft';
import { serverTableRoundScopeKey } from './useServerTableRoundScopeState';
import { emptyDraft, invalidateRound, updateRoundOperation } from './serverTableRoundDraftState';
import type { DraftIdentity, RoundOperationState, ScopedDraftState } from './serverTableRoundDraftState';

export type { RoundOperationState } from './serverTableRoundDraftState';

export function useServerTableRoundDraft(
  tableId: string,
  sessionId: string | null,
  sessionMatchesQuery: boolean,
  sessionResolved: boolean,
) {
  const loyaltyEnabled = useModuleEnabled('loyalty');
  const auth = useOptionalAuth();
  const staffUserId = auth?.user?.email;
  const draftScope = serverTableRoundScopeKey(tableId, sessionId, sessionMatchesQuery, staffUserId);
  const scopeRef = useRef(draftScope);
  scopeRef.current = draftScope;
  const [storedDraft, setStoredDraft] = useState(() => emptyDraft(null));
  const visibleDraft = storedDraft.scopeKey === draftScope ? storedDraft : emptyDraft(draftScope);
  const visibleDraftRef = useRef(visibleDraft);
  visibleDraftRef.current = visibleDraft;
  const isReady = Boolean(draftScope && visibleDraft.isReady);
  const hydrationScopeRef = useRef<string | null>(null);
  const [hydrationAttempt, setHydrationAttempt] = useState(0);
  const lastReadyIdentityRef = useRef<DraftIdentity | null>(null);

  useEffect(() => {
    if (draftScope && sessionId && sessionMatchesQuery) {
      if (hydrationScopeRef.current === draftScope) return;
      hydrationScopeRef.current = draftScope;
      const result = readServerTableRoundDraftStatus(tableId, sessionId, staffUserId);
      if (scopeRef.current !== draftScope) return;
      if (result.status === 'blocked') {
        setStoredDraft({ ...emptyDraft(draftScope), storageBlocked: true });
        return;
      }
      const stored = result.draft;
      setStoredDraft({
        ...emptyDraft(draftScope),
        isReady: true,
        items: stored?.items ?? [],
        notes: stored?.notes ?? '',
        customer: stored?.customer,
        operationId: stored?.clientOperationId,
        draftRecovered: Boolean(stored),
        operationState: stored?.clientOperationId ? 'unknown' : 'idle',
      });
      return;
    }

    hydrationScopeRef.current = null;
    if (!sessionResolved) return;
    setStoredDraft(emptyDraft(null));
    if (!sessionId) {
      const previous = lastReadyIdentityRef.current;
      if (previous?.tableId === tableId) expireServerTableRoundDraft(previous);
    }
  }, [draftScope, hydrationAttempt, sessionId, sessionMatchesQuery, sessionResolved, staffUserId, tableId]);

  useEffect(() => {
    if (!draftScope || !sessionId || !isReady) return;
    lastReadyIdentityRef.current = { tableId, serviceSessionId: sessionId, staffUserId };
  }, [draftScope, isReady, sessionId, staffUserId, tableId]);

  useEffect(() => {
    if (!draftScope || !sessionId || !sessionMatchesQuery || !isReady) return;
    const { items, notes, customer, operationId } = visibleDraft;
    const identity = { tableId, serviceSessionId: sessionId, staffUserId };
    if (!items.length && !notes.trim() && !operationId && !customer) {
      clearServerTableRoundDraft(identity);
      return;
    }
    persistServerTableRoundDraft(
      { tableId, serviceSessionId: sessionId, items, notes, customer, clientOperationId: operationId },
      staffUserId,
    );
  }, [draftScope, isReady, sessionId, sessionMatchesQuery, staffUserId, tableId, visibleDraft]);

  const canUpdateScope = useCallback(
    (scopeKey: string | null) =>
      Boolean(
        scopeKey &&
        scopeRef.current === scopeKey &&
        visibleDraftRef.current.scopeKey === scopeKey &&
        visibleDraftRef.current.isReady,
      ),
    [],
  );
  const updateDraft = useCallback(
    (scopeKey: string | null, change: (current: ScopedDraftState) => ScopedDraftState) => {
      if (!canUpdateScope(scopeKey)) return;
      setStoredDraft((current) => {
        if (!scopeKey || scopeRef.current !== scopeKey || current.scopeKey !== scopeKey || !current.isReady)
          return current;
        return change(current);
      });
    },
    [canUpdateScope],
  );

  const mutate = useCallback(
    (change: (current: OrderItem[]) => OrderItem[]) =>
      updateDraft(draftScope, (current) =>
        invalidateRound(current, { items: change(current.items), draftRecovered: false }),
      ),
    [draftScope, updateDraft],
  );
  const setItems = useCallback(
    (value: SetStateAction<OrderItem[]>) =>
      updateDraft(draftScope, (current) =>
        invalidateRound(current, { items: typeof value === 'function' ? value(current.items) : value }),
      ),
    [draftScope, updateDraft],
  );
  const setNotes = useCallback(
    (notes: string) => updateDraft(draftScope, (current) => invalidateRound(current, { notes, draftRecovered: false })),
    [draftScope, updateDraft],
  );
  const setCustomer = useCallback(
    (customer: StaffCustomerSelection | undefined) =>
      updateDraft(draftScope, (current) => invalidateRound(current, { customer, draftRecovered: false })),
    [draftScope, updateDraft],
  );
  const setOperationId = useCallback(
    (operationId: string | undefined) =>
      updateDraft(draftScope, (current) => updateRoundOperation(current, { operationId })),
    [draftScope, updateDraft],
  );
  const setQuote = useCallback(
    (quote: OrderDto | null) => updateDraft(draftScope, (current) => ({ ...current, quote })),
    [draftScope, updateDraft],
  );
  const setOperationState = useCallback(
    (operationState: RoundOperationState) =>
      updateDraft(draftScope, (current) => updateRoundOperation(current, { operationState })),
    [draftScope, updateDraft],
  );
  const setDraftRecovered = useCallback(
    (draftRecovered: boolean) => updateDraft(draftScope, (current) => ({ ...current, draftRecovered })),
    [draftScope, updateDraft],
  );
  const discardDraft = useCallback(() => {
    if (!sessionId || !canUpdateScope(draftScope) || visibleDraftRef.current.operationState === 'unknown') return;
    setStoredDraft({ ...emptyDraft(draftScope), isReady: true });
    clearServerTableRoundDraft({ tableId, serviceSessionId: sessionId, staffUserId });
  }, [canUpdateScope, draftScope, sessionId, staffUserId, tableId]);
  const markCommitted = useCallback(
    (order: OrderDto) => {
      if (!canUpdateScope(draftScope)) return;
      setStoredDraft({
        ...emptyDraft(draftScope),
        isReady: true,
        createdOrder: order,
        operationState: 'committed',
      });
      if (sessionId) clearServerTableRoundDraft({ tableId, serviceSessionId: sessionId, staffUserId });
    },
    [canUpdateScope, draftScope, sessionId, staffUserId, tableId],
  );
  const retryHydration = useCallback(() => {
    if (!draftScope || scopeRef.current !== draftScope) return;
    hydrationScopeRef.current = null;
    setHydrationAttempt((attempt) => attempt + 1);
  }, [draftScope]);

  return {
    ...visibleDraft,
    loyaltyEnabled,
    isReady,
    operationOwnerScopeKey: isReady && visibleDraft.operationId ? draftScope : null,
    storageBlocked: visibleDraft.storageBlocked,
    setItems,
    setOperationId,
    setQuote,
    setOperationState,
    setDraftRecovered,
    setNotes,
    setCustomer,
    mutate,
    discardDraft,
    markCommitted,
    retryHydration,
  };
}
