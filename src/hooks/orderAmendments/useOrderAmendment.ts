'use client';

import { useCallback, useState } from 'react';
import { useOptionalAuth } from '@/components/AuthContext';
import type { OrderDto } from '@/types/order';
import type { OrderAmendmentQuote } from '@/types/orderAmendment';
import { getTableServiceSession } from '@/services/tableServiceSessionService';
import { getServerOrderById } from '@/services/server/orders';
import { quoteOrderAmendment } from '@/services/orderAmendmentsService';
import type { OrderAmendmentDraft } from './orderAmendmentTypes';
import { amendmentErrorMessage, amendmentExpiryPassed } from './orderAmendmentOperationState';
import { useAmendmentCommitRecovery } from './useAmendmentCommitRecovery';

export function useOrderAmendment(order: OrderDto, onCommitted?: () => void, resolvedActorId?: string) {
  const auth = useOptionalAuth();
  const actorId = resolvedActorId ?? auth?.user?.userId;
  const recovery = useAmendmentCommitRecovery(order.id, actorId, onCommitted);
  const [quotePhase, setQuotePhase] = useState<'editing' | 'quoting' | 'review'>('editing');
  const [quote, setQuote] = useState<OrderAmendmentQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const phase = recovery.phase === 'idle' ? quotePhase : recovery.phase;

  const prepareQuote = useCallback(
    async (draft: OrderAmendmentDraft) => {
      if (!recovery.isReady || recovery.phase !== 'idle') return;
      setQuotePhase('quoting');
      setQuoteError(null);
      try {
        const freshOrder = await getServerOrderById(order.id);
        if (freshOrder.id.toLowerCase() !== order.id.toLowerCase()) {
          throw new Error('orderAmendments.order_unavailable');
        }
        if (freshOrder.version !== order.version) {
          throw new Error('orderAmendments.order_changed_refresh');
        }
        if (freshOrder.externalOrder && draft.changes.length > 0) {
          throw new Error('orderAmendments.provider_changes_blocked');
        }

        let expectedAccountRevision: number | undefined;
        if (freshOrder.type === 'DineIn' && !freshOrder.serviceSessionId) {
          throw new Error('orderAmendments.visit_unavailable');
        }
        if (freshOrder.serviceSessionId) {
          const session = await getTableServiceSession(freshOrder.serviceSessionId);
          if (session.serviceSessionId !== freshOrder.serviceSessionId || session.status !== 'Open') {
            throw new Error('orderAmendments.visit_unavailable');
          }
          if (typeof session.accountRevision !== 'number' || !Number.isSafeInteger(session.accountRevision)) {
            throw new TypeError('orderAmendments.account_revision_unavailable');
          }
          expectedAccountRevision = session.accountRevision;
        }

        const prepared = await quoteOrderAmendment(order.id, {
          expectedOrderVersion: freshOrder.version,
          ...(expectedAccountRevision !== undefined ? { expectedAccountRevision } : {}),
          reason: draft.reason.trim() || undefined,
          reviewAcknowledged: false,
          preparingOverrideAcknowledged: draft.preparingOverrideAcknowledged,
          releaseAdditionsToKitchen: draft.releaseAdditionsToKitchen,
          localProviderSupplementConsent: draft.localProviderSupplementConsent,
          providerConsentNote: draft.providerConsentNote.trim() || undefined,
          additions: draft.additions,
          changes: draft.changes,
        });
        if (prepared.sourceOrderId.toLowerCase() !== order.id.toLowerCase()) {
          throw new Error('orderAmendments.order_unavailable');
        }
        setQuote(prepared);
        setQuotePhase('review');
      } catch (reason: unknown) {
        setQuoteError(amendmentErrorMessage(reason, 'orderAmendments.quote_failed'));
        setQuotePhase('editing');
      }
    },
    [order.id, order.version, recovery.isReady, recovery.phase],
  );

  const commit = useCallback(async () => {
    if (!quote || phase !== 'review' || amendmentExpiryPassed(quote.expiresAt)) {
      setQuoteError('orderAmendments.quote_expired');
      setQuote(null);
      setQuotePhase('editing');
      return;
    }
    await recovery.commit(quote);
  }, [phase, quote, recovery]);

  const reset = useCallback(() => {
    if (recovery.phase !== 'idle' && !recovery.canRequote) return;
    recovery.reset();
    setQuote(null);
    setQuoteError(null);
    setQuotePhase('editing');
  }, [recovery]);

  return {
    phase,
    quote,
    result: recovery.result,
    clientOperationId: recovery.clientOperationId,
    commitRequest: recovery.commitRequest,
    operationLookup: recovery.operationLookup,
    operationExpiresAt: recovery.operationExpiresAt,
    error: recovery.error ?? quoteError,
    recoveryReady: recovery.isReady,
    canRetrySameCommit: recovery.canRetrySameCommit,
    canRequote: recovery.canRequote,
    prepareQuote,
    commit,
    checkOperation: recovery.checkOperation,
    retrySameCommit: recovery.retrySameCommit,
    reset,
  };
}
