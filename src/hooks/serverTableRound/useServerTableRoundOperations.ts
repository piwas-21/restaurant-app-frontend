'use client';

import { useCallback, useRef } from 'react';
import { persistServerTableRoundDraft } from '@/lib/serverTableRoundDraft';
import type { ServerTableRoundScopeToken } from './useServerTableRoundScopeState';
import type { useServerTableRoundDraft } from './useServerTableRoundDraft';
import { reconcileServerTableRound, reviewServerTableRound } from './serverTableRoundReview';

type Draft = ReturnType<typeof useServerTableRoundDraft>;

function hasCurrentDraft(draft: Draft, scopeToken: ServerTableRoundScopeToken): boolean {
  return draft.isReady && draft.scopeKey === scopeToken.key;
}

function hasReviewableOperation(draft: Draft, scopeToken: ServerTableRoundScopeToken): boolean {
  return (!draft.operationId || draft.operationOwnerScopeKey === scopeToken.key) && draft.operationState !== 'unknown';
}

interface Parameters {
  readonly tableId: string;
  readonly sessionId: string | null;
  readonly staffUserId?: string;
  readonly draft: Draft;
  readonly canCompose: boolean;
  readonly phase: 'idle' | 'reviewing' | 'reconciling';
  readonly setPhase: (phase: 'idle' | 'reviewing' | 'reconciling') => void;
  readonly setError: (error: string | null) => void;
  readonly scopeToken: ServerTableRoundScopeToken;
  readonly isCurrentScope: (token: ServerTableRoundScopeToken) => boolean;
}

export function useServerTableRoundOperations({
  tableId,
  sessionId,
  staffUserId,
  draft,
  canCompose,
  phase,
  setPhase,
  setError,
  scopeToken,
  isCurrentScope,
}: Parameters) {
  const inFlightScopes = useRef(new Set<ServerTableRoundScopeToken>());

  const review = useCallback(async () => {
    if (
      !isCurrentScope(scopeToken) ||
      !hasCurrentDraft(draft, scopeToken) ||
      !hasReviewableOperation(draft, scopeToken) ||
      !canCompose ||
      !sessionId ||
      !draft.items.length ||
      phase !== 'idle' ||
      inFlightScopes.current.has(scopeToken)
    )
      return;
    inFlightScopes.current.add(scopeToken);
    setPhase('reviewing');
    try {
      setError(null);
      const operationId = draft.operationId ?? crypto.randomUUID();
      draft.setOperationId(operationId);
      const persisted = persistServerTableRoundDraft(
        {
          tableId,
          serviceSessionId: sessionId,
          items: draft.items,
          notes: draft.notes,
          customer: draft.customer,
          clientOperationId: operationId,
        },
        staffUserId,
      );
      if (!persisted) {
        draft.setOperationId(undefined);
        setError('server.round.draft_storage_unavailable');
        return;
      }
      const outcome = await reviewServerTableRound({
        tableId,
        serviceSessionId: sessionId,
        items: draft.items,
        notes: draft.notes,
        customer: draft.customer,
        loyaltyEnabled: draft.loyaltyEnabled,
        storedOperationId: operationId,
      });
      if (!isCurrentScope(scopeToken)) return;
      if (outcome.quote) draft.setQuote(outcome.quote);
      if (outcome.status === 'committed' && outcome.order) {
        draft.markCommitted(outcome.order);
        return;
      }
      if (outcome.status === 'unknown') {
        const reconciled = await reconcileServerTableRound(operationId);
        if (!isCurrentScope(scopeToken)) return;
        if (reconciled.status === 'committed' && reconciled.order) draft.markCommitted(reconciled.order);
        else {
          draft.setOperationState('unknown');
          setError(reconciled.error ?? outcome.error ?? 'server.round.operation_unknown');
        }
      } else {
        draft.setOperationState('failed');
        setError(outcome.error ?? 'server.round.review_failed');
      }
    } finally {
      inFlightScopes.current.delete(scopeToken);
      if (isCurrentScope(scopeToken)) setPhase('idle');
    }
  }, [canCompose, draft, isCurrentScope, phase, scopeToken, sessionId, setError, setPhase, staffUserId, tableId]);

  const reconcile = useCallback(async () => {
    if (
      !isCurrentScope(scopeToken) ||
      !hasCurrentDraft(draft, scopeToken) ||
      !draft.operationId ||
      draft.operationOwnerScopeKey !== scopeToken.key ||
      phase !== 'idle' ||
      inFlightScopes.current.has(scopeToken)
    )
      return;
    inFlightScopes.current.add(scopeToken);
    setPhase('reconciling');
    try {
      const outcome = await reconcileServerTableRound(draft.operationId);
      if (!isCurrentScope(scopeToken)) return;
      if (outcome.status === 'committed' && outcome.order) {
        draft.markCommitted(outcome.order);
        setError(null);
      } else {
        draft.setOperationState('unknown');
        setError(outcome.error ?? 'server.round.operation_unknown');
      }
    } finally {
      inFlightScopes.current.delete(scopeToken);
      if (isCurrentScope(scopeToken)) setPhase('idle');
    }
  }, [draft, isCurrentScope, phase, scopeToken, setError, setPhase]);

  return { review, reconcile };
}
