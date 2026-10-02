'use client';

import { useCallback, useState } from 'react';
import {
  classifyDeliveryChannelMutationFailure,
  deliveryChannelManagementService,
} from '@/services/deliveryChannelManagementService';
import type { DeliveryChannelReconcileResult } from '@/types/deliveryChannelExceptions';

export type DeliveryChannelOperationKind = 'availability' | 'disconnect' | 'reconcile';
export type DeliveryChannelOperationOutcome =
  'confirmed' | 'partial' | 'stale' | 'rejected' | 'uncertain' | 'readOnlyViolation';

export interface DeliveryChannelOperationFeedback {
  readonly kind: DeliveryChannelOperationKind;
  readonly outcome: DeliveryChannelOperationOutcome;
  readonly code: string | null;
  readonly reconcileResult?: DeliveryChannelReconcileResult;
}

interface FreshStatusResult {
  readonly summary: boolean;
  readonly availability: boolean;
  readonly fresh: boolean;
}

export function useDeliveryChannelOperations(refreshStatus: (forceFresh?: boolean) => Promise<FreshStatusResult>) {
  const [busy, setBusy] = useState<DeliveryChannelOperationKind | null>(null);
  const [feedback, setFeedback] = useState<DeliveryChannelOperationFeedback | null>(null);
  const [statusCheckRequired, setStatusCheckRequired] = useState(false);

  const readStatus = useCallback(async () => {
    setBusy('availability');
    try {
      const result = await refreshStatus(true);
      const confirmed = result.summary && result.availability && result.fresh;
      if (confirmed) {
        setStatusCheckRequired(false);
        setFeedback((current) => (current?.kind === 'availability' ? null : current));
      }
      return confirmed;
    } finally {
      setBusy(null);
    }
  }, [refreshStatus]);

  const handleWriteFailure = useCallback(
    async (kind: Exclude<DeliveryChannelOperationKind, 'reconcile'>, error: unknown) => {
      const outcome = classifyDeliveryChannelMutationFailure(error);
      setFeedback({ kind, outcome, code: null });
      if (outcome === 'uncertain') {
        setStatusCheckRequired(true);
        await refreshStatus(true);
      }
    },
    [refreshStatus],
  );

  const pause = useCallback(
    async (durationMinutes: 15 | 30 | 60 | 240 | null) => {
      if (busy || statusCheckRequired) return;
      setBusy('availability');
      setFeedback(null);
      try {
        const result = await deliveryChannelManagementService.pauseAvailability(durationMinutes);
        setFeedback({
          kind: 'availability',
          outcome: result.providerConfirmed ? 'confirmed' : 'partial',
          code: result.resultCode,
        });
        if (!result.providerConfirmed) setStatusCheckRequired(true);
        await refreshStatus(true);
      } catch (error) {
        await handleWriteFailure('availability', error);
      } finally {
        setBusy(null);
      }
    },
    [busy, handleWriteFailure, refreshStatus, statusCheckRequired],
  );

  const resume = useCallback(async () => {
    if (busy || statusCheckRequired) return;
    setBusy('availability');
    setFeedback(null);
    try {
      const result = await deliveryChannelManagementService.resumeAvailability();
      setFeedback({
        kind: 'availability',
        outcome: result.providerConfirmed ? 'confirmed' : 'partial',
        code: result.resultCode,
      });
      if (!result.providerConfirmed) setStatusCheckRequired(true);
      await refreshStatus(true);
    } catch (error) {
      await handleWriteFailure('availability', error);
    } finally {
      setBusy(null);
    }
  }, [busy, handleWriteFailure, refreshStatus, statusCheckRequired]);

  const disconnect = useCallback(
    async (storeId: string) => {
      if (busy || statusCheckRequired) return;
      setBusy('disconnect');
      setFeedback(null);
      try {
        const result = await deliveryChannelManagementService.disconnect(storeId);
        const complete = result.providerManagerRelinquished && result.localBridgePaused;
        setFeedback({ kind: 'disconnect', outcome: complete ? 'confirmed' : 'partial', code: result.resultCode });
        if (!complete) setStatusCheckRequired(true);
        await refreshStatus(true);
      } catch (error) {
        await handleWriteFailure('disconnect', error);
      } finally {
        setBusy(null);
      }
    },
    [busy, handleWriteFailure, refreshStatus, statusCheckRequired],
  );

  const reconcile = useCallback(
    async (exceptionId: string) => {
      if (busy) return;
      setBusy('reconcile');
      setFeedback(null);
      try {
        const result = await deliveryChannelManagementService.reconcileException(exceptionId);
        const outcome = result.providerRequestSent ? 'readOnlyViolation' : 'confirmed';
        setFeedback({ kind: 'reconcile', outcome, code: result.code, reconcileResult: result });
        await refreshStatus(true);
      } catch (error) {
        const failure = classifyDeliveryChannelMutationFailure(error);
        setFeedback({ kind: 'reconcile', outcome: failure, code: null });
      } finally {
        setBusy(null);
      }
    },
    [busy, refreshStatus],
  );

  return {
    busy,
    feedback,
    statusCheckRequired,
    canWrite: busy === null && !statusCheckRequired,
    readStatus,
    pause,
    resume,
    disconnect,
    reconcile,
  };
}
