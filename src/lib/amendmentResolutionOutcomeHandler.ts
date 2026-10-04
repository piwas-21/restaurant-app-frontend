import {
  clearPendingAmendmentResolution,
  clearPendingTillConfirmations,
  persistPendingAmendmentResolution,
} from '@/lib/pendingAmendmentResolution';
import { pendingTillConfirmationsSucceeded } from '@/lib/amendmentResolutionTillValidation';
import { submitTillConfirmationBatch } from '@/lib/amendmentResolutionTillHandler';
import type {
  AmendmentResolutionOutcome,
  AmendmentResolutionResult,
  PendingAmendmentResolution,
} from '@/types/amendmentResolution';

export type AmendmentResolutionOutcomeHandling =
  | {
      readonly outcome: 'accepted';
      readonly status: 'resolved' | 'pending' | 'unavailable';
      readonly pending: PendingAmendmentResolution | null;
      readonly result: Extract<AmendmentResolutionOutcome, { outcome: 'accepted' }>['result'];
    }
  | {
      readonly outcome: 'refused';
      readonly status: 'refused' | 'refreshUnavailable' | 'storageUnavailable';
      readonly pending: PendingAmendmentResolution | null;
      readonly refusal: Extract<AmendmentResolutionOutcome, { outcome: 'refused' }>['refusal'];
    };

/** Retry the caller's authoritative projection read without treating failure as a fresh review. */
export async function refreshAmendmentResolutionContext(refresh: () => Promise<void>): Promise<boolean> {
  let refreshed = false;
  try {
    await refresh();
    refreshed = true;
  } catch (_refreshError: unknown) {
    // The caller keeps the recovery state blocked when an authoritative refresh fails.
  }
  return refreshed;
}

function acceptTillEvidence(
  original: PendingAmendmentResolution,
  result: AmendmentResolutionResult,
): PendingAmendmentResolution | null {
  if (!original.pendingTillConfirmations) return original;
  if (!pendingTillConfirmationsSucceeded(original, result)) return result.state === 'Resolved' ? null : original;
  if (!clearPendingTillConfirmations(original, result)) return null;
  const accepted = { ...original };
  delete accepted.pendingTillConfirmations;
  return accepted;
}

/** Apply only validated server outcomes; an unknown network response never reaches this helper. */
export async function handleAmendmentResolutionOutcome(
  outcome: AmendmentResolutionOutcome,
  original: PendingAmendmentResolution,
  refresh: () => Promise<void>,
): Promise<AmendmentResolutionOutcomeHandling> {
  if (outcome.outcome === 'refused') {
    if (!clearPendingAmendmentResolution(original)) {
      return { outcome: 'refused', status: 'storageUnavailable', pending: original, refusal: outcome.refusal };
    }
    try {
      await refresh();
      return { outcome: 'refused', status: 'refused', pending: null, refusal: outcome.refusal };
    } catch (_refreshError: unknown) {
      // A fresh account snapshot is required before another quote can start.
    }
    return { outcome: 'refused', status: 'refreshUnavailable', pending: null, refusal: outcome.refusal };
  }

  const result = outcome.result;
  const acceptedOriginal = acceptTillEvidence(original, result);
  if (!acceptedOriginal) return { outcome: 'accepted', status: 'unavailable', pending: original, result };
  const bound = { ...acceptedOriginal, operationId: result.operationId };
  if (!persistPendingAmendmentResolution(bound)) {
    return { outcome: 'accepted', status: 'unavailable', pending: original, result };
  }
  if (result.state !== 'Resolved') {
    return { outcome: 'accepted', status: 'pending', pending: bound, result };
  }
  if (!clearPendingAmendmentResolution(bound)) {
    return { outcome: 'accepted', status: 'unavailable', pending: bound, result };
  }
  return { outcome: 'accepted', status: 'resolved', pending: null, result };
}

/** Preserve phase-two evidence on ambiguity; only the ordinary result validator can retire it. */
export async function handleTillConfirmationBatch(
  pending: PendingAmendmentResolution,
  result: AmendmentResolutionResult,
  input: unknown,
  refresh: () => Promise<void>,
): Promise<AmendmentResolutionOutcomeHandling | null> {
  const batch = await submitTillConfirmationBatch(pending, result, input);
  if (!batch) return null;
  return handleAmendmentResolutionOutcome({ outcome: 'accepted', result: batch.result }, batch.pending, refresh);
}
