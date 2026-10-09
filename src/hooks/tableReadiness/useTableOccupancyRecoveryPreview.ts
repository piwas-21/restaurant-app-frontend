'use client';

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { reportCashierRecoveryFailure } from '@/lib/cashierRecoveryDiagnostics';
import {
  persistPendingTableOccupancyRecovery,
  readPendingTableOccupancyRecovery,
} from '@/lib/pendingTableOccupancyRecovery';
import {
  occupancyRecoveryPreviewMatches,
  previewTableOccupancyRecovery,
} from '@/services/tableOccupancyRecoveryService';
import type { PendingTableOccupancyRecovery } from '@/types/tableOccupancyRecovery';
import type { RecoveryState, UseTableOccupancyRecoveryInput } from './useTableOccupancyRecovery.types';

interface RecoveryPreviewInput extends Pick<
  UseTableOccupancyRecoveryInput,
  'actorId' | 'actorRole' | 'tableId' | 'serviceSessionId' | 'canWrite'
> {
  readonly state: RecoveryState;
  readonly reason: string;
  readonly setReason: (reason: string) => void;
  readonly setState: Dispatch<SetStateAction<RecoveryState>>;
  readonly pending: MutableRefObject<PendingTableOccupancyRecovery | null>;
  readonly inFlight: MutableRefObject<boolean>;
  readonly replay: (saved: PendingTableOccupancyRecovery) => Promise<void>;
}

export function useTableOccupancyRecoveryPreview({
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
}: RecoveryPreviewInput) {
  const startPreview = useCallback(async () => {
    if (!canWrite || (state.stage !== 'idle' && state.stage !== 'failed') || inFlight.current) return;
    const saved = readPendingTableOccupancyRecovery(actorId, tableId, actorRole);
    if (saved.status === 'role_mismatch') {
      pending.current = null;
      setState({ stage: 'unavailable', error: 'role_mismatch' });
      return;
    }
    if (saved.status !== 'none') {
      pending.current = saved.status === 'pending' ? saved.value : null;
      setState({
        stage: saved.status === 'pending' ? 'pending' : 'unavailable',
        error: saved.status === 'pending' ? undefined : 'storage_unavailable',
      });
      return;
    }
    setState({ stage: 'previewing' });
    try {
      const preview = await previewTableOccupancyRecovery(tableId, serviceSessionId);
      if (!occupancyRecoveryPreviewMatches(preview, tableId, serviceSessionId)) {
        setState({ stage: 'failed', error: 'operation_mismatch' });
        return;
      }
      setReason('');
      setState({ stage: 'previewed', preview, currency: preview.currency });
    } catch (error: unknown) {
      reportCashierRecoveryFailure('preview table recovery', error);
      setState({ stage: 'failed', error: 'preview_failed' });
    }
  }, [actorId, actorRole, canWrite, inFlight, pending, serviceSessionId, setReason, setState, state.stage, tableId]);

  const closePreview = useCallback(() => {
    if (state.stage === 'previewed' || state.stage === 'failed') setState({ stage: 'idle' });
  }, [setState, state.stage]);

  const confirm = useCallback(async () => {
    const preview = state.preview;
    if (!canWrite || state.stage !== 'previewed' || !preview || inFlight.current) return;
    if (!reason.trim()) {
      setState({ ...state, error: 'reason_required' });
      return;
    }
    if (preview.serviceSessionId && (!preview.sessionVersion || !preview.accountRevision)) {
      setState({ ...state, error: 'version_missing' });
      return;
    }
    const saved: PendingTableOccupancyRecovery = {
      actorId,
      actorRole,
      tableId,
      currency: preview.currency,
      request: {
        operationId: crypto.randomUUID(),
        serviceSessionId: preview.serviceSessionId,
        expectedReadinessVersion: preview.readinessVersion,
        expectedSessionVersion: preview.sessionVersion,
        expectedAccountRevision: preview.accountRevision,
        previewFingerprint: preview.previewFingerprint,
        confirmRecovery: true,
        reason: reason.trim(),
      },
    };
    if (!persistPendingTableOccupancyRecovery(saved)) {
      setState({ stage: 'unavailable' });
      return;
    }
    pending.current = saved;
    await replay(saved);
  }, [actorId, actorRole, canWrite, inFlight, pending, reason, replay, setState, state, tableId]);

  return { startPreview, closePreview, confirm };
}
