'use client';

import { useCallback } from 'react';
import { persistServerTableRoundDraft } from '@/lib/serverTableRoundDraft';
import type { ServerTableRoundScopeToken } from './useServerTableRoundScopeState';
import type { useServerTableRoundDraft } from './useServerTableRoundDraft';
import { reconcileServerTableRound, reviewServerTableRound } from './serverTableRoundReview';

type Draft = ReturnType<typeof useServerTableRoundDraft>;

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
  const review = useCallback(async () => {
    if (!isCurrentScope(scopeToken) || !canCompose || !sessionId || !draft.items.length || phase !== 'idle') return;
    setPhase('reviewing');
    setError(null);
    const operationId = draft.operationId ?? crypto.randomUUID();
    draft.setOperationId(operationId);
    persistServerTableRoundDraft(
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
      setPhase('idle');
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
    setPhase('idle');
  }, [canCompose, draft, isCurrentScope, phase, scopeToken, sessionId, setError, setPhase, staffUserId, tableId]);

  const reconcile = useCallback(async () => {
    if (!isCurrentScope(scopeToken) || !draft.operationId || phase !== 'idle') return;
    setPhase('reconciling');
    const outcome = await reconcileServerTableRound(draft.operationId);
    if (!isCurrentScope(scopeToken)) return;
    if (outcome.status === 'committed' && outcome.order) {
      draft.markCommitted(outcome.order);
      setError(null);
    } else {
      draft.setOperationState('unknown');
      setError(outcome.error ?? 'server.round.operation_unknown');
    }
    setPhase('idle');
  }, [draft, isCurrentScope, phase, scopeToken, setError, setPhase]);

  return { review, reconcile };
}
