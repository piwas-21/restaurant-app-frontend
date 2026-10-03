'use client';

import { useCallback } from 'react';
import type { MutableRefObject } from 'react';
import {
  handleTillConfirmationBatch,
  refreshAmendmentResolutionContext,
} from '@/lib/amendmentResolutionOutcomeHandler';
import type {
  AmendmentResolutionResult,
  AmendmentResolutionTillConfirmations,
  PendingAmendmentResolution,
} from '@/types/amendmentResolution';

type TillStage = 'working' | 'pending' | 'resolved' | 'unavailable';
interface Input {
  readonly result?: AmendmentResolutionResult;
  readonly pending: MutableRefObject<PendingAmendmentResolution | null>;
  readonly inFlight: MutableRefObject<boolean>;
  readonly generation: MutableRefObject<number>;
  readonly mounted: MutableRefObject<boolean>;
  readonly refreshRef: MutableRefObject<() => Promise<void>>;
  readonly setStage: (stage: TillStage, result: AmendmentResolutionResult) => void;
}

/** Manual evidence remains actor-bound, exact and retryable even when new resolution writes are disabled. */
export function useAmendmentResolutionTill({
  result,
  pending,
  inFlight,
  generation,
  mounted,
  refreshRef,
  setStage,
}: Input) {
  const runTill = useCallback(
    async (original: PendingAmendmentResolution, input?: unknown) => {
      if (inFlight.current || !result || !original.operationId) return;
      inFlight.current = true;
      const requestGeneration = ++generation.current;
      let handled = false;
      setStage('working', result);
      try {
        const handling = await handleTillConfirmationBatch(original, result, input, refreshRef.current);
        if (!mounted.current || generation.current !== requestGeneration) return;
        handled = true;
        if (!handling) {
          setStage('unavailable', result);
          return;
        }
        pending.current = handling.pending;
        if (handling.outcome === 'accepted' && handling.status === 'resolved') {
          pending.current = null;
          setStage('resolved', handling.result);
          await refreshAmendmentResolutionContext(refreshRef.current);
        } else if (handling.outcome === 'accepted') {
          setStage(handling.status === 'pending' ? 'pending' : 'unavailable', handling.result);
        }
      } catch (_tillResponseError: unknown) {
        // An unknown response leaves the persisted exact batch as the only permitted retry.
      } finally {
        if (generation.current === requestGeneration) {
          if (!handled && mounted.current) setStage('pending', result);
          inFlight.current = false;
        }
      }
    },
    [generation, inFlight, mounted, pending, refreshRef, result, setStage],
  );

  const confirmTill = useCallback(
    async (confirmations: AmendmentResolutionTillConfirmations) => {
      const original = pending.current;
      if (original && !original.pendingTillConfirmations) await runTill(original, confirmations);
    },
    [pending, runTill],
  );
  const retryTill = useCallback(async () => {
    const original = pending.current;
    if (original?.pendingTillConfirmations) await runTill(original);
  }, [pending, runTill]);

  return {
    confirmTill,
    retryTill,
    hasPendingTillConfirmation: pending.current?.pendingTillConfirmations !== undefined,
  };
}
