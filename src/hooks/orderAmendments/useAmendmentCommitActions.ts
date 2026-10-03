'use client';

import { useCallback, useRef } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type {
  OrderAmendmentCommitRequest,
  OrderAmendmentCommitResult,
  OrderAmendmentOperationLookup,
  OrderAmendmentQuote,
} from '@/types/orderAmendment';
import { commitOrderAmendment } from '@/services/orderAmendmentsService';
import {
  amendmentErrorMessage,
  amendmentExpiryPassed,
  amendmentOperationUnknown,
  canRequoteUnknownAmendment,
  newAmendmentOperationId,
  sameAmendmentId,
} from './orderAmendmentOperationState';
import {
  clearPendingAmendmentCommit,
  persistPendingAmendmentCommit,
  type PendingAmendmentCommit,
} from './pendingAmendmentCommit';

export type CommitPhase = 'idle' | 'committing' | 'uncertain' | 'committed';

interface RecoveryActionOptions {
  readonly actorId?: string;
  readonly sourceOrderId: string;
  readonly isReady: boolean;
  readonly phase: CommitPhase;
  readonly pending: PendingAmendmentCommit | null;
  readonly operationLookup: OrderAmendmentOperationLookup | null;
  readonly setPhase: Dispatch<SetStateAction<CommitPhase>>;
  readonly setPending: Dispatch<SetStateAction<PendingAmendmentCommit | null>>;
  readonly setOperationLookup: Dispatch<SetStateAction<OrderAmendmentOperationLookup | null>>;
  readonly setResult: Dispatch<SetStateAction<OrderAmendmentCommitResult | null>>;
  readonly setError: Dispatch<SetStateAction<string | null>>;
  readonly confirmCommitted: (saved: PendingAmendmentCommit, result: OrderAmendmentCommitResult) => void;
  readonly lookup: (saved: PendingAmendmentCommit) => Promise<void>;
  readonly lookupSequence: MutableRefObject<number>;
  readonly mounted: MutableRefObject<boolean>;
}

export function useAmendmentCommitActions(options: RecoveryActionOptions) {
  const commitInFlight = useRef(false);
  const postCommit = useCallback(
    async (saved: PendingAmendmentCommit): Promise<void> => {
      const requestId = ++options.lookupSequence.current;
      options.setPhase('committing');
      options.setError(null);
      try {
        const committed = await commitOrderAmendment(options.sourceOrderId, saved.request);
        if (options.mounted.current && requestId === options.lookupSequence.current) {
          options.confirmCommitted(saved, committed);
        }
      } catch (reason: unknown) {
        if (!options.mounted.current || requestId !== options.lookupSequence.current) return;
        options.setError(amendmentErrorMessage(reason, 'orderAmendments.commit_uncertain'));
        options.setPhase('uncertain');
        await options.lookup(saved);
      }
    },
    [options],
  );

  const commit = useCallback(
    async (quote: OrderAmendmentQuote): Promise<void> => {
      if (!options.isReady || options.phase !== 'idle' || commitInFlight.current) return;
      if (!options.actorId) {
        options.setError('orderAmendments.actor_unavailable');
        return;
      }
      commitInFlight.current = true;
      try {
        const request: OrderAmendmentCommitRequest = {
          amendmentId: quote.amendmentId,
          clientOperationId: newAmendmentOperationId(),
          expectedOrderVersion: quote.expectedOrderVersion,
          ...(quote.expectedAccountRevision !== undefined && quote.expectedAccountRevision !== null
            ? { expectedAccountRevision: quote.expectedAccountRevision }
            : {}),
          reviewAcknowledged: true,
        };
        const saved: PendingAmendmentCommit = {
          actorId: options.actorId,
          sourceOrderId: options.sourceOrderId,
          request,
          expiresAt: quote.expiresAt,
        };
        if (!persistPendingAmendmentCommit(saved)) {
          options.setError('orderAmendments.recovery_unavailable');
          return;
        }
        options.setPending(saved);
        await postCommit(saved);
      } catch (reason: unknown) {
        options.setError(amendmentErrorMessage(reason, 'orderAmendments.commit_failed'));
      } finally {
        commitInFlight.current = false;
      }
    },
    [options, postCommit],
  );

  const retrySameCommit = useCallback(async (): Promise<void> => {
    const { pending, operationLookup } = options;
    if (!pending || commitInFlight.current) return;
    if (
      !operationLookup ||
      !sameAmendmentId(operationLookup.operationId, pending.request.clientOperationId) ||
      !amendmentOperationUnknown(operationLookup) ||
      amendmentExpiryPassed(pending.expiresAt)
    ) {
      options.setError('orderAmendments.commit_uncertain');
      return;
    }
    commitInFlight.current = true;
    try {
      await postCommit(pending);
    } finally {
      commitInFlight.current = false;
    }
  }, [options, postCommit]);

  const reset = useCallback(() => {
    const { actorId, pending, operationLookup, sourceOrderId } = options;
    if (pending) {
      if (!canRequoteUnknownAmendment(operationLookup, pending.expiresAt)) return;
      if (!clearPendingAmendmentCommit(actorId ?? '', sourceOrderId, pending.request.clientOperationId)) {
        options.setError('orderAmendments.recovery_unavailable');
        return;
      }
    }
    options.setPending(null);
    options.setOperationLookup(null);
    options.setResult(null);
    options.setError(null);
    options.setPhase('idle');
  }, [options]);

  return { commit, retrySameCommit, reset };
}
