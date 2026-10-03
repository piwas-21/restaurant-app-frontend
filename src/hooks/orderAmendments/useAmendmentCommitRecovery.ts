'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { OrderAmendmentCommitResult, OrderAmendmentOperationLookup } from '@/types/orderAmendment';
import { lookupOrderAmendmentOperation } from '@/services/orderAmendmentsService';
import {
  amendmentErrorMessage,
  amendmentOperationCommitted,
  amendmentOperationUnknown,
  amendmentExpiryPassed,
  canRequoteUnknownAmendment,
  sameAmendmentId,
} from './orderAmendmentOperationState';
import {
  clearPendingAmendmentCommit,
  readPendingAmendmentCommit,
  type PendingAmendmentCommit,
} from './pendingAmendmentCommit';
import { useAmendmentCommitActions, type CommitPhase } from './useAmendmentCommitActions';

export function useAmendmentCommitRecovery(
  sourceOrderId: string,
  actorId: string | undefined,
  onCommitted?: () => void,
) {
  const [phase, setPhase] = useState<CommitPhase>('idle');
  const [readyIdentity, setReadyIdentity] = useState<string | null>(null);
  const [loadedIdentity, setLoadedIdentity] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAmendmentCommit | null>(null);
  const [operationLookup, setOperationLookup] = useState<OrderAmendmentOperationLookup | null>(null);
  const [result, setResult] = useState<OrderAmendmentCommitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lookupSequence = useRef(0);
  const mounted = useRef(false);
  const committedCallback = useRef(onCommitted);
  const notifiedOperation = useRef<string | null>(null);
  committedCallback.current = onCommitted;
  const identity = actorId ? `${actorId}\u0000${sourceOrderId}` : null;
  const isReady = identity !== null && readyIdentity === identity;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      lookupSequence.current += 1;
    };
  }, []);

  const confirmCommitted = useCallback(
    (saved: PendingAmendmentCommit, committed: OrderAmendmentCommitResult) => {
      if (
        !sameAmendmentId(committed.clientOperationId, saved.request.clientOperationId) ||
        !sameAmendmentId(committed.amendmentId, saved.request.amendmentId) ||
        !sameAmendmentId(committed.sourceOrderId, sourceOrderId)
      ) {
        throw new Error('orderAmendments.operation_identity_mismatch');
      }
      setResult(committed);
      setPhase('committed');
      setOperationLookup(null);
      clearPendingAmendmentCommit(saved.actorId, saved.sourceOrderId, saved.request.clientOperationId);
      if (notifiedOperation.current !== saved.request.clientOperationId) {
        notifiedOperation.current = saved.request.clientOperationId;
        committedCallback.current?.();
      }
    },
    [sourceOrderId],
  );

  const lookup = useCallback(
    async (saved: PendingAmendmentCommit): Promise<void> => {
      const requestId = ++lookupSequence.current;
      setError(null);
      try {
        const found = await lookupOrderAmendmentOperation(saved.request.clientOperationId);
        if (!mounted.current || requestId !== lookupSequence.current) return;
        if (!sameAmendmentId(found.operationId, saved.request.clientOperationId)) {
          throw new Error('orderAmendments.operation_identity_mismatch');
        }
        if (amendmentOperationCommitted(found) && found.result) {
          confirmCommitted(saved, found.result);
          return;
        }
        setOperationLookup(found);
        setPhase('uncertain');
      } catch (reason: unknown) {
        if (!mounted.current || requestId !== lookupSequence.current) return;
        setError(amendmentErrorMessage(reason, 'orderAmendments.operation_lookup_failed'));
        setPhase('uncertain');
      }
    },
    [confirmCommitted],
  );

  useEffect(() => {
    lookupSequence.current += 1;
    setReadyIdentity(null);
    setLoadedIdentity(null);
    setPending(null);
    setOperationLookup(null);
    setResult(null);
    setError(null);
    setPhase('idle');
    if (!actorId) {
      setError('orderAmendments.actor_unavailable');
      return;
    }

    const saved = readPendingAmendmentCommit(actorId, sourceOrderId);
    if (saved.status === 'unavailable') {
      setError('orderAmendments.recovery_unavailable');
      setLoadedIdentity(identity);
      return;
    }
    setReadyIdentity(identity);
    setLoadedIdentity(identity);
    if (saved.status === 'pending') {
      setPending(saved.value);
      setPhase('uncertain');
      void lookup(saved.value);
    }
  }, [actorId, identity, lookup, sourceOrderId]);

  const checkOperation = useCallback(() => {
    if (isReady && pending) void lookup(pending);
  }, [isReady, lookup, pending]);
  const actions = useAmendmentCommitActions({
    actorId,
    sourceOrderId,
    isReady,
    phase,
    pending,
    operationLookup,
    setPhase,
    setPending,
    setOperationLookup,
    setResult,
    setError,
    confirmCommitted,
    lookup,
    lookupSequence,
    mounted,
  });

  let visibleError: string | null;
  if (isReady || loadedIdentity === identity) {
    visibleError = error;
  } else if (actorId) {
    visibleError = null;
  } else {
    visibleError = 'orderAmendments.actor_unavailable';
  }

  return {
    phase: isReady ? phase : 'idle',
    isReady,
    clientOperationId: isReady ? (pending?.request.clientOperationId ?? null) : null,
    commitRequest: isReady ? (pending?.request ?? null) : null,
    operationExpiresAt: isReady ? pending?.expiresAt : undefined,
    operationLookup: isReady ? operationLookup : null,
    result: isReady ? result : null,
    error: visibleError,
    canRetrySameCommit: Boolean(
      isReady &&
      pending &&
      operationLookup &&
      sameAmendmentId(operationLookup.operationId, pending.request.clientOperationId) &&
      amendmentOperationUnknown(operationLookup) &&
      !amendmentExpiryPassed(pending.expiresAt),
    ),
    canRequote: isReady && canRequoteUnknownAmendment(operationLookup, pending?.expiresAt),
    ...actions,
    checkOperation,
  };
}
