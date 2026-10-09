'use client';

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { persistPendingAmendmentResolution, readPendingAmendmentResolution } from '@/lib/pendingAmendmentResolution';
import { quoteAmendmentResolution } from '@/services/amendmentResolutionService';
import type { AmendmentResolutionQuoteRequest, PendingAmendmentResolution } from '@/types/amendmentResolution';
import type { AmendmentResolutionState } from './amendmentResolutionFlowState';

type Run = (original: PendingAmendmentResolution, mode: 'start' | 'lookup' | 'recover') => Promise<void>;
interface Input {
  readonly actorId: string;
  readonly orderId: string;
  readonly amendmentId: string;
  readonly enabled: boolean;
  readonly state: AmendmentResolutionState;
  readonly pending: MutableRefObject<PendingAmendmentResolution | null>;
  readonly inFlight: MutableRefObject<boolean>;
  readonly generation: MutableRefObject<number>;
  readonly mounted: MutableRefObject<boolean>;
  readonly setState: Dispatch<SetStateAction<AmendmentResolutionState>>;
  readonly run: Run;
}

/** Review always starts from fresh server quote; settlement stores that exact quote before Start. */
export function useAmendmentResolutionReview({
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
}: Input) {
  const review = useCallback(
    async (input: Omit<AmendmentResolutionQuoteRequest, 'clientOperationId'>) => {
      if (
        !enabled ||
        inFlight.current ||
        pending.current ||
        !['idle', 'reviewFailed', 'review', 'refused'].includes(state.stage)
      )
        return;
      const saved = readPendingAmendmentResolution(actorId, orderId, amendmentId);
      if (saved.status !== 'none') {
        pending.current = saved.status === 'pending' ? saved.value : null;
        setState({ stage: saved.status === 'pending' ? 'pending' : 'unavailable' });
        return;
      }
      inFlight.current = true;
      const requestGeneration = ++generation.current;
      let handled = false;
      setState({ stage: 'quoting' });
      try {
        const request = { ...input, clientOperationId: crypto.randomUUID() };
        const quote = await quoteAmendmentResolution(orderId, amendmentId, request);
        if (mounted.current && generation.current === requestGeneration) setState({ stage: 'review', quote, request });
        handled = true;
      } catch (_quoteError: unknown) {
        // Quote failure moves no money; expose retry without logging provider or tender details.
      } finally {
        if (generation.current === requestGeneration) {
          if (!handled && mounted.current) setState({ stage: 'reviewFailed' });
          inFlight.current = false;
        }
      }
    },
    [actorId, amendmentId, enabled, generation, inFlight, mounted, orderId, pending, setState, state.stage],
  );

  const settle = useCallback(async () => {
    if (!enabled || inFlight.current || pending.current || state.stage !== 'review' || !state.quote || !state.request)
      return;
    if (Date.parse(state.quote.expiresAt) <= Date.now()) {
      setState({ stage: 'reviewFailed' });
      return;
    }
    const original: PendingAmendmentResolution = {
      actorId,
      orderId,
      amendmentId,
      operationId: null,
      reviewedQuote: state.quote,
      request: {
        quote: state.request,
        quoteHash: state.quote.quoteHash,
        expiresAt: state.quote.expiresAt,
      },
    };
    if (!persistPendingAmendmentResolution(original)) {
      setState({ stage: 'unavailable' });
      return;
    }
    pending.current = original;
    await run(original, 'start');
  }, [actorId, amendmentId, enabled, inFlight, orderId, pending, run, setState, state]);

  return { review, settle };
}
