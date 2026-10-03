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
}
interface Input {
  readonly actorId: string;
  readonly actorRole: PendingTableReadiness['actorRole'];
  readonly tableId: string;
  readonly readinessVersion?: number | null;
  readonly canStart: boolean;
  readonly snapshot: object;
  readonly refresh: () => Promise<void>;
}

/** Mounted with an actor/role/table key; never replace an unresolved operation after refresh. */
export function useTableReadiness({
  actorId,
  actorRole,
  tableId,
  readinessVersion,
  canStart,
  snapshot,
  refresh,
}: Input) {
  const [state, setState] = useState<State>({ stage: 'checking' });
  const pending = useRef<PendingTableReadiness | null>(null);
  const inFlight = useRef(false);
  const generation = useRef(0);
  const mounted = useRef(false);
  const settledSnapshot = useRef<object | undefined>(undefined);
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  const run = useCallback(async (operation: PendingTableReadiness, write: boolean) => {
    if (inFlight.current) return;
    inFlight.current = true;
    const requestGeneration = ++generation.current;
    setState({ stage: 'working' });
    try {
      const result = await (write
        ? markTableReady(operation.tableId, operation.request)
        : lookupTableReadiness(operation.tableId, operation.request));
      if (!mounted.current || generation.current !== requestGeneration) return;
      if (result.kind === 'succeeded' || result.terminal) {
        if (!clearPendingTableReadiness(operation)) {
          setState({ stage: 'unavailable' });
          return;
        }
        pending.current = null;
        settledSnapshot.current = snapshotRef.current;
        setState({ stage: 'settled', result });
        void refreshRef.current().catch(() => undefined);
      } else {
        setState({ stage: 'pending', result });
      }
    } catch (_error: unknown) {
      if (mounted.current && generation.current === requestGeneration) setState({ stage: 'pending' });
    } finally {
      if (generation.current === requestGeneration) inFlight.current = false;
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

  useEffect(() => {
    if (state.stage === 'settled' && canStart && snapshot !== settledSnapshot.current) {
      setState({ stage: 'idle' });
    }
  }, [canStart, snapshot, state.stage]);

  const start = useCallback(async () => {
    if (
      inFlight.current ||
      state.stage !== 'idle' ||
      !canStart ||
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
    } catch (_error: unknown) {
      setState({ stage: 'unavailable' });
    }
  }, [actorId, actorRole, canStart, readinessVersion, run, state.stage, tableId]);

  const check = useCallback(async () => {
    if (pending.current) await run(pending.current, false);
  }, [run]);
  const retry = useCallback(async () => {
    if (pending.current) await run(pending.current, true);
  }, [run]);
  return { ...state, start, check, retry };
}
