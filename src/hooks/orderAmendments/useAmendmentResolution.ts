'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { readPendingAmendmentResolution } from '@/lib/pendingAmendmentResolution';
import {
  handleAmendmentResolutionOutcome,
  refreshAmendmentResolutionContext,
} from '@/lib/amendmentResolutionOutcomeHandler';
import { useAmendmentResolutionTill } from './useAmendmentResolutionTill';
import { useAmendmentResolutionReview } from './useAmendmentResolutionReview';
import type { AmendmentResolutionStage, AmendmentResolutionState } from './amendmentResolutionFlowState';
import {
  lookupAmendmentResolution,
  recoverAmendmentResolution,
  startAmendmentResolution,
} from '@/services/amendmentResolutionService';
import type { AmendmentResolutionResult, PendingAmendmentResolution } from '@/types/amendmentResolution';
interface Input {
  readonly actorId: string;
  readonly orderId: string;
  readonly amendmentId: string;
  readonly enabled: boolean;
  readonly refresh: () => Promise<void>;
}
const resolutionRequests = {
  start: startAmendmentResolution,
  lookup: lookupAmendmentResolution,
  recover: recoverAmendmentResolution,
};

/** Mount with actor/order/amendment key; new quotes never replace an unresolved original refund. */
export function useAmendmentResolution({ actorId, orderId, amendmentId, enabled, refresh }: Input) {
  const [state, setState] = useState<AmendmentResolutionState>({ stage: 'checking' });
  const pending = useRef<PendingAmendmentResolution | null>(null);
  const inFlight = useRef(false);
  const generation = useRef(0);
  const mounted = useRef(false);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  const run = useCallback(async (original: PendingAmendmentResolution, mode: 'start' | 'lookup' | 'recover') => {
    if (inFlight.current) return;
    inFlight.current = true;
    const requestGeneration = ++generation.current;
    let handled = false;
    setState({ stage: 'working' });
    try {
      const outcome = await resolutionRequests[mode](original);
      if (!mounted.current || generation.current !== requestGeneration) return;
      const handling = await handleAmendmentResolutionOutcome(outcome, original, refreshRef.current);
      if (!mounted.current || generation.current !== requestGeneration) return;
      pending.current = handling.pending;
      if (handling.outcome === 'refused') {
        setState({
          stage: handling.status === 'refused' ? 'refused' : 'unavailable',
          refusal: handling.refusal,
        });
      } else if (handling.status === 'resolved') {
        setState({ stage: 'resolved', result: handling.result });
        void refreshRef.current().catch(() => undefined);
      } else if (handling.status === 'pending') {
        setState({ stage: 'pending', result: handling.result });
      } else setState({ stage: 'unavailable', result: handling.result });
      handled = true;
    } catch (_responseError: unknown) {
      // Missing, malformed or lost responses keep the original refund journal and private details unlogged.
    } finally {
      if (generation.current === requestGeneration) {
        if (!handled && mounted.current) setState({ stage: 'pending' });
        inFlight.current = false;
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const saved = readPendingAmendmentResolution(actorId, orderId, amendmentId);
    pending.current = saved.status === 'pending' ? saved.value : null;
    if (saved.status === 'pending') void run(saved.value, 'lookup');
    else setState({ stage: saved.status === 'none' ? 'idle' : 'unavailable' });
    return () => {
      mounted.current = false;
      generation.current += 1;
      inFlight.current = false;
    };
  }, [actorId, amendmentId, orderId, run]);

  const reviewActions = useAmendmentResolutionReview({
    actorId,
    orderId,
    amendmentId,
    enabled,
    state,
    pending,
    inFlight,
    generation,
    mounted,
    setState,
    run,
  });

  const check = useCallback(async () => {
    if (pending.current) await run(pending.current, 'lookup');
  }, [run]);
  const retry = useCallback(async () => {
    if (pending.current) await run(pending.current, 'recover');
  }, [run]);
  const setTillState = useCallback(
    (stage: AmendmentResolutionStage, result: AmendmentResolutionResult) => setState({ stage, result }),
    [],
  );
  const tillActions = useAmendmentResolutionTill({
    result: state.result,
    pending,
    inFlight,
    generation,
    mounted,
    refreshRef,
    setStage: setTillState,
  });
  const refreshRefused = useCallback(async () => {
    const refusal = state.refusal;
    if (!refusal || pending.current || !['unavailable', 'refused'].includes(state.stage) || inFlight.current) return;
    inFlight.current = true;
    const requestGeneration = ++generation.current;
    setState({ stage: 'working', refusal });
    const refreshed = await refreshAmendmentResolutionContext(refreshRef.current);
    if (mounted.current && generation.current === requestGeneration)
      setState({ stage: refreshed ? 'refused' : 'unavailable', refusal });
    if (generation.current === requestGeneration) inFlight.current = false;
  }, [state.refusal, state.stage]);
  return {
    ...state,
    reviewedQuote: pending.current?.reviewedQuote,
    hasPending: pending.current !== null,
    ...reviewActions,
    check,
    retry,
    ...tillActions,
    refreshRefused,
  };
}
