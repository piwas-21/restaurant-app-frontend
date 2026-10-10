'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clearPendingTableReadiness,
  persistPendingTableReadiness,
  readPendingTableReadiness,
} from '@/lib/pendingTableReadiness';
import { lookupTableReadiness, markTableReady } from '@/services/tableReadinessService';
import type { PendingTableReadiness, TableReadinessResult } from '@/types/tableReadiness';

type Stage = 'checking' | 'idle' | 'pending' | 'working' | 'settled' | 'unavailable';
interface State {
  readonly stage: Stage;
  readonly result?: TableReadinessResult;
  readonly operation?: PendingTableReadiness;
}
interface Input {
  readonly actorId: string;
  readonly actorRole: PendingTableReadiness['actorRole'];
  readonly tableId: string;
  readonly readinessState?: string | null;
  readonly readinessVersion?: number | null;
  readonly canStart: boolean;
  readonly isStale?: boolean;
  readonly refresh: () => Promise<void>;
  readonly onConfirmedReady?: (result: Extract<TableReadinessResult, { kind: 'succeeded' }>['outcome']) => void;
}

/** Mounted with an actor/role/table key; never replace an unresolved operation after refresh. */
export function useTableReadiness({
  actorId,
  actorRole,
  tableId,
  readinessState,
  readinessVersion,
  canStart,
  isStale = false,
  refresh,
  onConfirmedReady,
}: Input) {
  const [state, setState] = useState<State>({ stage: 'checking' });
  const pending = useRef<PendingTableReadiness | null>(null);
  const inFlight = useRef(false);
  const generation = useRef(0);
  const mounted = useRef(false);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const onConfirmedReadyRef = useRef(onConfirmedReady);
  onConfirmedReadyRef.current = onConfirmedReady;

  const run = useCallback(async (operation: PendingTableReadiness, write: boolean) => {
    if (inFlight.current) return;
    inFlight.current = true;
    const requestGeneration = ++generation.current;
    setState({ stage: 'working' });
    let outcomeHandled = false;
    try {
      const result = await (write
        ? markTableReady(operation.tableId, operation.request)
        : lookupTableReadiness(operation.tableId, operation.request));
      if (!mounted.current || generation.current !== requestGeneration) return;
      if (result.kind === 'succeeded' || result.terminal) {
        if (!clearPendingTableReadiness(operation)) {
          setState({ stage: 'unavailable' });
          outcomeHandled = true;
          return;
        }
        pending.current = null;
        setState({ stage: 'settled', result, operation });
        void refreshRef.current().catch(() => undefined);
      } else {
        setState({ stage: 'pending', result });
      }
      outcomeHandled = true;
    } catch (_error: unknown) {
      // A lost response cannot settle the operation; retain its original journal for recovery.
    } finally {
      if (generation.current === requestGeneration) {
        if (!outcomeHandled && mounted.current) setState({ stage: 'pending' });
        inFlight.current = false;
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const saved = readPendingTableReadiness(actorId, actorRole, tableId);
    if (saved.status === 'none') setState({ stage: 'idle' });
    else if (saved.status === 'unavailable') setState({ stage: 'unavailable' });
    else {
      pending.current = saved.value;
      void run(saved.value, false);
    }
    return () => {
      mounted.current = false;
      generation.current += 1;
      inFlight.current = false;
    };
  }, [actorId, actorRole, run, tableId]);

  const success = state.stage === 'settled' && state.result?.kind === 'succeeded' ? state.result : null;
  const confirmedReady = Boolean(
    success &&
    state.operation &&
    state.operation.tableId.toLowerCase() === tableId.toLowerCase() &&
    success.outcome.tableId.toLowerCase() === tableId.toLowerCase() &&
    readinessState === 'ReadyForGuests' &&
    Number.isSafeInteger(readinessVersion) &&
    (readinessVersion ?? 0) >= success.outcome.readinessVersion &&
    success.outcome.readinessVersion > state.operation.request.expectedReadinessVersion &&
    !isStale,
  );

  useEffect(() => {
    if (!confirmedReady || !success) return;
    setState({ stage: 'idle' });
    onConfirmedReadyRef.current?.(success.outcome);
  }, [confirmedReady, success]);

  const canRetryRefusal = Boolean(
    state.stage === 'settled' &&
    state.result?.kind === 'refused' &&
    state.result.terminal &&
    state.operation &&
    state.operation.tableId.toLowerCase() === tableId.toLowerCase() &&
    canStart &&
    !isStale &&
    Number.isSafeInteger(readinessVersion) &&
    (state.result.code === 'TableReadinessVersionStale'
      ? (readinessVersion ?? 0) > state.operation.request.expectedReadinessVersion
      : (readinessVersion ?? 0) >= state.operation.request.expectedReadinessVersion),
  );

  const start = useCallback(async () => {
    const retryingRefusal = state.stage === 'settled' && state.result?.kind === 'refused' && canRetryRefusal;
    if (
      inFlight.current ||
      (state.stage !== 'idle' && !retryingRefusal) ||
      !canStart ||
      isStale ||
      !Number.isSafeInteger(readinessVersion) ||
      (readinessVersion ?? 0) <= 0
    )
      return;
    const saved = readPendingTableReadiness(actorId, actorRole, tableId);
    if (saved.status !== 'none') {
      setState({ stage: saved.status === 'pending' ? 'pending' : 'unavailable' });
      pending.current = saved.status === 'pending' ? saved.value : null;
      return;
    }
    try {
      const operation: PendingTableReadiness = {
        actorId,
        actorRole,
        tableId,
        request: { operationId: crypto.randomUUID(), expectedReadinessVersion: readinessVersion as number },
      };
      if (!persistPendingTableReadiness(operation)) {
        setState({ stage: 'unavailable' });
        return;
      }
      pending.current = operation;
      await run(operation, true);
      return;
    } catch (_error: unknown) {
      // Crypto or storage failure prevents a safe request, so leave readiness unavailable.
    }
    setState({ stage: 'unavailable' });
  }, [
    actorId,
    actorRole,
    canRetryRefusal,
    canStart,
    isStale,
    readinessVersion,
    run,
    state.result,
    state.stage,
    tableId,
  ]);

  const check = useCallback(async () => {
    if (pending.current) await run(pending.current, false);
  }, [run]);
  const retry = useCallback(async () => {
    if (pending.current) await run(pending.current, true);
  }, [run]);
  return { ...state, canRetryRefusal, start, check, retry };
}
