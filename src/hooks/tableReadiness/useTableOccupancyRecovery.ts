'use client';

import { useCallback, useRef, useState } from 'react';
import { reportCashierRecoveryFailure } from '@/lib/cashierRecoveryDiagnostics';
import { clearPendingTableOccupancyRecovery } from '@/lib/pendingTableOccupancyRecovery';
import {
  getTableOccupancyRecoveryOperation,
  occupancyRecoveryResponseMatches,
  recoverTableOccupancy,
  TableOccupancyRecoveryTerminalRefusal,
} from '@/services/tableOccupancyRecoveryService';
import type { PendingTableOccupancyRecovery, TableOccupancyRecoveryOperation } from '@/types/tableOccupancyRecovery';
import type {
  RecoveryState as State,
  UseTableOccupancyRecoveryInput as Input,
} from './useTableOccupancyRecovery.types';
import { useRestoreTableOccupancyRecovery } from './useRestoreTableOccupancyRecovery';
import { useTableOccupancyRecoveryPreview } from './useTableOccupancyRecoveryPreview';

/** Keep one audited operation identity through preview, confirm, lost response, and readback. */
export function useTableOccupancyRecovery({
  actorId,
  actorRole,
  tableId,
  serviceSessionId,
  canWrite,
  onRecovered,
}: Input) {
  const [state, setState] = useState<State>({ stage: 'checking' });
  const [reason, setReason] = useState('');
  const pending = useRef<PendingTableOccupancyRecovery | null>(null);
  const inFlight = useRef(false);
  const generation = useRef(0);
  const mounted = useRef(false);
  const recoveredRef = useRef(onRecovered);
  recoveredRef.current = onRecovered;

  const acceptOperation = useCallback(
    async (saved: PendingTableOccupancyRecovery, result: TableOccupancyRecoveryOperation) => {
      if (!occupancyRecoveryResponseMatches(result, saved.tableId, saved.request)) {
        setState({ stage: 'unavailable', error: 'operation_mismatch' });
        return;
      }
      if (!clearPendingTableOccupancyRecovery(saved)) {
        setState({ stage: 'unavailable', operation: result });
        return;
      }
      pending.current = null;
      setState({ stage: 'settled', operation: result, currency: saved.currency });
      await recoveredRef.current().catch(() => undefined);
    },
    [],
  );

  const readback = useCallback(
    async (saved: PendingTableOccupancyRecovery) => {
      if (inFlight.current) return;
      inFlight.current = true;
      const requestGeneration = ++generation.current;
      setState({ stage: 'working' });
      try {
        const result = await getTableOccupancyRecoveryOperation(saved.tableId, saved.request.operationId);
        if (!mounted.current || generation.current !== requestGeneration) return;
        if (result) await acceptOperation(saved, result);
        else setState({ stage: 'pending' });
      } catch (error: unknown) {
        reportCashierRecoveryFailure('read table recovery', error);
        if (mounted.current && generation.current === requestGeneration) setState({ stage: 'pending' });
      } finally {
        if (generation.current === requestGeneration) inFlight.current = false;
      }
    },
    [acceptOperation],
  );

  const replay = useCallback(
    async (saved: PendingTableOccupancyRecovery) => {
      if (inFlight.current) return;
      inFlight.current = true;
      const requestGeneration = ++generation.current;
      setState({ stage: 'working' });
      try {
        const result = await recoverTableOccupancy(saved.tableId, saved.request);
        if (!mounted.current || generation.current !== requestGeneration) return;
        await acceptOperation(saved, result);
      } catch (_error: unknown) {
        // Keep the original journal: a lost response must not create a second recovery operation.
        if (!mounted.current || generation.current !== requestGeneration) return;
        if (_error instanceof TableOccupancyRecoveryTerminalRefusal) {
          if (!clearPendingTableOccupancyRecovery(saved)) {
            setState({ stage: 'unavailable', error: 'storage_unavailable' });
            return;
          }
          pending.current = null;
          setState({ stage: 'failed', error: _error.code });
          return;
        }
        setState({ stage: 'pending' });
      } finally {
        if (generation.current === requestGeneration) inFlight.current = false;
      }
    },
    [acceptOperation],
  );

  useRestoreTableOccupancyRecovery({
    actorId,
    actorRole,
    tableId,
    serviceSessionId,
    pending,
    generation,
    inFlight,
    mounted,
    setState,
    readback,
  });

  const { startPreview, closePreview, confirm } = useTableOccupancyRecoveryPreview({
    actorId,
    actorRole,
    tableId,
    serviceSessionId,
    canWrite,
    state,
    reason,
    setReason,
    setState,
    pending,
    inFlight,
    replay,
  });

  const check = useCallback(async () => {
    if (pending.current) await readback(pending.current);
  }, [readback]);
  const retry = useCallback(async () => {
    if (canWrite && pending.current) await replay(pending.current);
  }, [canWrite, replay]);

  return {
    ...state,
    hasPendingOperation:
      pending.current !== null ||
      state.stage === 'checking' ||
      state.stage === 'pending' ||
      state.stage === 'working' ||
      state.stage === 'unavailable',
    reason,
    setReason,
    startPreview,
    closePreview,
    confirm,
    check,
    retry,
  };
}
